// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IEIP7702CheckInTarget {
    function checkIn() external;
}

/// @notice 受限的 ERC-7702 委托实现：只允许指定 relayer 为已委托 EOA 执行固定两次 check-in。
/// @dev 学习用途。没有任意 target、任意 calldata 或转账入口，避免 relayer 获得 EOA 的通用资产控制权。
contract EIP7702RelayedCheckInExecutor {
    address public immutable relayer;
    address public immutable target;

    error ZeroAddress();
    error NotRelayer();

    event DemoExecuted(address indexed delegatedEoa, address indexed relayer, address indexed target);
    event NativeMonReceived(address indexed sender, uint256 amount);

    constructor(address _relayer, address _target) {
        if (_relayer == address(0) || _target == address(0)) revert ZeroAddress();
        relayer = _relayer;
        target = _target;
    }

    receive() external payable {
        emit NativeMonReceived(msg.sender, msg.value);
    }

    /// @notice 由固定 relayer 调用；代码在已委托 EOA 的上下文执行，因此 Target 观察到的 msg.sender 是该 EOA。
    /// @dev 两次调用位于同一笔交易。若其中一次失败，EVM 会回滚整笔交易。
    function runDemo() external {
        if (msg.sender != relayer) revert NotRelayer();

        IEIP7702CheckInTarget(target).checkIn();
        IEIP7702CheckInTarget(target).checkIn();

        emit DemoExecuted(address(this), msg.sender, target);
    }
}
