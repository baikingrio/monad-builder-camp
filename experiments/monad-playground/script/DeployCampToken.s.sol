// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {CampToken} from "../src/CampToken.sol";

contract DeployCampToken is Script {
    function run() external {
        vm.startBroadcast();

        CampToken token = new CampToken("Camp Token", "CAMP", 1_000_000 ether);

        console2.log("CampToken deployed at:", address(token));
        console2.log("Deployer balance:", token.balanceOf(msg.sender));

        vm.stopBroadcast();
    }
}
