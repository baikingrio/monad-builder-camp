// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1363Receiver} from "./StakeRewardToken.sol";

/// @dev 质押代币的最小接口，用于 withdraw / claim 时把代币转回用户
interface IStakeRewardToken {
    function transfer(address to, uint256 value) external returns (bool);
}

/// @notice 基于 ERC-1363 的单代币质押分红金库
/// @dev 用户通过 transferAndCall 质押；owner 通过带 callback data 的 transferAndCall 注入分红
///      奖励按 stake 权重分配，采用 accRewardPerShare 累积精度算法
contract ERC1363StakingDividendVault is IERC1363Receiver {
    error NotOwner();
    error UnsupportedToken();
    error InvalidCallbackData();
    error NoStakers();
    error ZeroAmount();
    error InsufficientStake();
    error Reentrancy();

    /// @dev 累积每份额奖励的精度因子，避免整数除法精度损失
    uint256 internal constant ACC_REWARD_PRECISION = 1e18;
    /// @dev callback data 中标识「注入分红」的 uint8 常量
    uint8 internal constant REWARD_FUNDING = 1;

    /// @dev 唯一支持的质押 / 分红代币（ERC-1363）
    address public immutable token;
    /// @dev 金库创建者，有权注入分红
    address public immutable owner;
    /// @dev 当前总质押量
    uint256 public totalStaked;
    /// @dev 累积每 1 份额代币应得的分红（已乘以 ACC_REWARD_PRECISION）
    uint256 public accRewardPerShare;

    /// @dev 各账户质押余额
    mapping(address account => uint256) public stakedBalance;
    /// @dev 各账户已结算的奖励债务，用于计算 pending = accumulated - debt
    mapping(address account => uint256) private _rewardDebt;
    /// @dev 各账户已累积但尚未 claim 的分红
    mapping(address account => uint256) private _storedPendingRewards;

    /// @dev 简易重入锁状态：1 = 未锁定，2 = 已锁定
    uint256 private _unlocked = 1;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardsFunded(uint256 amount);
    event RewardsClaimed(address indexed account, uint256 amount);

    constructor(address token_) {
        if (token_ == address(0)) revert UnsupportedToken();
        token = token_;
        owner = msg.sender;
    }

    modifier nonReentrant() {
        if (_unlocked != 1) revert Reentrancy();
        _unlocked = 2;
        _;
        _unlocked = 1;
    }

    /// @notice ERC-1363 回调入口：根据 data 区分「质押」或「注入分红」
    /// @param from 转账发起方（质押时为 staker，分红时为 owner）
    /// @param value 转入代币数量
    /// @param data 空 = 质押；`abi.encode(uint8(1))` = owner 注入分红
    function onTransferReceived(address, address from, uint256 value, bytes calldata data)
        external
        nonReentrant
        returns (bytes4)
    {
        if (msg.sender != token) revert UnsupportedToken();
        if (value == 0) revert ZeroAmount();

        if (data.length == 0) {
            // 普通 transferAndCall：视为质押
            _stake(from, value);
        } else {
            // 带 REWARD_FUNDING 标记：owner 向全体 staker 按权重注入分红
            if (data.length != 32 || abi.decode(data, (uint8)) != REWARD_FUNDING) revert InvalidCallbackData();
            if (from != owner) revert NotOwner();
            if (totalStaked == 0) revert NoStakers();

            accRewardPerShare += value * ACC_REWARD_PRECISION / totalStaked;
            emit RewardsFunded(value);
        }

        return IERC1363Receiver.onTransferReceived.selector;
    }

    /// @notice 取回质押代币；会先结算 pending 奖励，再更新 rewardDebt
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 stake = stakedBalance[msg.sender];
        if (stake < amount) revert InsufficientStake();

        _accrue(msg.sender);
        unchecked {
            stakedBalance[msg.sender] = stake - amount;
            totalStaked -= amount;
        }
        _rewardDebt[msg.sender] = stakedBalance[msg.sender] * accRewardPerShare / ACC_REWARD_PRECISION;

        emit Withdrawn(msg.sender, amount);
        IStakeRewardToken(token).transfer(msg.sender, amount);
    }

    /// @notice 领取已累积的分红代币
    function claim() external nonReentrant {
        _accrue(msg.sender);
        uint256 reward = _storedPendingRewards[msg.sender];
        if (reward == 0) return;

        _storedPendingRewards[msg.sender] = 0;
        emit RewardsClaimed(msg.sender, reward);
        IStakeRewardToken(token).transfer(msg.sender, reward);
    }

    /// @notice 查询账户当前可领取的分红（含已存储 + 未结算部分）
    function pendingRewards(address account) external view returns (uint256) {
        uint256 accumulated = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        return _storedPendingRewards[account] + accumulated - _rewardDebt[account];
    }

    /// @dev 增加账户质押量，并同步更新 rewardDebt
    function _stake(address account, uint256 amount) internal {
        _accrue(account);
        stakedBalance[account] += amount;
        totalStaked += amount;
        _rewardDebt[account] = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        emit Staked(account, amount);
    }

    /// @dev 将自上次结算以来应得的分红写入 _storedPendingRewards，并刷新 rewardDebt
    function _accrue(address account) internal {
        uint256 accumulated = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        uint256 debt = _rewardDebt[account];
        if (accumulated > debt) _storedPendingRewards[account] += accumulated - debt;
        _rewardDebt[account] = accumulated;
    }
}
