// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ConfigId} from "../src/interfaces/ISmartSessionPolicy.sol";
import {DrawOnlyActionPolicy} from "../src/policies/DrawOnlyActionPolicy.sol";

contract DrawOnlyActionPolicyTest is Test {
    address internal constant LUCKY_DRAW = 0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70;
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;
    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;

    address internal constant MULTIPLEXER = address(0x1001);
    address internal constant OTHER_MULTIPLEXER = address(0x1002);
    address internal constant ACCOUNT = address(0x2001);
    address internal constant OTHER_ACCOUNT = address(0x2002);
    ConfigId internal constant CONFIG_ID = ConfigId.wrap(bytes32(uint256(1)));
    ConfigId internal constant OTHER_CONFIG_ID = ConfigId.wrap(bytes32(uint256(2)));

    DrawOnlyActionPolicy internal policy;

    function setUp() public {
        policy = new DrawOnlyActionPolicy();
        vm.prank(MULTIPLEXER);
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG_ID, abi.encode(LUCKY_DRAW, DRAW_SELECTOR));
    }

    function testPermitsExactlyLuckyDrawDrawSelectorWithZeroValueAndFourByteCalldata() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_SUCCESS);
    }

    function testRejectsWrongTarget() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, address(0xDEAD), 0, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsWrongSelector() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, hex"deadbeef");

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsNonzeroValue() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 1, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsCalldataLongerThanSelector() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR, bytes32(0)));

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsWrongInitializationTarget() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.initializeWithMultiplexer(OTHER_ACCOUNT, OTHER_CONFIG_ID, abi.encode(address(0xBEEF), DRAW_SELECTOR));
    }

    function testRejectsWrongInitializationSelector() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.initializeWithMultiplexer(OTHER_ACCOUNT, OTHER_CONFIG_ID, abi.encode(LUCKY_DRAW, bytes4(0xdeadbeef)));
    }

    function testRejectsConfigurationFromDifferentMultiplexer() public {
        vm.prank(OTHER_MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsConfigurationForDifferentAccount() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(CONFIG_ID, OTHER_ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_FAILED);
    }

    function testRejectsConfigurationForDifferentConfigId() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkAction(OTHER_CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR));

        assertEq(result, VALIDATION_FAILED);
    }
}
