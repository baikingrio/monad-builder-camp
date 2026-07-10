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

contract RejectingReceiver is IERC1363Receiver {
    function onTransferReceived(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return bytes4(0);
    }
}

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

    function testSupportsERC165AndERC1363Interface() public view {
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
        assertTrue(token.supportsInterface(0xb0202a11));
        assertFalse(token.supportsInterface(0xffffffff));
    }

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

    function testTransferAndCallRollsBackWhenReceiverDoesNotReturnMagicValue() public {
        RejectingReceiver receiver = new RejectingReceiver();
        uint256 aliceBalance = token.balanceOf(alice);

        vm.expectRevert(StakeRewardToken.InvalidReceiverResponse.selector);
        vm.prank(alice);
        token.transferAndCall(address(receiver), 25 ether);

        assertEq(token.balanceOf(alice), aliceBalance);
        assertEq(token.balanceOf(address(receiver)), 0);
    }

    function testStakeFlowUsesTransferAndCall() public {
        vm.prank(alice);
        token.transferAndCall(address(vault), 100 ether);

        assertEq(vault.stakedBalance(alice), 100 ether);
        assertEq(vault.totalStaked(), 100 ether);
        assertEq(token.balanceOf(address(vault)), 100 ether);
    }

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

    function testUnauthorizedRewardFundingRejected() public {
        _stake(alice, 1 ether);
        uint256 funderBalance = token.balanceOf(funder);

        vm.expectRevert(ERC1363StakingDividendVault.NotOwner.selector);
        vm.prank(funder);
        token.transferAndCall(address(vault), 10 ether, abi.encode(uint8(1)));

        assertEq(token.balanceOf(funder), funderBalance);
        assertEq(token.balanceOf(address(vault)), 1 ether);
    }

    function testRewardsBeforeAnyStakeAreRejected() public {
        vm.expectRevert(ERC1363StakingDividendVault.NoStakers.selector);
        token.transferAndCall(address(vault), 10 ether, abi.encode(uint8(1)));
    }

    function testWrongTokenIsRejected() public {
        StakeRewardToken wrongToken = new StakeRewardToken("Wrong", "WRONG", 100 ether);
        uint256 balanceBefore = wrongToken.balanceOf(address(this));

        vm.expectRevert(ERC1363StakingDividendVault.UnsupportedToken.selector);
        wrongToken.transferAndCall(address(vault), 10 ether);

        assertEq(wrongToken.balanceOf(address(this)), balanceBefore);
        assertEq(wrongToken.balanceOf(address(vault)), 0);
    }

    function _stake(address user, uint256 amount) internal {
        vm.prank(user);
        token.transferAndCall(address(vault), amount);
    }

    function _fundRewards(uint256 amount) internal {
        token.transferAndCall(address(vault), amount, abi.encode(uint8(1)));
    }
}
