// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {EIP7702RelayedCheckInExecutor} from "../src/EIP7702RelayedCheckInExecutor.sol";

/// @notice Replaces the course EOA's prior fixed executor with the same fixed check-in scope plus a payable receive hook.
/// @dev A relayer pays all gas because the delegated course EOA remains below Monad's 10 MON post-gas reserve rule.
contract UpgradeToReceiveEnabledEIP7702Executor is Script {
    address internal constant CURRENT_EXECUTOR = 0x697b1971AC691d20693e98FC503999F0Cb2bB493;

    function run() external returns (EIP7702RelayedCheckInExecutor receiveEnabledExecutor) {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        uint256 relayerKey = vm.envUint("EIP7702_RELAYER_PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        address relayer = vm.addr(relayerKey);

        EIP7702RelayedCheckInExecutor current = EIP7702RelayedCheckInExecutor(payable(CURRENT_EXECUTOR));
        address target = current.target();
        require(current.relayer() == relayer, "unexpected current relayer");

        vm.startBroadcast(relayerKey);
        receiveEnabledExecutor = new EIP7702RelayedCheckInExecutor(relayer, target);
        vm.stopBroadcast();

        vm.signAndAttachDelegation(address(receiveEnabledExecutor), ownerKey);
        vm.broadcast(relayerKey);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();

        console2.log("DelegatedEOA", owner);
        console2.log("Relayer", relayer);
        console2.log("Target", target);
        console2.log("ReceiveEnabledExecutor", address(receiveEnabledExecutor));
    }
}
