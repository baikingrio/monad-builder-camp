// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MinimalSessionKeyAccount} from "../src/MinimalSessionKeyAccount.sol";
import {SessionKeyDemoTarget} from "../src/SessionKeyDemoTarget.sol";

interface IEntryPointV08SessionKey {
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
}

/// @notice 在 Monad Testnet 上演示 ERC-4337 session key / 受限权限。
/// @dev 场景：owner 给游戏/活动前端一个临时 session key，只能调用指定合约的 checkIn。
contract SessionKeyPracticeV08 is Script {
    // Monad Testnet 官方 EntryPoint v0.8。
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    // demo session key：为了可复现实验，用固定字符串派生。生产环境必须使用真正随机、安全保存、可撤销的密钥。
    uint256 internal constant SESSION_KEY = uint256(keccak256("monad-builder-camp-session-key-demo-v1"));

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        address sessionKey = vm.addr(SESSION_KEY);
        IEntryPointV08SessionKey entryPoint = IEntryPointV08SessionKey(ENTRY_POINT_V08);

        vm.startBroadcast(ownerKey);

        // 第一步：部署一个低风险目标合约，模拟“活动签到 / 游戏每日动作”。
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();

        // 第二步：部署带 session key 的智能账户。
        // 这个 session key 只能调用 target.checkIn，不能转账到任意地址，也不能调用其他函数。
        MinimalSessionKeyAccount account = new MinimalSessionKeyAccount{value: 0.12 ether}(
            ENTRY_POINT_V08,
            owner,
            sessionKey,
            address(target),
            SessionKeyDemoTarget.checkIn.selector,
            block.timestamp + 1 days,
            0
        );

        console2.log("Owner", owner);
        console2.log("SessionKey", sessionKey);
        console2.log("EntryPointV08", ENTRY_POINT_V08);
        console2.log("SessionKeyAccount", address(account));
        console2.log("SessionTarget", address(target));
        console2.log("AllowedSelector");
        console2.logBytes4(SessionKeyDemoTarget.checkIn.selector);
        console2.log("ValidUntil", account.validUntil());
        console2.log("NativeSpendLimit", account.nativeSpendLimit());
        console2.log("AccountBalanceBefore", address(account).balance);

        (IEntryPointV08SessionKey.PackedUserOperation memory op, bytes32 userOpHash) =
            _buildSessionKeyOp(entryPoint, SESSION_KEY, address(account), address(target));

        IEntryPointV08SessionKey.PackedUserOperation[] memory ops = new IEntryPointV08SessionKey.PackedUserOperation[](1);
        ops[0] = op;

        // 第三步：这次 UserOperation 不是 owner 签名，而是 session key 签名。
        // 账户 validateUserOp 会检查签名者是 sessionKey，并验证目标/函数/有效期/额度是否符合限制。
        entryPoint.handleOps(ops, payable(owner));

        console2.log("EntryPointNonce", entryPoint.getNonce(address(account), 0));
        console2.log("CheckInCount", target.checkInCount(address(account)));
        console2.log("NativeSpent", account.nativeSpent());
        console2.log("AccountBalanceAfter", address(account).balance);
        console2.log("UserOpHash");
        console2.logBytes32(userOpHash);

        vm.stopBroadcast();
    }

    function _buildSessionKeyOp(
        IEntryPointV08SessionKey entryPoint,
        uint256 sessionKey,
        address account,
        address target
    ) internal view returns (IEntryPointV08SessionKey.PackedUserOperation memory op, bytes32 userOpHash) {
        // session key 被允许执行的业务动作：调用目标合约 checkIn("session-key-demo")。
        bytes memory targetCallData = abi.encodeCall(SessionKeyDemoTarget.checkIn, ("session-key-demo"));

        // UserOperation 的 callData 仍然是账户的 execute；受限逻辑在账户 validateUserOp 中解析并校验。
        bytes memory accountCallData = abi.encodeCall(MinimalSessionKeyAccount.execute, (target, 0, targetCallData));

        op = IEntryPointV08SessionKey.PackedUserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account, 0),
            initCode: "",
            callData: accountCallData,
            accountGasLimits: _packGasLimits(600_000, 180_000),
            preVerificationGas: 100_000,
            gasFees: _packGasFees(2 gwei, 100 gwei),
            paymasterAndData: "",
            signature: ""
        });

        // 这里用 session key 签名，而不是 owner key；这就是“临时授权”的核心。
        userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);
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
