// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

contract RolesDeploymentManifestTest is Test {
    string internal constant MANIFEST = "vendor-manifest.roles.json";

    function testRolesManifestPinsSourceAndDrawOnlyBoundary() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonString(manifest, ".monad.chainId"), "10143");
        assertEq(
            vm.parseJsonString(manifest, ".roles.commit"), "81426d0a86309e9f84ad2d3ed4fad0725fd49a65"
        );
        assertEq(
            vm.parseJsonString(manifest, ".roles.sourceUrl"),
            "https://github.com/gnosisguild/zodiac-modifier-roles/tree/81426d0a86309e9f84ad2d3ed4fad0725fd49a65"
        );
        assertEq(vm.parseJsonString(manifest, ".drawOnly.target"), "0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.signature"), "draw()");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.selector"), "0x0eecae21");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.value"), "0");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.roleKeyLabel"), "LUCKY_DRAW");
    }

    function testRolesManifestRecordsCanonicalUpstreamAddresses() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(
            vm.parseJsonAddress(manifest, ".monad.canonicalUpstream.rolesMasterCopy"),
            0x9646fDAD06d3e24444381f44362a3B0eB343D337
        );
        assertEq(
            vm.parseJsonAddress(manifest, ".monad.canonicalUpstream.moduleProxyFactory"),
            0x000000000000aDdB49795b0f9bA5BC298cDda236
        );
    }

    function testRolesManifestRecordsStackAndSessionProofOpen() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonBool(manifest, ".deployment.permitted"), true);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.monadCodeVerified"), true);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.rolesStackPinned"), true);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.broadcastAuthorized"), true);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.onchainRolesProofPresent"), true);
        assertEq(
            vm.parseJsonString(manifest, ".deployment.sessionProof"),
            "artifacts/roles-session-proof.monad-testnet.json"
        );
    }
}
