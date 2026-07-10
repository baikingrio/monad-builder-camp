// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StakeRewardToken} from "../src/StakeRewardToken.sol";
import {ERC1363StakingDividendVault} from "../src/ERC1363StakingDividendVault.sol";

/// @notice Deploys the ERC-1363 token and callback-based staking dividend vault on Monad Testnet.
/// @dev Learning-only deployment. The deployer receives the initial token supply and owns dividend funding.
contract DeployERC1363StakingDemo is Script {
    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);

        vm.startBroadcast(ownerKey);
        StakeRewardToken token = new StakeRewardToken("Stake Reward Token", "SRT", 1_000_000 ether);
        ERC1363StakingDividendVault vault = new ERC1363StakingDividendVault(address(token));
        vm.stopBroadcast();

        console2.log("Owner", owner);
        console2.log("StakeRewardToken", address(token));
        console2.log("ERC1363StakingDividendVault", address(vault));
    }
}
