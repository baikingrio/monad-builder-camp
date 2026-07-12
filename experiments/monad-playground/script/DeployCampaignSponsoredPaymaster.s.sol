// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {CampaignSponsoredPaymaster} from "../src/CampaignSponsoredPaymaster.sol";

/// @notice Deploys only the campaign paymaster to Monad Testnet.
/// @dev The course account from PRIVATE_KEY is the immutable sponsor signer.
contract DeployCampaignSponsoredPaymaster is Script {
    address public constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external returns (CampaignSponsoredPaymaster paymaster) {
        uint256 sponsorKey = vm.envUint("PRIVATE_KEY");
        address sponsor = vm.addr(sponsorKey);

        vm.startBroadcast(sponsorKey);
        paymaster = new CampaignSponsoredPaymaster(ENTRY_POINT_V08, sponsor);
        vm.stopBroadcast();
    }
}
