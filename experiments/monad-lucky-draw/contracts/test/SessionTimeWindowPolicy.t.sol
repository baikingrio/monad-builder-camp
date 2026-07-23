// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ConfigId, PackedUserOperation} from "../src/interfaces/ISmartSessionPolicy.sol";
import {SessionTimeWindowPolicy} from "../src/policies/SessionTimeWindowPolicy.sol";

contract SessionTimeWindowPolicyTest is Test {
    address internal constant MULTIPLEXER = address(0x1001);
    address internal constant OTHER_MULTIPLEXER = address(0x1002);
    address internal constant ACCOUNT = address(0x2001);
    address internal constant OTHER_ACCOUNT = address(0x2002);
    ConfigId internal constant CONFIG_ID = ConfigId.wrap(bytes32(uint256(1)));
    ConfigId internal constant OTHER_CONFIG_ID = ConfigId.wrap(bytes32(uint256(2)));

    uint48 internal constant VALID_AFTER = 1_700_000_000;
    uint48 internal constant VALID_UNTIL = 1_700_003_600;

    SessionTimeWindowPolicy internal policy;

    function setUp() public {
        policy = new SessionTimeWindowPolicy();
        vm.prank(MULTIPLEXER);
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG_ID, abi.encode(VALID_AFTER, VALID_UNTIL));
    }

    function testReturnsV07PackedValidationDataWithoutAggregator() public {
        vm.prank(MULTIPLEXER);
        uint256 result = policy.checkUserOpPolicy(CONFIG_ID, _userOp(ACCOUNT));

        uint256 expected = (uint256(VALID_UNTIL) << 160) | (uint256(VALID_AFTER) << 208);
        assertEq(result, expected);
        assertEq(uint160(result), 0, "aggregator must be absent");
        assertEq(uint48(result >> 160), VALID_UNTIL);
        assertEq(uint48(result >> 208), VALID_AFTER);
    }

    function testValidationDataIsInvalidBeforeValidAfter() public {
        vm.warp(VALID_AFTER - 1);

        assertFalse(_isValidAt(block.timestamp, _validationData()));
    }

    function testValidationDataIsValidAtAndWithinTimeWindow() public {
        vm.warp(VALID_AFTER);
        assertTrue(_isValidAt(block.timestamp, _validationData()));

        vm.warp(VALID_AFTER + 1);
        assertTrue(_isValidAt(block.timestamp, _validationData()));

        vm.warp(VALID_UNTIL);
        assertTrue(_isValidAt(block.timestamp, _validationData()));
    }

    function testValidationDataIsInvalidAfterValidUntil() public {
        vm.warp(VALID_UNTIL + 1);

        assertFalse(_isValidAt(block.timestamp, _validationData()));
    }

    function testRejectsZeroValidUntil() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.initializeWithMultiplexer(OTHER_ACCOUNT, OTHER_CONFIG_ID, abi.encode(uint48(1), uint48(0)));
    }

    function testRejectsValidUntilEqualToValidAfter() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.initializeWithMultiplexer(OTHER_ACCOUNT, OTHER_CONFIG_ID, abi.encode(uint48(9), uint48(9)));
    }

    function testRejectsValidUntilBeforeValidAfter() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.initializeWithMultiplexer(OTHER_ACCOUNT, OTHER_CONFIG_ID, abi.encode(uint48(10), uint48(9)));
    }

    function testRejectsConfigurationFromDifferentMultiplexer() public {
        vm.prank(OTHER_MULTIPLEXER);
        vm.expectRevert();
        policy.checkUserOpPolicy(CONFIG_ID, _userOp(ACCOUNT));
    }

    function testRejectsConfigurationForDifferentAccount() public {
        vm.prank(MULTIPLEXER);
        vm.expectRevert();
        policy.checkUserOpPolicy(CONFIG_ID, _userOp(OTHER_ACCOUNT));
    }

    function testRejectsConfigurationForDifferentConfigId() public {
        vm.prank(MULTIPLEXER);
        vm.expectRevert();
        policy.checkUserOpPolicy(OTHER_CONFIG_ID, _userOp(ACCOUNT));
    }

    function _validationData() internal returns (uint256) {
        vm.prank(MULTIPLEXER);
        return policy.checkUserOpPolicy(CONFIG_ID, _userOp(ACCOUNT));
    }

    function _isValidAt(uint256 timestamp, uint256 validationData) internal pure returns (bool) {
        uint48 validUntil = uint48(validationData >> 160);
        uint48 validAfter = uint48(validationData >> 208);

        return timestamp >= validAfter && (validUntil == 0 || timestamp <= validUntil);
    }

    function _userOp(address sender) internal pure returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: sender,
            nonce: 0,
            initCode: bytes(""),
            callData: bytes(""),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }
}
