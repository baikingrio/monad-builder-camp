// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {KuruTestTrader} from "../src/KuruTestTrader.sol";

contract KuruTestTraderTest {
    function test_traderCanApproveAndSplitWithoutGivingTheResolverControl() external {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        KuruTestTrader alice = new KuruTestTrader();
        uint256 amount = 10e6;

        usdc.mint(address(alice), amount);
        alice.approveToken(address(usdc), address(vault), amount);
        alice.split(vault, amount);

        require(vault.aboveToken().balanceOf(address(alice)) == amount, "alice misses above");
        require(vault.belowToken().balanceOf(address(alice)) == amount, "alice misses below");
        require(vault.resolver() == address(this), "resolver changed");
    }
}
