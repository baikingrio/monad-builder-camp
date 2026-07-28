// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {KuruTestTrader} from "../src/KuruTestTrader.sol";

/// @notice Testnet-only Below and Void payout proof for the OutcomeVault boundary.
contract RunOutcomeSettlementScenarios is Script {
    uint256 internal constant CHAIN_ID = 10143;
    uint256 internal constant ONE = 1e6;

    function run() external returns (address belowVault, address voidVault) {
        require(block.chainid == CHAIN_ID, "wrong chain");
        vm.startBroadcast();
        MockERC20 usdc = new MockERC20("Settlement Test USDC", "stUSDC", 6);

        // Below winner scenario.
        OutcomeVault below = new OutcomeVault(usdc);
        KuruTestTrader belowHolder = new KuruTestTrader();
        usdc.mint(address(belowHolder), 100 * ONE);
        belowHolder.approveToken(address(usdc), address(below), 100 * ONE);
        belowHolder.split(below, 100 * ONE);
        below.resolve(OutcomeVault.Outcome.Below);
        belowHolder.approveToken(address(below.belowToken()), address(below), 100 * ONE);
        belowHolder.redeem(below);

        // Two independent users receive a uniform Void payout.
        OutcomeVault voidMarket = new OutcomeVault(usdc);
        KuruTestTrader alice = new KuruTestTrader();
        KuruTestTrader bob = new KuruTestTrader();
        usdc.mint(address(alice), 10 * ONE);
        usdc.mint(address(bob), 10 * ONE);
        alice.approveToken(address(usdc), address(voidMarket), 10 * ONE);
        bob.approveToken(address(usdc), address(voidMarket), 10 * ONE);
        alice.split(voidMarket, 10 * ONE);
        bob.split(voidMarket, 10 * ONE);
        voidMarket.resolve(OutcomeVault.Outcome.Void);
        alice.approveToken(address(voidMarket.aboveToken()), address(voidMarket), 10 * ONE);
        alice.approveToken(address(voidMarket.belowToken()), address(voidMarket), 10 * ONE);
        bob.approveToken(address(voidMarket.aboveToken()), address(voidMarket), 10 * ONE);
        bob.approveToken(address(voidMarket.belowToken()), address(voidMarket), 10 * ONE);
        alice.redeem(voidMarket);
        bob.redeem(voidMarket);
        vm.stopBroadcast();

        belowVault = address(below);
        voidVault = address(voidMarket);
        console2.log("MockUSDC", address(usdc));
        console2.log("BelowVault", belowVault);
        console2.log("BelowWinner", address(belowHolder));
        console2.log("VoidVault", voidVault);
        console2.log("VoidAlice", address(alice));
        console2.log("VoidBob", address(bob));
    }
}
