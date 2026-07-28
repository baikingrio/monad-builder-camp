// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {PredictionCLOB} from "../src/PredictionCLOB.sol";

contract ClobTrader {
    function approve(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function place(PredictionCLOB clob, PredictionCLOB.Side side, uint32 price, uint96 size) external returns (uint64) {
        return clob.placeBid(side, price, size);
    }

    function cancel(PredictionCLOB clob, uint64 id) external {
        clob.cancel(id);
    }
}

contract PredictionCLOBTest is Test {
    uint256 internal constant ONE = 1e6;

    function test_partialFillLeavesRemainderAndMintsOnlyFilledPairs() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        PredictionCLOB clob = new PredictionCLOB(usdc, vault, uint64(block.timestamp + 10 minutes));
        vault.setMatcher(address(clob));
        ClobTrader alice = new ClobTrader();
        ClobTrader bob = new ClobTrader();

        usdc.mint(address(alice), 60 * ONE);
        usdc.mint(address(bob), 40 * ONE);
        alice.approve(usdc, address(clob), 60 * ONE);
        bob.approve(usdc, address(clob), 40 * ONE);
        uint64 aboveId = alice.place(clob, PredictionCLOB.Side.Above, 600_000, uint96(100 * ONE));
        uint64 belowId = bob.place(clob, PredictionCLOB.Side.Below, 400_000, uint96(40 * ONE));

        clob.matchBest();

        (, , , uint96 aboveRemaining, , bool aboveActive) = clob.orders(aboveId);
        require(aboveActive && aboveRemaining == 60 * ONE, "above remainder wrong");
        require(vault.aboveToken().balanceOf(address(alice)) == 40 * ONE, "above fill wrong");
        require(vault.belowToken().balanceOf(address(bob)) == 40 * ONE, "below fill wrong");
        require(usdc.balanceOf(address(vault)) == 40 * ONE, "collateral wrong");
        (, , , uint96 belowRemaining, , bool belowActive) = clob.orders(belowId);
        require(!belowActive && belowRemaining == 0, "below should be filled");
    }

    function test_cutoffBlocksNewBidsAndMatchesButStillAllowsCancellation() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        uint64 cutoff = uint64(block.timestamp + 60);
        PredictionCLOB clob = new PredictionCLOB(usdc, vault, cutoff);
        vault.setMatcher(address(clob));
        ClobTrader alice = new ClobTrader();
        usdc.mint(address(alice), 60 * ONE);
        alice.approve(usdc, address(clob), 60 * ONE);
        uint64 orderId = alice.place(clob, PredictionCLOB.Side.Above, 600_000, uint96(100 * ONE));

        vm.warp(cutoff);
        clob.closeTrading();

        vm.expectRevert();
        alice.place(clob, PredictionCLOB.Side.Above, 600_000, uint96(1 * ONE));
        vm.expectRevert();
        clob.matchBest();

        alice.cancel(clob, orderId);
        require(usdc.balanceOf(address(alice)) == 60 * ONE, "cancel not allowed after cutoff");
    }

    function test_highestPriceWinsAndSamePriceWouldUseEarlierId() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        PredictionCLOB clob = new PredictionCLOB(usdc, vault, uint64(block.timestamp + 10 minutes));
        vault.setMatcher(address(clob));
        ClobTrader lowBidder = new ClobTrader();
        ClobTrader highBidder = new ClobTrader();
        ClobTrader belowBidder = new ClobTrader();

        usdc.mint(address(lowBidder), 60 * ONE);
        usdc.mint(address(highBidder), 61 * ONE);
        usdc.mint(address(belowBidder), 40 * ONE);
        lowBidder.approve(usdc, address(clob), 60 * ONE);
        highBidder.approve(usdc, address(clob), 61 * ONE);
        belowBidder.approve(usdc, address(clob), 40 * ONE);
        lowBidder.place(clob, PredictionCLOB.Side.Above, 600_000, uint96(100 * ONE));
        highBidder.place(clob, PredictionCLOB.Side.Above, 610_000, uint96(100 * ONE));
        belowBidder.place(clob, PredictionCLOB.Side.Below, 400_000, uint96(100 * ONE));

        clob.matchBest();

        require(vault.aboveToken().balanceOf(address(highBidder)) == 100 * ONE, "highest bid not selected");
        require(vault.aboveToken().balanceOf(address(lowBidder)) == 0, "lower bid incorrectly filled");
        require(usdc.balanceOf(address(belowBidder)) == 1 * ONE, "price improvement missing");
    }

    function test_filledOrCanceledOrderCannotBeReplayed() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        PredictionCLOB clob = new PredictionCLOB(usdc, vault, uint64(block.timestamp + 10 minutes));
        vault.setMatcher(address(clob));
        ClobTrader alice = new ClobTrader();
        usdc.mint(address(alice), 60 * ONE);
        alice.approve(usdc, address(clob), 60 * ONE);
        uint64 id = alice.place(clob, PredictionCLOB.Side.Above, 600_000, uint96(100 * ONE));
        alice.cancel(clob, id);

        vm.expectRevert();
        alice.cancel(clob, id);
    }
}
