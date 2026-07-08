// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal ERC-4337 v0.7-style account for Monad Builder Camp practice.
/// @dev This is intentionally small for learning. Do not use in production.
contract Minimal4337Account {
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

    event Executed(address indexed target, uint256 value, bytes data, bytes result);

    error NotAuthorized();
    error CallFailed(bytes reason);

    constructor(address _entryPoint, address _owner) payable {
        entryPoint = _entryPoint;
        owner = _owner;
    }

    receive() external payable {}

    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != entryPoint && msg.sender != owner) revert NotAuthorized();

        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert CallFailed(result);

        emit Executed(target, value, data, result);
    }

    /// @notice ERC-4337 account validation hook called by EntryPoint.
    /// @return validationData 0 means valid; 1 means signature validation failed.
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        if (msg.sender != entryPoint) revert NotAuthorized();

        validationData = _isValidSignature(userOpHash, userOp.signature) ? 0 : 1;

        if (missingAccountFunds > 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!ok) revert CallFailed("");
        }
    }

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
