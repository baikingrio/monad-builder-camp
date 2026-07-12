// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-7702 实验的最小业务目标：记录真实链上 check-in 次数。
/// @dev 不持有资产、不包含管理员权限，仅用于验证委托 EOA 的两次原子调用。
contract EIP7702CheckInTarget {
    uint256 public checkInCount;
    address public lastActor;

    event CheckedIn(address indexed actor, uint256 indexed count);

    /// @notice 每次调用递增计数，并记录实际调用者。
    function checkIn() external {
        checkInCount++;
        lastActor = msg.sender;
        emit CheckedIn(msg.sender, checkInCount);
    }
}
