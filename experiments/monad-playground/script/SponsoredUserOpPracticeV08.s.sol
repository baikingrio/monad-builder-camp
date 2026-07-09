// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Minimal4337Account} from "../src/Minimal4337Account.sol";
import {SimpleSponsoredPaymaster} from "../src/SimpleSponsoredPaymaster.sol";

interface IEntryPointV08Sponsored {
    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32 userOpHash);
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function balanceOf(address account) external view returns (uint256);
}

/// @notice 在 Monad Testnet 上演示 ERC-4337 paymaster / sponsored UserOp。
/// @dev 场景：活动方 Paymaster 预存 gas 预算，替用户智能账户支付 UserOperation gas。
contract SponsoredUserOpPracticeV08 is Script {
    // Monad Testnet 官方 EntryPoint v0.8。
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        IEntryPointV08Sponsored entryPoint = IEntryPointV08Sponsored(ENTRY_POINT_V08);

        vm.startBroadcast(ownerKey);

        // 第一步：部署一个普通最小智能账户。
        // 这里给账户少量余额，只用于演示 callData 里的 0.001 MON 转账；gas 由 Paymaster 赞助。
        Minimal4337Account account = new Minimal4337Account{value: 0.05 ether}(ENTRY_POINT_V08, owner);

        // 第二步：部署 Paymaster，并绑定只赞助上面的 account。
        SimpleSponsoredPaymaster paymaster = new SimpleSponsoredPaymaster(ENTRY_POINT_V08, owner, address(account));

        // 第三步：活动方/项目方把 gas 预算充值到 EntryPoint 的 Paymaster deposit 中。
        // sponsored UserOp 的手续费会从这个 deposit 扣，而不是从 account 扣。
        paymaster.depositToEntryPoint{value: 0.3 ether}();

        console2.log("Owner", owner);
        console2.log("EntryPointV08", ENTRY_POINT_V08);
        console2.log("SponsoredAccount", address(account));
        console2.log("SimpleSponsoredPaymaster", address(paymaster));
        console2.log("AccountBalanceBefore", address(account).balance);
        console2.log("PaymasterDepositBefore", entryPoint.balanceOf(address(paymaster)));

        (IEntryPointV08Sponsored.PackedUserOperation memory op, bytes32 userOpHash, uint256 paymasterAndDataLength) =
            _buildSponsoredOp(entryPoint, ownerKey, address(account), address(paymaster));

        IEntryPointV08Sponsored.PackedUserOperation[] memory ops = new IEntryPointV08Sponsored.PackedUserOperation[](1);
        ops[0] = op;

        // 第四步：提交带 paymasterAndData 的 UserOperation。
        // EntryPoint 会先调用 account.validateUserOp 验 owner 签名，
        // 再调用 paymaster.validatePaymasterUserOp 判断是否愿意赞助。
        entryPoint.handleOps(ops, payable(owner));

        console2.log("AccountBalanceAfter", address(account).balance);
        console2.log("PaymasterDepositAfter", entryPoint.balanceOf(address(paymaster)));
        console2.log("EntryPointNonce", entryPoint.getNonce(address(account), 0));
        console2.log("PaymasterAndDataLength", paymasterAndDataLength);
        console2.log("UserOpHash");
        console2.logBytes32(userOpHash);

        vm.stopBroadcast();
    }

    function _buildSponsoredOp(
        IEntryPointV08Sponsored entryPoint,
        uint256 ownerKey,
        address account,
        address paymaster
    ) internal view returns (IEntryPointV08Sponsored.PackedUserOperation memory op, bytes32 userOpHash, uint256 paymasterAndDataLength) {
        address owner = vm.addr(ownerKey);

        // 本 demo 的用户动作：智能账户给 owner 转回 0.001 MON。
        // 注意：这笔 value 来自 account 余额；但 UserOp 的 gas 由 Paymaster deposit 支付。
        bytes memory callData = abi.encodeCall(Minimal4337Account.execute, (owner, 0.001 ether, ""));

        // v0.8 paymasterAndData 格式：
        // 20 bytes paymaster 地址 + 16 bytes verificationGasLimit + 16 bytes postOpGasLimit + 自定义业务数据。
        // 最后的字符串可以理解成“活动 ID / 赞助原因”，真实产品中常换成后端签名或限额凭证。
        bytes memory paymasterAndData = abi.encodePacked(
            paymaster,
            uint128(300_000),
            uint128(80_000),
            bytes("campaign-checkin-sponsored-demo")
        );

        op = IEntryPointV08Sponsored.PackedUserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account, 0),
            initCode: "",
            callData: callData,
            accountGasLimits: _packGasLimits(500_000, 140_000),
            preVerificationGas: 120_000,
            gasFees: _packGasFees(2 gwei, 100 gwei),
            paymasterAndData: paymasterAndData,
            signature: ""
        });

        // 用户仍然要签名授权 UserOperation；Paymaster 只负责赞助 gas，不替用户授权动作。
        userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);
        paymasterAndDataLength = paymasterAndData.length;
    }

    function _packGasLimits(uint128 verificationGasLimit, uint128 callGasLimit) internal pure returns (bytes32) {
        // ERC-4337 v0.7+ 把 verificationGasLimit 和 callGasLimit 打包进同一个 bytes32。
        return bytes32((uint256(verificationGasLimit) << 128) | uint256(callGasLimit));
    }

    function _packGasFees(uint128 maxPriorityFeePerGas, uint128 maxFeePerGas) internal pure returns (bytes32) {
        // gasFees 同样打包：高 128 位是 priority fee，低 128 位是 max fee。
        return bytes32((uint256(maxPriorityFeePerGas) << 128) | uint256(maxFeePerGas));
    }
}
