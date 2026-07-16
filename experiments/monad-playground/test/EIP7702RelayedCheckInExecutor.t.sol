// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EIP7702CheckInTarget} from "../src/EIP7702CheckInTarget.sol";
import {EIP7702RelayedCheckInExecutor} from "../src/EIP7702RelayedCheckInExecutor.sol";

contract EIP7702RelayedCheckInExecutorTest is Test {
    uint256 internal constant OWNER_KEY = 0x7702;
    address internal owner = vm.addr(OWNER_KEY);
    address internal relayer = makeAddr("erc7702-relayer");
    address internal stranger = makeAddr("stranger");

    EIP7702CheckInTarget internal target;
    EIP7702RelayedCheckInExecutor internal executor;

    function setUp() public {
        target = new EIP7702CheckInTarget();
        executor = new EIP7702RelayedCheckInExecutor(relayer, address(target));
    }

    function testAuthorizedRelayerExecutesTwoRealCallsForDelegatedEoa() public {
        vm.prank(relayer);
        vm.signAndAttachDelegation(address(executor), OWNER_KEY);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();

        assertEq(target.checkInCount(), 2, "the delegated EOA executes the two fixed check-ins");
        assertEq(target.lastActor(), owner, "the target sees the delegated EOA as msg.sender");
    }

    function testDelegatedEoaAcceptsNativeMon() public {
        vm.prank(relayer);
        vm.signAndAttachDelegation(address(executor), OWNER_KEY);

        vm.deal(relayer, 1 ether);
        uint256 balanceBefore = owner.balance;

        (bool accepted,) = payable(owner).call{value: 0.1 ether}("");

        assertTrue(accepted, "the delegated EOA must accept a plain native MON transfer");
        assertEq(owner.balance, balanceBefore + 0.1 ether);
    }

    function testUnauthorizedCallerCannotTriggerDelegatedEoa() public {
        vm.prank(relayer);
        vm.signAndAttachDelegation(address(executor), OWNER_KEY);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();

        vm.expectRevert(EIP7702RelayedCheckInExecutor.NotRelayer.selector);
        vm.prank(stranger);
        EIP7702RelayedCheckInExecutor(payable(owner)).runDemo();
    }
}
