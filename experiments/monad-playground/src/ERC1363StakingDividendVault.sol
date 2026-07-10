// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1363Receiver} from "./StakeRewardToken.sol";

interface IStakeRewardToken {
    function transfer(address to, uint256 value) external returns (bool);
}

/// @notice Stakes a single ERC-1363 token and distributes owner-funded dividends by stake weight.
contract ERC1363StakingDividendVault is IERC1363Receiver {
    error NotOwner();
    error UnsupportedToken();
    error InvalidCallbackData();
    error NoStakers();
    error ZeroAmount();
    error InsufficientStake();
    error Reentrancy();

    uint256 internal constant ACC_REWARD_PRECISION = 1e18;
    uint8 internal constant REWARD_FUNDING = 1;

    address public immutable token;
    address public immutable owner;
    uint256 public totalStaked;
    uint256 public accRewardPerShare;

    mapping(address account => uint256) public stakedBalance;
    mapping(address account => uint256) private _rewardDebt;
    mapping(address account => uint256) private _storedPendingRewards;

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

    function onTransferReceived(address, address from, uint256 value, bytes calldata data)
        external
        nonReentrant
        returns (bytes4)
    {
        if (msg.sender != token) revert UnsupportedToken();
        if (value == 0) revert ZeroAmount();

        if (data.length == 0) {
            _stake(from, value);
        } else {
            if (data.length != 32 || abi.decode(data, (uint8)) != REWARD_FUNDING) revert InvalidCallbackData();
            if (from != owner) revert NotOwner();
            if (totalStaked == 0) revert NoStakers();

            accRewardPerShare += value * ACC_REWARD_PRECISION / totalStaked;
            emit RewardsFunded(value);
        }

        return IERC1363Receiver.onTransferReceived.selector;
    }

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

    function claim() external nonReentrant {
        _accrue(msg.sender);
        uint256 reward = _storedPendingRewards[msg.sender];
        if (reward == 0) return;

        _storedPendingRewards[msg.sender] = 0;
        emit RewardsClaimed(msg.sender, reward);
        IStakeRewardToken(token).transfer(msg.sender, reward);
    }

    function pendingRewards(address account) external view returns (uint256) {
        uint256 accumulated = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        return _storedPendingRewards[account] + accumulated - _rewardDebt[account];
    }

    function _stake(address account, uint256 amount) internal {
        _accrue(account);
        stakedBalance[account] += amount;
        totalStaked += amount;
        _rewardDebt[account] = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        emit Staked(account, amount);
    }

    function _accrue(address account) internal {
        uint256 accumulated = stakedBalance[account] * accRewardPerShare / ACC_REWARD_PRECISION;
        uint256 debt = _rewardDebt[account];
        if (accumulated > debt) _storedPendingRewards[account] += accumulated - debt;
        _rewardDebt[account] = accumulated;
    }
}
