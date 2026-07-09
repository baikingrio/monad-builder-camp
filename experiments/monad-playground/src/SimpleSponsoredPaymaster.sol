// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice EntryPoint v0.8 里本实验需要用到的最小接口。
interface IEntryPointDepositV08 {
    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}

/// @notice ERC-4337 sponsored UserOp 概念验证用的极简 Paymaster。
/// @dev 仅用于学习：它只赞助一个指定智能账户，不做生产级风控、签名授权或限额管理。
contract SimpleSponsoredPaymaster {
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

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    address public immutable entryPoint;
    address public immutable owner;
    address public immutable sponsoredAccount;

    event Deposited(uint256 amount);
    event SponsoredUserOp(address indexed sender, bytes32 indexed userOpHash, uint256 maxCost);
    event Withdrawn(address indexed to, uint256 amount);

    error NotEntryPoint();
    error NotOwner();

    constructor(address _entryPoint, address _owner, address _sponsoredAccount) {
        entryPoint = _entryPoint;
        owner = _owner;
        sponsoredAccount = _sponsoredAccount;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice 给 Paymaster 在 EntryPoint 里的押金账户充值。
    /// @dev sponsored UserOp 的 gas 费用不是从智能账户扣，而是从这里的 deposit 扣。
    function depositToEntryPoint() external payable onlyOwner {
        IEntryPointDepositV08(entryPoint).depositTo{value: msg.value}(address(this));
        emit Deposited(msg.value);
    }

    /// @notice 查询 Paymaster 在 EntryPoint 里的可用押金。
    function entryPointDeposit() external view returns (uint256) {
        return IEntryPointDepositV08(entryPoint).balanceOf(address(this));
    }

    /// @notice 实验结束后可由 owner 取回未使用押金。
    function withdrawDepositTo(address payable to, uint256 amount) external onlyOwner {
        IEntryPointDepositV08(entryPoint).withdrawTo(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice EntryPoint 在验证 UserOperation 时调用 Paymaster。
    /// @dev 返回 validationData = 0 表示愿意赞助；返回 1 表示拒绝赞助。
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        if (msg.sender != entryPoint) revert NotEntryPoint();

        // 本实验只赞助构造函数里指定的智能账户，避免任何账户都能消耗 Paymaster 押金。
        if (userOp.sender != sponsoredAccount) {
            return ("", 1);
        }

        // paymasterAndData 在 v0.8 中至少包含：paymaster 地址 20 bytes
        // + paymasterVerificationGasLimit 16 bytes + paymasterPostOpGasLimit 16 bytes。
        // 后面可以继续拼接业务数据，例如 campaignId、邀请人、后端签名等。
        if (userOp.paymasterAndData.length < 52) {
            return ("", 1);
        }

        emit SponsoredUserOp(userOp.sender, userOpHash, maxCost);

        // 返回空 context，表示本 demo 不需要 postOp 结算逻辑。
        // 生产 Paymaster 通常会返回 context，并在 postOp 里记录实际消耗、积分、限额等。
        return ("", 0);
    }

    /// @notice 如果 validatePaymasterUserOp 返回非空 context，EntryPoint 会在执行后回调 postOp。
    /// @dev 本 demo 返回空 context，所以正常不会进入这里；保留函数是为了展示 Paymaster 完整形状。
    function postOp(
        PostOpMode,
        bytes calldata,
        uint256,
        uint256
    ) external view {
        if (msg.sender != entryPoint) revert NotEntryPoint();
    }
}
