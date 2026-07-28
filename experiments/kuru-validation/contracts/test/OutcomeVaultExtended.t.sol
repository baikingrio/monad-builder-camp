// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";

contract VaultActor {
    function approve(address token, address spender, uint256 amount) external {
        OutcomeToken(token).approve(spender, amount);
    }

    function approveCollateral(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function split(OutcomeVault vault, uint256 amount) external {
        vault.split(amount);
    }

    function redeem(OutcomeVault vault) external {
        vault.redeem();
    }
}

contract OutcomeVaultExtendedTest {
    function test_belowResolutionPaysOnlyBelowShares() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        uint256 amount = 100e6;
        usdc.mint(address(this), amount);
        usdc.approve(address(vault), amount);
        vault.split(amount);

        vault.resolve(OutcomeVault.Outcome.Below);
        vault.belowToken().approve(address(vault), amount);
        vault.redeem();

        require(usdc.balanceOf(address(this)) == amount, "below payout missing");
        require(vault.aboveToken().balanceOf(address(this)) == amount, "losing above changed");
        require(vault.belowToken().balanceOf(address(this)) == 0, "winning below not burned");
        require(usdc.balanceOf(address(vault)) == 0, "collateral remains");
    }

    function test_voidPaysEachHolderHalfOfBothShareBalances() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        VaultActor alice = new VaultActor();
        VaultActor bob = new VaultActor();
        uint256 amount = 10e6;

        usdc.mint(address(alice), amount);
        usdc.mint(address(bob), amount);
        alice.approveCollateral(usdc, address(vault), amount);
        bob.approveCollateral(usdc, address(vault), amount);
        alice.split(vault, amount);
        bob.split(vault, amount);

        vault.resolve(OutcomeVault.Outcome.Void);
        alice.approve(address(vault.aboveToken()), address(vault), amount);
        alice.approve(address(vault.belowToken()), address(vault), amount);
        bob.approve(address(vault.aboveToken()), address(vault), amount);
        bob.approve(address(vault.belowToken()), address(vault), amount);
        alice.redeem(vault);
        bob.redeem(vault);

        require(usdc.balanceOf(address(alice)) == amount, "alice void payout wrong");
        require(usdc.balanceOf(address(bob)) == amount, "bob void payout wrong");
        require(usdc.balanceOf(address(vault)) == 0, "void collateral remains");
    }

    function test_resolvedVaultRejectsSplitMergeAndSecondRedeem() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        uint256 amount = 10e6;
        usdc.mint(address(this), amount);
        usdc.approve(address(vault), amount);
        vault.split(amount);
        vault.resolve(OutcomeVault.Outcome.Above);

        bool splitReverted;
        try vault.split(1) {} catch { splitReverted = true; }
        require(splitReverted, "split after resolution allowed");

        bool mergeReverted;
        try vault.merge(1) {} catch { mergeReverted = true; }
        require(mergeReverted, "merge after resolution allowed");

        vault.aboveToken().approve(address(vault), amount);
        vault.redeem();
        bool secondRedeemReverted;
        try vault.redeem() {} catch { secondRedeemReverted = true; }
        require(secondRedeemReverted, "second redeem allowed");
    }

    function testFuzz_splitMergeConservesCollateral(uint64 rawAmount) external {
        uint256 amount = (uint256(rawAmount) % 1_000_000_000_000) + 1;
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        usdc.mint(address(this), amount);
        usdc.approve(address(vault), amount);
        vault.split(amount);
        require(vault.aboveToken().totalSupply() == vault.belowToken().totalSupply(), "supply mismatch after split");
        require(usdc.balanceOf(address(vault)) == amount, "collateral mismatch after split");
        vault.aboveToken().approve(address(vault), amount);
        vault.belowToken().approve(address(vault), amount);
        vault.merge(amount);
        require(usdc.balanceOf(address(vault)) == 0, "collateral mismatch after merge");
        require(usdc.balanceOf(address(this)) == amount, "user balance mismatch after merge");
    }
}
