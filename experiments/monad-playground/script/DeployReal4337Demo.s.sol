// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CampaignSponsoredPaymaster} from "../src/CampaignSponsoredPaymaster.sol";
import {SessionKeyAccountFactory} from "../src/SessionKeyAccountFactory.sol";
import {SessionKeyDemoTarget} from "../src/SessionKeyDemoTarget.sol";

/// @notice Deploys the reusable contracts consumed by the browser + relay learning demo.
/// @dev Testnet only. The sponsor signer is the course account configured through PRIVATE_KEY.
contract DeployReal4337Demo is Script {
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external {
        uint256 sponsorKey = vm.envUint("PRIVATE_KEY");
        address sponsor = vm.addr(sponsorKey);

        vm.startBroadcast(sponsorKey);
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();
        SessionKeyAccountFactory sessionKeyFactory = new SessionKeyAccountFactory();
        CampaignSponsoredPaymaster paymaster = new CampaignSponsoredPaymaster(ENTRY_POINT_V08, sponsor);
        vm.stopBroadcast();

        console2.log("Sponsor", sponsor);
        console2.log("EntryPoint", ENTRY_POINT_V08);
        console2.log("SessionKeyDemoTarget", address(target));
        console2.log("SessionKeyAccountFactory", address(sessionKeyFactory));
        console2.log("CampaignSponsoredPaymaster", address(paymaster));
    }
}
