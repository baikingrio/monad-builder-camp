// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {ComplementaryMatchPoC} from "../src/ComplementaryMatchPoC.sol";

contract Trader {
    function approve(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function placeBid(ComplementaryMatchPoC matcher, ComplementaryMatchPoC.Side side, uint256 price, uint256 size)
        external
        returns (uint256)
    {
        return matcher.placeBid(side, price, size);
    }

    function cancelBid(ComplementaryMatchPoC matcher, uint256 orderId) external {
        matcher.cancelBid(orderId);
    }
}

contract ComplementaryMatchPoCTest {
    uint256 private constant PRICE_SCALE = 1e6;

    function test_complementaryBidsAtomicallyMintACompleteSet() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        vault.setMatcher(address(matcher));

        Trader alice = new Trader();
        Trader bob = new Trader();
        uint256 size = 100e6;
        uint256 abovePrice = 600_000;
        uint256 belowPrice = 400_000;

        usdc.mint(address(alice), (abovePrice * size) / PRICE_SCALE);
        usdc.mint(address(bob), (belowPrice * size) / PRICE_SCALE);
        alice.approve(usdc, address(matcher), (abovePrice * size) / PRICE_SCALE);
        bob.approve(usdc, address(matcher), (belowPrice * size) / PRICE_SCALE);

        uint256 aboveOrder = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, abovePrice, size);
        uint256 belowOrder = bob.placeBid(matcher, ComplementaryMatchPoC.Side.Below, belowPrice, size);
        matcher.matchComplementary(aboveOrder, belowOrder);

        require(vault.aboveToken().balanceOf(address(alice)) == size, "alice misses above");
        require(vault.belowToken().balanceOf(address(bob)) == size, "bob misses below");
        require(usdc.balanceOf(address(vault)) == size, "complete set not collateralized");
        require(usdc.balanceOf(address(matcher)) == 0, "matcher retains collateral");
    }

    function test_cancelReturnsBidEscrowBeforeAnyMatch() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        Trader alice = new Trader();
        uint256 size = 10e6;
        uint256 price = 600_000;
        uint256 escrow = (price * size) / PRICE_SCALE;

        usdc.mint(address(alice), escrow);
        alice.approve(usdc, address(matcher), escrow);
        uint256 orderId = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, price, size);
        alice.cancelBid(matcher, orderId);

        require(usdc.balanceOf(address(alice)) == escrow, "escrow not returned");
        (, , , , , bool active) = matcher.bids(orderId);
        require(!active, "order still active");
    }

    function test_selfMatchingIsRejectedToPreventWashVolume() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        vault.setMatcher(address(matcher));
        Trader alice = new Trader();
        uint256 size = 100e6;

        usdc.mint(address(alice), 100e6);
        alice.approve(usdc, address(matcher), 100e6);
        uint256 aboveOrder = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, 600_000, size);
        uint256 belowOrder = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Below, 400_000, size);

        bool reverted;
        try matcher.matchComplementary(aboveOrder, belowOrder) {} catch { reverted = true; }
        require(reverted, "self match was allowed");
    }

    function test_priceImprovementRefundsTakerExcessInsteadOfProtocolKeepingIt() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        vault.setMatcher(address(matcher));
        Trader alice = new Trader();
        Trader bob = new Trader();
        uint256 size = 100e6;

        // Alice is maker at 0.62. Bob bids 0.40 but only owes 0.38, so 2 USDC is refunded.
        usdc.mint(address(alice), 62e6);
        usdc.mint(address(bob), 40e6);
        alice.approve(usdc, address(matcher), 62e6);
        bob.approve(usdc, address(matcher), 40e6);
        uint256 aboveOrder = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, 620_000, size);
        uint256 belowOrder = bob.placeBid(matcher, ComplementaryMatchPoC.Side.Below, 400_000, size);
        matcher.matchComplementary(aboveOrder, belowOrder);

        require(usdc.balanceOf(address(alice)) == 0, "maker payment wrong");
        require(usdc.balanceOf(address(bob)) == 2e6, "taker improvement missing");
        require(usdc.balanceOf(address(vault)) == size, "collateral not exact");
        require(vault.aboveToken().balanceOf(address(alice)) == size, "above missing");
        require(vault.belowToken().balanceOf(address(bob)) == size, "below missing");
    }

    function test_atomicUnitSizeRoundingStillMatchesComplementaryBids() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        vault.setMatcher(address(matcher));
        Trader alice = new Trader();
        Trader bob = new Trader();

        // 0.5 × 3 requires ceiling escrow on each bid; it must not become an unmatchable valid pair.
        usdc.mint(address(alice), 2);
        usdc.mint(address(bob), 2);
        alice.approve(usdc, address(matcher), 2);
        bob.approve(usdc, address(matcher), 2);
        uint256 aboveOrder = alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, 500_000, 3);
        uint256 belowOrder = bob.placeBid(matcher, ComplementaryMatchPoC.Side.Below, 500_000, 3);
        matcher.matchComplementary(aboveOrder, belowOrder);

        require(usdc.balanceOf(address(vault)) == 3, "collateral wrong");
        require(vault.aboveToken().balanceOf(address(alice)) == 3, "above missing");
        require(vault.belowToken().balanceOf(address(bob)) == 3, "below missing");
    }

    function test_resolvedVaultRejectsNewBidEscrow() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        ComplementaryMatchPoC matcher = new ComplementaryMatchPoC(usdc, vault);
        vault.setMatcher(address(matcher));
        Trader alice = new Trader();
        usdc.mint(address(alice), 60e6);
        alice.approve(usdc, address(matcher), 60e6);
        vault.resolve(OutcomeVault.Outcome.Above);

        bool reverted;
        try alice.placeBid(matcher, ComplementaryMatchPoC.Side.Above, 600_000, 100e6) {} catch { reverted = true; }
        require(reverted, "resolved market accepted escrow");
    }
}
