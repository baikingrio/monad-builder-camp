// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MossPlanHashProof} from "../src/MossPlanHashProof.sol";

/// @notice Deploys a fixed receipt for the public Moss MCP simulation and records it once.
/// @dev This is a distinct Monad Testnet proof. It does not claim that Moss executed on Testnet.
contract DeployMossPlanHashProof is Script {
    bytes32 internal constant PLAN_HASH = 0xd79ace0ec5ac5e8f53b8a5ea96d500db16e405c40c82d8e190fd39ac25915fcf;
    uint256 internal constant MOSS_MAINNET_CHAIN_ID = 143;

    function run() external returns (MossPlanHashProof proof) {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);

        vm.startBroadcast(ownerKey);
        proof = new MossPlanHashProof(PLAN_HASH, MOSS_MAINNET_CHAIN_ID);
        proof.recordZeroWarningPlan();
        vm.stopBroadcast();

        console2.log("ProofContract", address(proof));
        console2.log("Recorder", owner);
        console2.log("PlanHash");
        console2.logBytes32(PLAN_HASH);
    }
}
