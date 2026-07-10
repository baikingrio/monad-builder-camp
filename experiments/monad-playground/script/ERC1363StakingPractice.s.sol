// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StakeRewardToken} from "../src/StakeRewardToken.sol";
import {ERC1363StakingDividendVault} from "../src/ERC1363StakingDividendVault.sol";

/// @notice Executes a real ERC-1363 stake -> fund dividends -> claim learning flow on Monad Testnet.
contract ERC1363StakingPractice is Script {
    address internal constant TOKEN = 0x37AFF878FB6b6f4bdDcC6629a5Be46060f526531;
    address internal constant VAULT = 0xeF0dDBa411E5586C0B441A068EAAe77a4552B7a7;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        StakeRewardToken token = StakeRewardToken(TOKEN);
        ERC1363StakingDividendVault vault = ERC1363StakingDividendVault(VAULT);

        vm.startBroadcast(ownerKey);
        token.transferAndCall(VAULT, 100 ether, "");
        token.transferAndCall(VAULT, 20 ether, abi.encode(uint8(1)));
        vault.claim();
        vm.stopBroadcast();

        console2.log("Owner", owner);
        console2.log("StakedBalance", vault.stakedBalance(owner));
        console2.log("PendingRewards", vault.pendingRewards(owner));
        console2.log("OwnerTokenBalance", token.balanceOf(owner));
        console2.log("VaultTokenBalance", token.balanceOf(VAULT));
    }
}
