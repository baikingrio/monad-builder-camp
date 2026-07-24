// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {
    ConfigId,
    ISmartSessionActionPolicy,
    ISmartSessionUserOpPolicy,
    PackedUserOperation
} from "../src/interfaces/ISmartSessionPolicy.sol";
import {DrawOnlyActionPolicy} from "../src/policies/DrawOnlyActionPolicy.sol";
import {SessionTimeWindowPolicy} from "../src/policies/SessionTimeWindowPolicy.sol";

/// @dev Local-only multiplexer stand-in. This is NOT Rhinestone SmartSession / Safe7579 bytecode.
/// It exists so migration Task 2 rejection semantics can be proven before Monad hosts the real stack.
contract LocalDrawOnlySessionController {
    address public immutable owner;
    address public account;
    ConfigId public configId;
    ISmartSessionActionPolicy public actionPolicy;
    ISmartSessionUserOpPolicy public timePolicy;
    bool public active;

    error NotOwner();
    error Inactive();
    error AlreadyActive();

    constructor(address owner_) {
        owner = owner_;
    }

    function enable(
        address account_,
        ConfigId configId_,
        ISmartSessionActionPolicy actionPolicy_,
        ISmartSessionUserOpPolicy timePolicy_,
        bytes calldata actionInit,
        bytes calldata timeInit
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (active) revert AlreadyActive();
        account = account_;
        configId = configId_;
        actionPolicy = actionPolicy_;
        timePolicy = timePolicy_;
        actionPolicy_.initializeWithMultiplexer(account_, configId_, actionInit);
        timePolicy_.initializeWithMultiplexer(account_, configId_, timeInit);
        active = true;
    }

    /// @notice Owner-only revoke. Session key has no path into this function.
    function revoke() external {
        if (msg.sender != owner) revert NotOwner();
        active = false;
    }

    function checkAction(address target, uint256 value, bytes calldata data) external returns (uint256) {
        if (!active) revert Inactive();
        return actionPolicy.checkAction(configId, account, target, value, data);
    }

    function checkUserOp(PackedUserOperation calldata userOp) external returns (uint256) {
        if (!active) revert Inactive();
        return timePolicy.checkUserOpPolicy(configId, userOp);
    }
}

/**
 * @title DrawOnlySmartSessionTest
 * @notice Local policy-stack harness required by the Safe7579 migration plan Task 2.
 * @dev Does not deploy Safe7579, SmartSession Emissary, EntryPoint flows, or broadcast.
 *      Full on-chain enforcement still requires Monad-hosted stack + separate broadcast approval.
 */
contract DrawOnlySmartSessionTest is Test {
    address internal constant LUCKY_DRAW = 0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70;
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;
    address internal constant ACCOUNT = address(0xA11CE);
    address internal constant SESSION_KEY = address(0x5E5510);
    address internal constant PRIMARY_OWNER = address(0x0A11);
    ConfigId internal constant CONFIG_ID = ConfigId.wrap(bytes32(uint256(42)));
    uint48 internal constant VALID_AFTER = 1_800_000_000;
    uint48 internal constant VALID_UNTIL = 1_800_086_400;
    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;

    DrawOnlyActionPolicy internal actionPolicy;
    SessionTimeWindowPolicy internal timePolicy;
    LocalDrawOnlySessionController internal session;

    function setUp() public {
        actionPolicy = new DrawOnlyActionPolicy();
        timePolicy = new SessionTimeWindowPolicy();
        session = new LocalDrawOnlySessionController(PRIMARY_OWNER);

        vm.prank(PRIMARY_OWNER);
        session.enable(
            ACCOUNT,
            CONFIG_ID,
            ISmartSessionActionPolicy(address(actionPolicy)),
            ISmartSessionUserOpPolicy(address(timePolicy)),
            abi.encode(LUCKY_DRAW, DRAW_SELECTOR),
            abi.encode(VALID_AFTER, VALID_UNTIL)
        );
    }

    function testPermitsOnlyLuckyDrawTarget() public {
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
        assertEq(session.checkAction(address(0xDEAD), 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_FAILED);
    }

    function testPermitsOnlyDrawSelector() public {
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
        assertEq(session.checkAction(LUCKY_DRAW, 0, hex"deadbeef"), VALIDATION_FAILED);
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR, bytes32(uint256(1)))), VALIDATION_FAILED);
    }

    function testRejectsArbitraryTargetIndependently() public {
        assertEq(session.checkAction(address(0xBEEF), 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_FAILED);
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
    }

    function testRejectsArbitrarySelectorIndependently() public {
        assertEq(session.checkAction(LUCKY_DRAW, 0, hex"aaaaaaaa"), VALIDATION_FAILED);
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
    }

    function testRejectsNonzeroValueIndependently() public {
        assertEq(session.checkAction(LUCKY_DRAW, 1, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_FAILED);
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
    }

    function testRejectsAfterExpiry() public {
        uint256 validationData = session.checkUserOp(_userOp(ACCOUNT));
        vm.warp(VALID_UNTIL + 1);
        assertFalse(_isValidAt(block.timestamp, validationData));
    }

    function testRejectsAfterExplicitOwnerRevocation() public {
        assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);

        vm.prank(SESSION_KEY);
        vm.expectRevert(LocalDrawOnlySessionController.NotOwner.selector);
        session.revoke();

        vm.prank(PRIMARY_OWNER);
        session.revoke();

        vm.expectRevert(LocalDrawOnlySessionController.Inactive.selector);
        session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR));
    }

    function testAllowsRepeatedValidDrawCallsWithoutCountCap() public {
        for (uint256 i = 0; i < 25; i++) {
            assertEq(session.checkAction(LUCKY_DRAW, 0, abi.encodePacked(DRAW_SELECTOR)), VALIDATION_SUCCESS);
            uint256 validationData = session.checkUserOp(_userOp(ACCOUNT));
            vm.warp(VALID_AFTER + uint48(i));
            assertTrue(_isValidAt(block.timestamp, validationData));
        }
    }

    function testPrimaryOwnerCanRevokeWithoutGivingSessionKeyAdminPath() public {
        assertEq(session.owner(), PRIMARY_OWNER);
        assertTrue(session.active());

        vm.prank(SESSION_KEY);
        vm.expectRevert(LocalDrawOnlySessionController.NotOwner.selector);
        session.enable(
            ACCOUNT,
            CONFIG_ID,
            ISmartSessionActionPolicy(address(actionPolicy)),
            ISmartSessionUserOpPolicy(address(timePolicy)),
            abi.encode(LUCKY_DRAW, DRAW_SELECTOR),
            abi.encode(VALID_AFTER, VALID_UNTIL)
        );

        vm.prank(PRIMARY_OWNER);
        session.revoke();
        assertFalse(session.active());
    }

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
