// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MinimalSessionKeyAccount} from "../src/MinimalSessionKeyAccount.sol";
import {SessionKeyDemoTarget} from "../src/SessionKeyDemoTarget.sol";

contract MinimalSessionKeyAccountTest is Test {
    uint256 internal constant OWNER_KEY = 0xA11CE;
    uint256 internal constant SESSION_KEY = 0xB0B;
    bytes32 internal constant USER_OP_HASH = keccak256("session-key-user-op");

    address internal owner = vm.addr(OWNER_KEY);
    address internal sessionKey = vm.addr(SESSION_KEY);
    address internal entryPoint = address(0x4337);

    function testSessionKeyCanCallOnlyAllowedTargetAndSelector() public {
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();
        MinimalSessionKeyAccount account = _account(target, 0);

        MinimalSessionKeyAccount.PackedUserOperation memory op = _sessionOp(account, address(target), 0, _checkInData());
        op.signature = _sign(SESSION_KEY, USER_OP_HASH);

        // EntryPoint 调用 validateUserOp 时，session key 规则匹配，所以验证通过。
        vm.prank(entryPoint);
        uint256 validationData = account.validateUserOp(op, USER_OP_HASH, 0);

        assertEq(validationData, 0, "allowed session operation is valid");
        assertEq(account.nativeSpent(), 0, "zero-value check-in does not consume native spend limit");
    }

    function testSessionKeyRejectsWrongTargetOrSelector() public {
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();
        SessionKeyDemoTarget otherTarget = new SessionKeyDemoTarget();
        MinimalSessionKeyAccount account = _account(target, 0);

        MinimalSessionKeyAccount.PackedUserOperation memory wrongTarget = _sessionOp(account, address(otherTarget), 0, _checkInData());
        wrongTarget.signature = _sign(SESSION_KEY, USER_OP_HASH);

        // 同一个 session key 不能调用未授权目标合约。
        vm.prank(entryPoint);
        uint256 validationData = account.validateUserOp(wrongTarget, USER_OP_HASH, 0);
        assertEq(validationData, 1, "wrong target is rejected");

        MinimalSessionKeyAccount.PackedUserOperation memory wrongSelector = _sessionOp(account, address(target), 0, "");
        wrongSelector.signature = _sign(SESSION_KEY, USER_OP_HASH);

        // 目标合约正确但函数 selector 不匹配，也会被拒绝。
        vm.prank(entryPoint);
        validationData = account.validateUserOp(wrongSelector, USER_OP_HASH, 0);
        assertEq(validationData, 1, "wrong selector is rejected");
    }

    function testSessionKeyRespectsNativeSpendLimit() public {
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();
        MinimalSessionKeyAccount account = _account(target, 0.01 ether);

        MinimalSessionKeyAccount.PackedUserOperation memory overLimit = _sessionOp(account, address(target), 0.02 ether, _checkInData());
        overLimit.signature = _sign(SESSION_KEY, USER_OP_HASH);

        // value 超过 session key 的 nativeSpendLimit，验证失败。
        vm.prank(entryPoint);
        uint256 validationData = account.validateUserOp(overLimit, USER_OP_HASH, 0);
        assertEq(validationData, 1, "spend over limit is rejected");

        MinimalSessionKeyAccount.PackedUserOperation memory withinLimit = _sessionOp(account, address(target), 0.005 ether, _checkInData());
        withinLimit.signature = _sign(SESSION_KEY, USER_OP_HASH);

        vm.prank(entryPoint);
        validationData = account.validateUserOp(withinLimit, USER_OP_HASH, 0);
        assertEq(validationData, 0, "spend within limit is accepted");
        assertEq(account.nativeSpent(), 0.005 ether, "accepted spend is counted");
    }

    function testOwnerSignatureStillHasFullPermission() public {
        SessionKeyDemoTarget target = new SessionKeyDemoTarget();
        SessionKeyDemoTarget otherTarget = new SessionKeyDemoTarget();
        MinimalSessionKeyAccount account = _account(target, 0);

        MinimalSessionKeyAccount.PackedUserOperation memory op = _sessionOp(account, address(otherTarget), 0, _checkInData());
        op.signature = _sign(OWNER_KEY, USER_OP_HASH);

        // owner 是全权限，即使目标不在 session key 白名单中也能通过验证。
        vm.prank(entryPoint);
        uint256 validationData = account.validateUserOp(op, USER_OP_HASH, 0);
        assertEq(validationData, 0, "owner signature remains unrestricted");
    }

    function _account(SessionKeyDemoTarget target, uint256 spendLimit) internal returns (MinimalSessionKeyAccount) {
        return new MinimalSessionKeyAccount(
            entryPoint,
            owner,
            sessionKey,
            address(target),
            SessionKeyDemoTarget.checkIn.selector,
            block.timestamp + 1 days,
            spendLimit
        );
    }

    function _sessionOp(
        MinimalSessionKeyAccount account,
        address target,
        uint256 value,
        bytes memory targetCallData
    ) internal pure returns (MinimalSessionKeyAccount.PackedUserOperation memory op) {
        op = MinimalSessionKeyAccount.PackedUserOperation({
            sender: address(account),
            nonce: 0,
            initCode: "",
            callData: abi.encodeCall(MinimalSessionKeyAccount.execute, (target, value, targetCallData)),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _checkInData() internal pure returns (bytes memory) {
        return abi.encodeCall(SessionKeyDemoTarget.checkIn, ("test-check-in"));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
