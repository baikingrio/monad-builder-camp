// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Monad Builder Camp 用的最小 ERC-4337 v0.7 风格智能账户
/// @dev 仅供学习，不可用于生产环境
contract Minimal4337Account {
    /// @dev ERC-4337 v0.7 的 UserOperation 打包结构（与 EntryPoint 接口一致）
    struct PackedUserOperation {
        address sender;              // 智能账户地址
        uint256 nonce;               // 账户 nonce，防重放
        bytes initCode;              // 若账户未部署，此处为创建代码；已部署则为空
        bytes callData;              // 发给账户的调用数据（通常编码 execute 调用）
        bytes32 accountGasLimits;    // verificationGasLimit | callGasLimit（高 128 位 | 低 128 位）
        uint256 preVerificationGas;  // 验证阶段之外的固定 gas 开销
        bytes32 gasFees;             // maxPriorityFeePerGas | maxFeePerGas
        bytes paymasterAndData;      // Paymaster 相关数据；本实验未使用
        bytes signature;             // 用户对 userOpHash 的签名
    }

    /// @dev 链上 EntryPoint 合约地址，只有它能调用 validateUserOp
    address public immutable entryPoint;
    /// @dev 账户所有者 EOA，用于离线签名授权 UserOperation
    address public immutable owner;

    event Executed(address indexed target, uint256 value, bytes data, bytes result);

    error NotAuthorized();
    error CallFailed(bytes reason);

    constructor(address _entryPoint, address _owner) payable {
        entryPoint = _entryPoint;
        owner = _owner;
    }

    /// @dev 接收原生代币，用于向 EntryPoint 预付 gas 或接收转账
    receive() external payable {}

    /// @notice 执行一笔外部调用（目标合约、金额、calldata）
    /// @dev EntryPoint 在验证通过后调用；owner 也可直接调用（便于调试）
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != entryPoint && msg.sender != owner) revert NotAuthorized();

        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert CallFailed(result);

        emit Executed(target, value, data, result);
    }

    /// @notice EntryPoint 调用的验证钩子：检查签名并补足账户押金
    /// @param userOp 待执行的 UserOperation
    /// @param userOpHash EntryPoint 计算的 operation 哈希（owner 应对其签名）
    /// @param missingAccountFunds 账户需向 EntryPoint 补足的 MON 数量
    /// @return validationData 0 = 验证通过；1 = 签名无效（符合 v0.7 约定）
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert NotAuthorized();

        validationData = _isValidSignature(userOpHash, userOp.signature) ? 0 : 1;

        // 若账户在 EntryPoint 中的押金不足，从账户余额转入 EntryPoint
        if (missingAccountFunds > 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!ok) revert CallFailed("");
        }
    }

    /// @dev 用 ecrecover 验证 owner 对 userOpHash 的 ECDSA 签名（65 字节 r|s|v）
    function _isValidSignature(bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (signature.length != 65) return false;

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return false;

        return ecrecover(digest, v, r, s) == owner;
    }
}
