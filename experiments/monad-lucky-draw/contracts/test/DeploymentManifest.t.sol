// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

contract DeploymentManifestTest is Test {
    string internal constant MANIFEST = "vendor-manifest.safe7579.json";

    function testManifestPinsAuditedSourcesAndDrawOnlySelector() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonString(manifest, ".monad.chainId"), "10143");
        assertEq(
            vm.parseJsonString(manifest, ".safe7579.commit"), "40d92beeb423ec6a94d5667350086148df8b170c"
        );
        assertEq(
            vm.parseJsonString(manifest, ".safe7579.sourceUrl"),
            "https://github.com/rhinestonewtf/safe7579/tree/40d92beeb423ec6a94d5667350086148df8b170c"
        );
        assertEq(
            vm.parseJsonString(manifest, ".smartSessions.commit"), "dc20f0b90541ef93e88177690b0c882384896332"
        );
        assertEq(
            vm.parseJsonString(manifest, ".smartSessions.sourceUrl"),
            "https://github.com/erc7579/smartsessions/tree/dc20f0b90541ef93e88177690b0c882384896332"
        );
        assertEq(vm.parseJsonString(manifest, ".drawOnly.target"), "0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.signature"), "draw()");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.selector"), "0x0eecae21");
        assertEq(vm.parseJsonString(manifest, ".drawOnly.value"), "0");
    }

    function testManifestPinsEverySourceArtifactCreationAndRuntimeHash() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579.sourceSha256"), "1b705e938929d647aa46e47853e9dc82ce8e6a8709d8c5ae482530eeda73e082");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579.artifactSha256"), "c768004f22244b2e9fa619b930ba0ec0adb835563aa720ab7269f9f0061d6146");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579.creationKeccak256"), "0xdae0c93e44c4e64b0091d96e0d115c555589946d3001ac43b93058b4fa1d0df7");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579.runtimeKeccak256"), "0x8a96b2fdda11e5a9dcae7c3d6fb63bb69178442ce8d8c4ce5bad94525a4b6cd6");

        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579Launchpad.sourceSha256"), "1419c90ecaf83d07706cdd377de257e089efbd9637efdf65841e1889a4ca470c");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579Launchpad.artifactSha256"), "b8335bed0ee89196e2eeff5c202fdc311a5064e788eeae09673a3b5539de4fde");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579Launchpad.creationKeccak256"), "0xcecb43483f0aaaee185df96310610117118f2c74c14d78cb450819fe547808d2");
        assertEq(vm.parseJsonString(manifest, ".artifacts.safe7579Launchpad.runtimeKeccak256"), "0xe87eee7c1c0775a9f28522149998bbf51bbfe644068be930dcf858986b5cb50f");

        assertEq(vm.parseJsonString(manifest, ".artifacts.smartSession.sourceSha256"), "013b4741122eab8b4eebceebfd01bae59071df543f30619ea5c7443543b79902");
        assertEq(vm.parseJsonString(manifest, ".artifacts.smartSession.artifactSha256"), "0627bf4d72f954aa0168de4773e95571c782308cf0cb03935e4c19c417cff6ea");
        assertEq(vm.parseJsonString(manifest, ".artifacts.smartSession.creationKeccak256"), "0x995dc65f3effa975773bbac2a5c8c1ce2a2b9bd806de0ae0cf4806520da405be");
        assertEq(vm.parseJsonString(manifest, ".artifacts.smartSession.runtimeKeccak256"), "0xf2817b8943b9fc813ad3602de2f0b973dc6b7e190f1b77dc9eb02b8d3022ab0c");

        assertEq(vm.parseJsonString(manifest, ".artifacts.uniActionPolicy.sourceSha256"), "6822105d9e018b823df832f89c4973eb792bcb46b7f33afa7862ed924c4d40e5");
        assertEq(vm.parseJsonString(manifest, ".artifacts.uniActionPolicy.artifactSha256"), "b385f7a360b31f1a0e4ab36794bbebd71574317527a411478b3b6f498cfadd22");
        assertEq(vm.parseJsonString(manifest, ".artifacts.uniActionPolicy.creationKeccak256"), "0x0f0cab528f656576ec43373b64563dcae51dbf72baf6f28137fdb37417514ec9");
        assertEq(vm.parseJsonString(manifest, ".artifacts.uniActionPolicy.runtimeKeccak256"), "0xc58f13d259c69d0db90f611347535e2d5642f3352740b7d58fbf6e6b939670dd");
    }

    function testManifestRecordsEveryKnownAbsentMonadDependency() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.launchpad"), 0x75798463024Bda64D83c94A64Bc7D7eaB41300eF);
        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.adapter"), 0x7579f2AD53b01c3D8779Fe17928e0D48885B0003);
        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.smartSessionEmissary"), 0xad568B3F825A8d5FFc06DD3253526B64D810Ae89);
        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.uniActionPolicy"), 0x0000006DDA6c463511C4e9B05CFc34C1247fCF1F);
        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.timeFramePolicy"), 0x8177451511dE0577b911C254E9551D981C26dc72);
        assertEq(vm.parseJsonAddress(manifest, ".monad.knownAbsent.valueLimitPolicy"), 0xA09B47De6E510cBdC18B97E9239bEDCb44fb4901);
    }

    function testManifestBlocksDeploymentUntilAllPoliciesHaveReleaseProvenance() public view {
        string memory manifest = vm.readFile(MANIFEST);

        assertEq(vm.parseJsonBool(manifest, ".deployment.permitted"), false);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.timeFramePolicyAudited"), false);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.valueLimitPolicyAudited"), false);
        assertEq(vm.parseJsonBool(manifest, ".deployment.blockers.fullPolicyStackPinned"), false);
    }
}
