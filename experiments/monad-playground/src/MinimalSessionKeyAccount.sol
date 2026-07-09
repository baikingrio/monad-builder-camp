// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice 带 session key 的 ERC-4337 学习账户：owner 全权限，sessionKey 只有受限权限。
/// @dev 仅用于 Monad Builder Camp 实验；生产账户需要更完整的 nonce、权限、撤销、模块化和审计设计。
contract MinimalSessionKeyAccount {
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

    address public immutable entryPoint;
    address public immutable owner;

    // sessionKey 是临时授权密钥。它不能转移 owner 权限，只能签指定范围内的 UserOperation。
    address public immutable sessionKey;

    // 本 demo 把 session key 限制到一个目标合约和一个函数 selector。
    // 实际产品可以扩展成多条规则，例如目标白名单、函数白名单、token 限额等。
    address public immutable allowedTarget;
    bytes4 public immutable allowedSelector;

    // 到期时间与额度是 session key 最常见的两个限制：过期后失效，超过额度后失效。
    uint256 public immutable validUntil;
    uint256 public immutable nativeSpendLimit;
    uint256 public nativeSpent;

    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event SessionKeyUsed(address indexed sessionKey, address indexed target, bytes4 selector, uint256 value, uint256 spent);

    error NotAuthorized();
    error CallFailed(bytes reason);

    constructor(
        address _entryPoint,
        address _owner,
        address _sessionKey,
        address _allowedTarget,
        bytes4 _allowedSelector,
        uint256 _validUntil,
        uint256 _nativeSpendLimit
    ) payable {
        entryPoint = _entryPoint;
        owner = _owner;
        sessionKey = _sessionKey;
        allowedTarget = _allowedTarget;
        allowedSelector = _allowedSelector;
        validUntil = _validUntil;
        nativeSpendLimit = _nativeSpendLimit;
    }

    receive() external payable {}

    /// @notice 账户执行函数：EntryPoint 通过它执行 UserOperation；owner 也可以直接调用。
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != entryPoint && msg.sender != owner) revert NotAuthorized();

        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert CallFailed(result);

        emit Executed(target, value, data, result);
    }

    /// @notice ERC-4337 账户验证入口，由 EntryPoint 调用。
    /// @dev owner 签名走全权限；sessionKey 签名必须满足目标、函数、时间、额度限制。
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert NotAuthorized();

        // owner 是账户最高权限，可以执行任意 callData。
        if (_isValidSignature(userOpHash, userOp.signature, owner)) {
            _payPrefund(missingAccountFunds);
            return 0;
        }

        // sessionKey 只是临时权限，必须通过下面的受限规则。
        if (_isValidSignature(userOpHash, userOp.signature, sessionKey) && _isAllowedSessionUserOp(userOp)) {
            (address target, uint256 value, bytes memory data) = _decodeExecuteCall(userOp.callData);
            nativeSpent += value;
            emit SessionKeyUsed(sessionKey, target, _selectorOf(data), value, nativeSpent);
            _payPrefund(missingAccountFunds);
            return 0;
        }

        // validationData = 1 表示签名或权限验证失败。
        return 1;
    }

    /// @dev 若账户在 EntryPoint 中的押金不足，从账户余额向 EntryPoint 转账补足
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds > 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!ok) revert CallFailed("");
        }
    }

    /// @dev 校验 sessionKey 签名的 UserOp 是否落在授权范围内：未过期、目标合约、函数 selector、原生币额度
    function _isAllowedSessionUserOp(PackedUserOperation calldata userOp) internal view returns (bool) {
        if (block.timestamp > validUntil) return false;

        bool decoded;
        address target;
        uint256 value;
        bytes memory data;
        (decoded, target, value, data) = _tryDecodeExecuteCall(userOp.callData);
        if (!decoded) return false;
        if (target != allowedTarget) return false;
        if (_selectorOf(data) != allowedSelector) return false;
        if (nativeSpent + value > nativeSpendLimit) return false;

        return true;
    }

    /// @dev 尝试将 callData 解析为 execute(target, value, data)；非 execute 调用则 decoded = false
    function _tryDecodeExecuteCall(bytes calldata callData)
        internal
        pure
        returns (bool decoded, address target, uint256 value, bytes memory data)
    {
        if (callData.length < 4) return (false, address(0), 0, "");

        bytes4 selector;
        assembly {
            selector := calldataload(callData.offset)
        }
        if (selector != MinimalSessionKeyAccount.execute.selector) return (false, address(0), 0, "");

        (target, value, data) = abi.decode(callData[4:], (address, uint256, bytes));
        return (true, target, value, data);
    }

    /// @dev 在已确认 callData 为 execute 时，直接解码出目标地址、转账金额和内层 calldata
    function _decodeExecuteCall(bytes calldata callData) internal pure returns (address target, uint256 value, bytes memory data) {
        (, target, value, data) = _tryDecodeExecuteCall(callData);
    }

    /// @dev 从 bytes calldata 的前 4 字节提取函数 selector（内层调用的函数签名）
    function _selectorOf(bytes memory data) internal pure returns (bytes4 selector) {
        if (data.length < 4) return bytes4(0);
        assembly {
            selector := mload(add(data, 32))
        }
    }

    /// @dev 用 ecrecover 验证签名是否由 expectedSigner 对 digest 签署（65 字节 r|s|v）
    function _isValidSignature(bytes32 digest, bytes calldata signature, address expectedSigner) internal pure returns (bool) {
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

        return ecrecover(digest, v, r, s) == expectedSigner;
    }
}
