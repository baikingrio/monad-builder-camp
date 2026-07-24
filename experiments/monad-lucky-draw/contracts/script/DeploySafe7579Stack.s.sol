// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Dry-run only. Aborts unless Monad chainId is 10143 and never starts broadcast.
/// @dev Reads vendor-manifest.safe7579.json; refuses to treat foreign-chain addresses as deployed.
contract DeploySafe7579Stack is Script {
    using stdJson for string;

    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external view {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "DeploySafe7579Stack: chainId must be 10143");
        require(!_broadcastRequested(), "DeploySafe7579Stack: broadcast is forbidden without explicit approval");

        string memory manifest = vm.readFile("./vendor-manifest.safe7579.json");
        require(manifest.readBool(".deployment.permitted") == false, "DeploySafe7579Stack: deployment.permitted must stay false");

        address launchpad = manifest.readAddress(".monad.knownAbsent.launchpad");
        address adapter = manifest.readAddress(".monad.knownAbsent.adapter");
        address smartSession = manifest.readAddress(".monad.knownAbsent.smartSessionEmissary");

        _requireAbsentOrDocumented("launchpad", launchpad);
        _requireAbsentOrDocumented("adapter", adapter);
        _requireAbsentOrDocumented("smartSessionEmissary", smartSession);

        console2.log("DeploySafe7579Stack dry-run OK");
        console2.log("chainId", block.chainid);
        console2.log("deployment.permitted remains false; no contracts were deployed");
        console2.log("launchpad", launchpad);
        console2.log("adapter", adapter);
        console2.log("smartSessionEmissary", smartSession);
    }

    function _broadcastRequested() internal view returns (bool) {
        try vm.envBool("SAFE7579_ALLOW_BROADCAST") returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }

    function _requireAbsentOrDocumented(string memory label, address target) internal view {
        bytes memory code = target.code;
        if (code.length != 0) {
            console2.log(label, "has unexpected bytecode; refusing silent reuse");
            revert("DeploySafe7579Stack: unexpected on-chain code at knownAbsent address");
        }
        console2.log(label, "confirmed absent on this chain (expected until authorized deploy)");
    }
}
