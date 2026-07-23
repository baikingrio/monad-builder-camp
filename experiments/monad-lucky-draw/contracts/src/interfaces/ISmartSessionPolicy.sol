// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Smart Sessions v1 ConfigId ABI (`bytes32`).
type ConfigId is bytes32;

/// @dev ERC-4337 v0.7 packed user operation ABI.
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

/// @dev Minimal local ABI-compatible form of Smart Sessions v1 IPolicy.
interface ISmartSessionPolicy {
    event PolicySet(ConfigId id, address multiplexer, address account);

    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @dev Minimal local ABI-compatible form of Smart Sessions v1 IActionPolicy.
interface ISmartSessionActionPolicy is ISmartSessionPolicy {
    function checkAction(ConfigId id, address account, address target, uint256 value, bytes calldata data)
        external
        returns (uint256);
}

/// @dev Minimal local ABI-compatible form of Smart Sessions v1 IUserOpPolicy.
interface ISmartSessionUserOpPolicy is ISmartSessionPolicy {
    function checkUserOpPolicy(ConfigId id, PackedUserOperation calldata userOp) external returns (uint256);
}
