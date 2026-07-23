// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {
    ConfigId,
    ISmartSessionActionPolicy,
    ISmartSessionPolicy,
    ISmartSessionUserOpPolicy,
    PackedUserOperation
} from "../src/interfaces/ISmartSessionPolicy.sol";
import {DrawOnlyActionPolicy} from "../src/policies/DrawOnlyActionPolicy.sol";
import {SessionTimeWindowPolicy} from "../src/policies/SessionTimeWindowPolicy.sol";

/// @dev A separate caller proves that policy configurations are namespaced by msg.sender.
contract DifferentMultiplexerCaller {
    function checkAction(
        ISmartSessionActionPolicy policy,
        ConfigId configId,
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (uint256) {
        return policy.checkAction(configId, account, target, value, data);
    }

    function checkUserOpPolicy(ISmartSessionUserOpPolicy policy, ConfigId configId, PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        return policy.checkUserOpPolicy(configId, userOp);
    }
}

/// @notice Local-only ABI-composition preflight; address(this) is the sole configured caller-as-multiplexer.
contract SmartSessionsPolicyAbiHarnessTest is Test {
    address internal constant ACCOUNT = address(0x2001);
    address internal constant LUCKY_DRAW = 0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70;
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;
    ConfigId internal constant CONFIG_ID = ConfigId.wrap(bytes32(uint256(1)));
    uint48 internal constant VALID_AFTER = 1_700_000_000;
    uint48 internal constant VALID_UNTIL = 1_700_003_600;
    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;

    ISmartSessionActionPolicy internal actionPolicy;
    ISmartSessionUserOpPolicy internal timePolicy;
    DifferentMultiplexerCaller internal otherMultiplexer;

    function setUp() public {
        actionPolicy = ISmartSessionActionPolicy(address(new DrawOnlyActionPolicy()));
        timePolicy = ISmartSessionUserOpPolicy(address(new SessionTimeWindowPolicy()));
        otherMultiplexer = new DifferentMultiplexerCaller();

        // This test contract is only a local ABI caller acting as the shared multiplexer namespace.
        actionPolicy.initializeWithMultiplexer(ACCOUNT, CONFIG_ID, abi.encode(LUCKY_DRAW, DRAW_SELECTOR));
        timePolicy.initializeWithMultiplexer(ACCOUNT, CONFIG_ID, abi.encode(VALID_AFTER, VALID_UNTIL));
    }

    function testLocalOnlyPreflightUsesKnownSmartSessionsV1AbiSelectors() public pure {
        assertEq(bytes32(ISmartSessionPolicy.initializeWithMultiplexer.selector), bytes32(bytes4(0x989c9e46)));
        assertEq(bytes32(ISmartSessionActionPolicy.checkAction.selector), bytes32(bytes4(0x05c00895)));
        assertEq(bytes32(ISmartSessionUserOpPolicy.checkUserOpPolicy.selector), bytes32(bytes4(0x7129edce)));
    }

    function testComposedHappyPathForSingleCallerAsMultiplexer() public {
        assertEq(
            actionPolicy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)),
            VALIDATION_SUCCESS
        );

        uint256 validationData = timePolicy.checkUserOpPolicy(CONFIG_ID, _userOp(ACCOUNT));
        (uint48 validAfter, uint48 validUntil) = _decodeValidationWindow(validationData);
        assertEq(validAfter, VALID_AFTER);
        assertEq(validUntil, VALID_UNTIL);
    }

    function testComposedSetupFailsClosedForWrongActionTargetValueAndSelector() public {
        assertEq(
            actionPolicy.checkAction(CONFIG_ID, ACCOUNT, address(0xDEAD), 0, abi.encodePacked(DRAW_SELECTOR)),
            VALIDATION_FAILED,
            "wrong target must fail"
        );
        assertEq(
            actionPolicy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 1, abi.encodePacked(DRAW_SELECTOR)),
            VALIDATION_FAILED,
            "nonzero value must fail"
        );
        assertEq(
            actionPolicy.checkAction(CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, hex"deadbeef"),
            VALIDATION_FAILED,
            "wrong selector must fail"
        );
    }

    function testDifferentCallerAsMultiplexerCannotReuseEitherConfiguration() public {
        assertEq(
            otherMultiplexer.checkAction(actionPolicy, CONFIG_ID, ACCOUNT, LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)),
            VALIDATION_FAILED
        );
        assertEq(otherMultiplexer.checkUserOpPolicy(timePolicy, CONFIG_ID, _userOp(ACCOUNT)), VALIDATION_FAILED);
    }

    function testPackedExpirySemanticsBeforeWithinAndAfterWithoutPolicyTimestampReads() public {
        uint256 validationData = timePolicy.checkUserOpPolicy(CONFIG_ID, _userOp(ACCOUNT));

        vm.warp(VALID_AFTER - 1);
        assertFalse(_isValidAt(block.timestamp, validationData));

        vm.warp(VALID_AFTER);
        assertTrue(_isValidAt(block.timestamp, validationData));
        vm.warp(VALID_UNTIL);
        assertTrue(_isValidAt(block.timestamp, validationData));

        vm.warp(VALID_UNTIL + 1);
        assertFalse(_isValidAt(block.timestamp, validationData));
    }

    // This does NOT install a SmartSession module, Safe7579 adapter, EntryPoint, paymaster, or broadcast a UserOperation.
    function _decodeValidationWindow(uint256 validationData) internal pure returns (uint48 validAfter, uint48 validUntil) {
        validUntil = uint48(validationData >> 160);
        validAfter = uint48(validationData >> 208);
    }

    function _isValidAt(uint256 timestamp, uint256 validationData) internal pure returns (bool) {
        (uint48 validAfter, uint48 validUntil) = _decodeValidationWindow(validationData);
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
