// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeployCampaignSponsoredPaymaster} from "../script/DeployCampaignSponsoredPaymaster.s.sol";

contract DeployCampaignSponsoredPaymasterTest is Test {
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function testUsesMonadEntryPointV08() public {
        DeployCampaignSponsoredPaymaster deployer = new DeployCampaignSponsoredPaymaster();

        assertEq(deployer.ENTRY_POINT_V08(), ENTRY_POINT_V08);
    }
}
