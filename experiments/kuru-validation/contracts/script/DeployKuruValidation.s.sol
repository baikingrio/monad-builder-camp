// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {ComplementaryMatchPoC} from "../src/ComplementaryMatchPoC.sol";

interface IKuruRouter {
    function deployProxy(
        uint8 orderBookType,
        address baseAsset,
        address quoteAsset,
        uint96 sizePrecision,
        uint32 pricePrecision,
        uint32 tickSize,
        uint96 minSize,
        uint96 maxSize,
        uint256 takerFeeBps,
        uint256 makerFeeBps,
        uint96 kuruAmmSpread
    ) external returns (address proxy);
}

/// @notice Testnet-only Phase 1 deployment. No real assets are accepted.
contract DeployKuruValidation is Script {
    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;
    address internal constant KURU_ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;

    function run()
        external
        returns (MockERC20 mockUsdc, OutcomeVault vault, ComplementaryMatchPoC matcher, address kuruMarket)
    {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "wrong chain");

        vm.startBroadcast();
        mockUsdc = new MockERC20("Kuru Validation Test USDC", "kvUSDC", 6);
        vault = new OutcomeVault(mockUsdc);
        matcher = new ComplementaryMatchPoC(mockUsdc, vault);
        vault.setMatcher(address(matcher));

        // Kuru NO_NATIVE market: Above Share / kvUSDC, quoted in 1e6 price precision.
        kuruMarket = IKuruRouter(KURU_ROUTER).deployProxy(
            0,
            address(vault.aboveToken()),
            address(mockUsdc),
            1e6,
            1e6,
            10_000,
            1e6,
            1_000_000e6,
            0,
            0,
            100
        );
        vm.stopBroadcast();

        console2.log("MockUSDC", address(mockUsdc));
        console2.log("OutcomeVault", address(vault));
        console2.log("AboveToken", address(vault.aboveToken()));
        console2.log("BelowToken", address(vault.belowToken()));
        console2.log("ComplementaryMatchPoC", address(matcher));
        console2.log("KuruMarket", kuruMarket);
    }
}
