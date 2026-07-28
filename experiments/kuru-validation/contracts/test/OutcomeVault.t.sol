// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";

contract OutcomeVaultTest {
    function test_splitThenMergeReturnsCollateralAndBurnsBothShares() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);

        uint256 amount = 100e6;
        usdc.mint(address(this), amount);
        usdc.approve(address(vault), amount);

        vault.split(amount);

        require(vault.aboveToken().balanceOf(address(this)) == amount, "above not minted");
        require(vault.belowToken().balanceOf(address(this)) == amount, "below not minted");
        require(usdc.balanceOf(address(vault)) == amount, "collateral not locked");

        vault.aboveToken().approve(address(vault), amount);
        vault.belowToken().approve(address(vault), amount);
        vault.merge(amount);

        require(usdc.balanceOf(address(this)) == amount, "collateral not returned");
        require(vault.aboveToken().balanceOf(address(this)) == 0, "above not burned");
        require(vault.belowToken().balanceOf(address(this)) == 0, "below not burned");
        require(usdc.balanceOf(address(vault)) == 0, "vault collateral remains");
    }
}
