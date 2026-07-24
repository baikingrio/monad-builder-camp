// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Dry-run only. Aborts unless Monad chainId is 10143 and never starts broadcast.
/// @dev Reads vendor-manifest.roles.json; refuses broadcast without ROLES_ALLOW_BROADCAST + permitted.
contract DeployRolesStack is Script {
    using stdJson for string;

    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external view {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "DeployRolesStack: chainId must be 10143");
        require(!_broadcastRequested(), "DeployRolesStack: broadcast is forbidden without explicit approval");

        string memory manifest = vm.readFile("./vendor-manifest.roles.json");
        require(manifest.readBool(".deployment.permitted") == false, "DeployRolesStack: deployment.permitted must stay false");

        address masterCopy = manifest.readAddress(".monad.canonicalUpstream.rolesMasterCopy");
        address factory = manifest.readAddress(".monad.canonicalUpstream.moduleProxyFactory");

        _logPresence("rolesMasterCopy", masterCopy);
        _logPresence("moduleProxyFactory", factory);

        console2.log("DeployRolesStack dry-run OK");
        console2.log("chainId", block.chainid);
        console2.log("deployment.permitted remains false; no contracts were deployed");
    }

    function _broadcastRequested() internal view returns (bool) {
        try vm.envBool("ROLES_ALLOW_BROADCAST") returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }

    function _logPresence(string memory label, address target) internal view {
        bytes memory code = target.code;
        if (code.length == 0) {
            console2.log(label, "absent on this chain (expected until authorized deploy)");
        } else {
            console2.log(label, "already has bytecode; reuse requires separate review");
        }
    }
}
