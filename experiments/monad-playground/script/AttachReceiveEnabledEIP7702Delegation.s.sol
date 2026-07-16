// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {EIP7702RelayedCheckInExecutor} from "../src/EIP7702RelayedCheckInExecutor.sol";

/// @notice Attaches the already deployed receive-enabled Executor to the course EOA and calls only its fixed runDemo action.
/// @dev Uses EIP-7702 transaction fees (not legacy fees); the local relayer pays gas.
contract AttachReceiveEnabledEIP7702Delegation is Script {
    address internal constant RECEIVE_ENABLED_EXECUTOR = 0x0398162B317b367541F5557A09b49F14cbA4C26B;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        uint256 relayerKey = vm.envUint("EIP7702_RELAYER_PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        address relayer = vm.addr(relayerKey);

        EIP7702RelayedCheckInExecutor executor = EIP7702RelayedCheckInExecutor(payable(RECEIVE_ENABLED_EXECUTOR));
        require(executor.relayer() == relayer, "unexpected executor relayer");

        vm.signAndAttachDelegation(RECEIVE_ENABLED_EXECUTOR, ownerKey);
        vm.broadcast(relayerKey);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();

        console2.log("DelegatedEOA", owner);
        console2.log("Relayer", relayer);
        console2.log("ReceiveEnabledExecutor", RECEIVE_ENABLED_EXECUTOR);
        console2.log("Target", executor.target());
    }
}
