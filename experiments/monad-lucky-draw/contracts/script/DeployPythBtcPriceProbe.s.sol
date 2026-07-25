// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PythBtcPriceProbe} from "../src/PythBtcPriceProbe.sol";

/// @notice Deploys the BTC/USD Pyth probe to Monad Testnet when Forge is explicitly run with --broadcast.
/// @dev No key is read by this script; Forge receives the signer only through its CLI configuration.
contract DeployPythBtcPriceProbe is Script {
    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;
    address internal constant PYTH = 0x2880aB155794e7179c9eE2e38200202908C17B43;
    bytes32 internal constant BTC_USD_PRICE_ID =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    uint256 internal constant MAX_PRICE_AGE = 60;

    function run() external returns (PythBtcPriceProbe deployed) {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "DeployPythBtcPriceProbe: chainId must be 10143");

        vm.startBroadcast();
        deployed = new PythBtcPriceProbe(PYTH, BTC_USD_PRICE_ID, MAX_PRICE_AGE);
        vm.stopBroadcast();

        console2.log("PythBtcPriceProbe", address(deployed));
        console2.log("Pyth", PYTH);
        console2.log("maxPriceAge", MAX_PRICE_AGE);
    }
}
