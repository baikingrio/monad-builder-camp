// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Read-only verifier for the planned Zodiac Roles stack on Monad Testnet.
/// @dev Confirms canonical upstream addresses have empty code (expected until authorized deploy)
///      and that deployment.permitted remains false.
contract VerifyRolesStack is Script {
    using stdJson for string;

    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external view {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "VerifyRolesStack: chainId must be 10143");

        string memory manifest = vm.readFile("./vendor-manifest.roles.json");
        bool permitted = manifest.readBool(".deployment.permitted");
        console2.log("deployment.permitted", permitted);
        require(permitted == false, "VerifyRolesStack: unexpected permitted=true");

        _logCode("rolesMasterCopy", manifest.readAddress(".monad.canonicalUpstream.rolesMasterCopy"));
        _logCode("moduleProxyFactory", manifest.readAddress(".monad.canonicalUpstream.moduleProxyFactory"));
        _logCode("integrity", manifest.readAddress(".monad.canonicalUpstream.integrity"));
        _logCode("packer", manifest.readAddress(".monad.canonicalUpstream.packer"));

        console2.log("roles commit");
        console2.log(manifest.readString(".roles.commit"));
        console2.log("VerifyRolesStack complete: no secrets printed");
    }

    function _logCode(string memory label, address target) internal view {
        uint256 codeLen = target.code.length;
        console2.log(label, target);
        console2.log("  codeLength", codeLen);
    }
}
