// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {
    IERC165,
    IERC1363,
    IERC1363Receiver,
    StakeRewardToken
} from "../src/StakeRewardToken.sol";
import {ERC1363StakingDividendVault} from "../src/ERC1363StakingDividendVault.sol";

/// @dev 测试用接收方：记录 transferAndCall 回调参数
contract AcceptingReceiver is IERC1363Receiver {
    address public lastOperator;
    address public lastFrom;
    uint256 public lastValue;
    bytes public lastData;

    function onTransferReceived(address operator, address from, uint256 value, bytes calldata data)
        external
        returns (bytes4)
    {
        lastOperator = operator;
        lastFrom = from;
        lastValue = value;
        lastData = data;
        return IERC1363Receiver.onTransferReceived.selector;
    }
}

/// @dev 测试用拒绝接收方：返回错误 magic value，触发代币侧回滚
contract RejectingReceiver is IERC1363Receiver {
    function onTransferReceived(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return bytes4(0);
    }
}

/// @notice ERC1363StakingDividendVault 单元测试
contract ERC1363StakingDividendVaultTest is Test {
    uint256 internal constant INITIAL_SUPPLY = 1_000_000 ether;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal funder = makeAddr("funder");

    StakeRewardToken internal token;
    ERC1363StakingDividendVault internal vault;

    function setUp() public {
        token = new StakeRewardToken("Stake Reward", "SRW", INITIAL_SUPPLY);
        vault = new ERC1363StakingDividendVault(address(token));
        token.transfer(alice, 1_000 ether);
        token.transfer(bob, 1_000 ether);
        token.transfer(funder, 1_000 ether);
    }

    /// @dev 验证 StakeRewardToken 正确声明 ERC-165 / ERC-1363 接口
    function testSupportsERC165AndERC1363Interface() public view {
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
        assertTrue(token.supportsInterface(0xb0202a11));
        assertFalse(token.supportsInterface(0xffffffff));
    }

    /// @dev transferAndCall 应触发接收方回调并返回正确 magic value
    function testTransferAndCallInvokesReceiverWithMagicValue() public {
        AcceptingReceiver receiver = new AcceptingReceiver();
        bytes memory data = hex"cafe";

        vm.prank(alice);
        assertTrue(token.transferAndCall(address(receiver), 25 ether, data));

        assertEq(token.balanceOf(address(receiver)), 25 ether);
        assertEq(receiver.lastOperator(), alice);
        assertEq(receiver.lastFrom(), alice);
        assertEq(receiver.lastValue(), 25 ether);
        assertEq(receiver.lastData(), data);
    }

    /// @dev 接收方未返回 magic value 时，整笔 transferAndCall 应回滚
    function testTransferAndCallRollsBackWhenReceiverDoesNotReturnMagicValue() public {
        RejectingReceiver receiver = new RejectingReceiver();
        uint256 aliceBalance = token.balanceOf(alice);

        vm.expectRevert(StakeRewardToken.InvalidReceiverResponse.selector);
        vm.prank(alice);
        token.transferAndCall(address(receiver), 25 ether);

        assertEq(token.balanceOf(alice), aliceBalance);
        assertEq(token.balanceOf(address(receiver)), 0);
    }

    /// @dev 通过 transferAndCall（无 data）完成质押
    function testStakeFlowUsesTransferAndCall() public {
        vm.prank(alice);
        token.transferAndCall(address(vault), 100 ether);

        assertEq(vault.stakedBalance(alice), 100 ether);
        assertEq(vault.totalStaked(), 100 ether);
        assertEq(token.balanceOf(address(vault)), 100 ether);
    }

    /// @dev 分红按质押比例分配（alice 100 : bob 300 → 奖励 100 : 300），且不可重复领取
    function testProportionalRewardSplitAndNoDoubleClaim() public {
        _stake(alice, 100 ether);
        _stake(bob, 300 ether);
        _fundRewards(400 ether);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(alice);
        vault.claim();
        vm.prank(bob);
        vault.claim();

        assertEq(token.balanceOf(alice) - aliceBefore, 100 ether);
        assertEq(token.balanceOf(bob) - bobBefore, 300 ether);
        assertEq(vault.pendingRewards(alice), 0);
        assertEq(vault.pendingRewards(bob), 0);

        vm.prank(alice);
        vault.claim();
        assertEq(token.balanceOf(alice) - aliceBefore, 100 ether);
    }

    /// @dev 提现质押后，已累积但未 claim 的分红应保留
    function testWithdrawalPreservesPendingRewards() public {
        _stake(alice, 100 ether);
        _fundRewards(50 ether);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw(100 ether);

        assertEq(token.balanceOf(alice) - before, 100 ether);
        assertEq(vault.stakedBalance(alice), 0);
        assertEq(vault.pendingRewards(alice), 50 ether);

        vm.prank(alice);
        vault.claim();
        assertEq(token.balanceOf(alice) - before, 150 ether);
    }

    /// @dev 非 owner 不能通过 REWARD_FUNDING callback 注入分红
    function testUnauthorizedRewardFundingRejected() public {
        _stake(alice, 1 ether);
        uint256 funderBalance = token.balanceOf(funder);

        vm.expectRevert(ERC1363StakingDividendVault.NotOwner.selector);
        vm.prank(funder);
        token.transferAndCall(address(vault), 10 ether, abi.encode(uint8(1)));

        assertEq(token.balanceOf(funder), funderBalance);
        assertEq(token.balanceOf(address(vault)), 1 ether);
    }

    /// @dev 尚无 staker 时不允许注入分红
    function testRewardsBeforeAnyStakeAreRejected() public {
        vm.expectRevert(ERC1363StakingDividendVault.NoStakers.selector);
        token.transferAndCall(address(vault), 10 ether, abi.encode(uint8(1)));
    }

    /// @dev 非指定 token 的 transferAndCall 应被拒绝
    function testWrongTokenIsRejected() public {
        StakeRewardToken wrongToken = new StakeRewardToken("Wrong", "WRONG", 100 ether);
        uint256 balanceBefore = wrongToken.balanceOf(address(this));

        vm.expectRevert(ERC1363StakingDividendVault.UnsupportedToken.selector);
        wrongToken.transferAndCall(address(vault), 10 ether);

        assertEq(wrongToken.balanceOf(address(this)), balanceBefore);
        assertEq(wrongToken.balanceOf(address(vault)), 0);
    }

    /// @dev 辅助：模拟用户通过 transferAndCall 质押
    function _stake(address user, uint256 amount) internal {
        vm.prank(user);
        token.transferAndCall(address(vault), amount);
    }

    /// @dev 辅助：owner（测试合约自身）向金库注入分红
    function _fundRewards(uint256 amount) internal {
        token.transferAndCall(address(vault), amount, abi.encode(uint8(1)));
    }
}
