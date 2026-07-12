// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {EIP7702CheckInTarget} from "../src/EIP7702CheckInTarget.sol";
import {EIP7702RelayedCheckInExecutor} from "../src/EIP7702RelayedCheckInExecutor.sol";

/// @notice 在 Monad Testnet 完成真实 ERC-7702 委托 + relayer 批量 check-in 的学习脚本。
/// @dev 交易顺序：课程 EOA 部署目标/实现并资助 relayer；relayer 发送 type-0x04 交易，携带课程 EOA 的委托授权。
contract DeployRelayedEIP7702Demo is Script {
    uint256 internal constant RELAYER_INITIAL_GAS_BUDGET = 0.2 ether;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        uint256 relayerKey = vm.envUint("EIP7702_RELAYER_PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        address relayer = vm.addr(relayerKey);

        // 第一步：课程 EOA 仍未委托，部署只含固定两次 check-in 的目标和执行器。
        vm.startBroadcast(ownerKey);
        EIP7702CheckInTarget target = new EIP7702CheckInTarget();
        EIP7702RelayedCheckInExecutor executor = new EIP7702RelayedCheckInExecutor(relayer, address(target));

        // 第二步：只给本地 relayer 一小笔测试 MON 作为 type-0x04 交易 Gas；不会交给前端。
        payable(relayer).transfer(RELAYER_INITIAL_GAS_BUDGET);
        vm.stopBroadcast();

        // 第三步：课程 EOA 签署链绑定的委托授权；relay 账户支付 Gas 并提交 type-0x04 交易。
        // 不能使用 crossChain 授权；该 Demo 只针对 Monad Testnet（chain ID 10143）。
        vm.signAndAttachDelegation(address(executor), ownerKey);
        vm.broadcast(relayerKey);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();

        console2.log("DelegatedEOA", owner);
        console2.log("Relayer", relayer);
        console2.log("EIP7702CheckInTarget", address(target));
        console2.log("EIP7702RelayedCheckInExecutor", address(executor));
    }
}
