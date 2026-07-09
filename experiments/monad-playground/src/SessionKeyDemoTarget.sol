// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Session key 实验用的目标合约，模拟“链上活动签到/游戏每日动作”。
contract SessionKeyDemoTarget {
    mapping(address => uint256) public checkInCount;
    mapping(address => string) public lastNote;

    event CheckedIn(address indexed account, uint256 count, string note);

    /// @notice 智能账户通过 session key 允许的函数，只记录一次简单签到。
    /// @dev 真实应用里这里可以是领取徽章、游戏动作、积分任务等低风险操作。
    function checkIn(string calldata note) external returns (uint256 count) {
        count = ++checkInCount[msg.sender];
        lastNote[msg.sender] = note;
        emit CheckedIn(msg.sender, count, note);
    }
}
