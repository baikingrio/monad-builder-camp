// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CampaignSponsoredPaymaster} from "../src/CampaignSponsoredPaymaster.sol";

contract CampaignSponsoredPaymasterTest is Test {
    uint256 internal constant SPONSOR_PRIVATE_KEY = 0xA11CE;
    address internal constant ENTRY_POINT = address(0x4337);
    address internal sender = address(0xB0B);
    CampaignSponsoredPaymaster internal paymaster;

    function setUp() public {
        paymaster = new CampaignSponsoredPaymaster(ENTRY_POINT, vm.addr(SPONSOR_PRIVATE_KEY));
    }

    function testValidateAcceptsAuthorizationBoundToUserOperation() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp + 1 hours);
        op.paymasterAndData = _authorization(op, validUntil);

        vm.prank(ENTRY_POINT);
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 1 ether);

        assertEq(context.length, 0);
        assertEq(validationData, 0);
    }

    /// @dev Mirrors an off-chain sponsor: derive the digest and serialize the wire format without contract helpers.
    function testValidateAcceptsCanonicalOffChainDigestAndPaymasterAndDataWireFormat() public {
        uint128 verificationGasLimit = 0x0102030405060708090a0b0c0d0e0f10;
        uint128 postOpGasLimit = 0x1112131415161718191a1b1c1d1e1f20;
        uint48 validUntil = uint48(block.timestamp + 0x010203);
        CampaignSponsoredPaymaster.PackedUserOperation memory op = CampaignSponsoredPaymaster.PackedUserOperation({
            sender: address(0x1234567890123456789012345678901234567890),
            nonce: 0xfeedbeef,
            initCode: hex"deadbeefcafe",
            callData: hex"a9059cbb00000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000012345",
            accountGasLimits: bytes32(uint256(0xabcdef0123456789)),
            preVerificationGas: 0x123456,
            gasFees: bytes32(uint256(0x0123456789abcdef)),
            paymasterAndData: "",
            signature: ""
        });

        bytes32 digest = keccak256(
            abi.encode(
                op.sender,
                op.nonce,
                keccak256(op.initCode),
                keccak256(op.callData),
                op.accountGasLimits,
                op.preVerificationGas,
                op.gasFees,
                validUntil,
                verificationGasLimit,
                postOpGasLimit,
                block.chainid,
                address(paymaster)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SPONSOR_PRIVATE_KEY, digest);
        bytes memory wireFormat = abi.encodePacked(
            address(paymaster), verificationGasLimit, postOpGasLimit, validUntil, r, s, v
        );

        assertEq(wireFormat.length, 123);
        assertEq(address(uint160(uint256(_wordAt(wireFormat, 0)) >> 96)), address(paymaster));
        assertEq(uint128(uint256(_wordAt(wireFormat, 20)) >> 128), verificationGasLimit);
        assertEq(uint128(uint256(_wordAt(wireFormat, 36)) >> 128), postOpGasLimit);
        assertEq(uint48(uint256(_wordAt(wireFormat, 52)) >> 208), validUntil);
        assertEq(_wordAt(wireFormat, 58), r);
        assertEq(_wordAt(wireFormat, 90), s);
        assertEq(uint8(wireFormat[122]), v);

        op.paymasterAndData = wireFormat;
        vm.prank(ENTRY_POINT);
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 1 ether);

        assertEq(context.length, 0);
        assertEq(validationData, 0);
    }

    function testValidateRejectsInvalidSponsorSignature() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp + 1 hours);
        op.paymasterAndData = _authorization(op, validUntil);
        op.paymasterAndData[58] = bytes1(uint8(op.paymasterAndData[58]) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsExpiredAuthorization() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp - 1);
        op.paymasterAndData = _authorization(op, validUntil);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsTamperedCallData() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp + 1 hours);
        op.paymasterAndData = _authorization(op, validUntil);
        op.callData = hex"5678";

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsAuthorizationWithTamperedVerificationGasLimit() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp + 1 hours);
        op.paymasterAndData = _authorization(op, validUntil);
        // EntryPoint v0.8 layout: verification gas occupies bytes [20:36].
        op.paymasterAndData[35] = bytes1(uint8(op.paymasterAndData[35]) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsAuthorizationWithTamperedPostOpGasLimit() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        uint48 validUntil = uint48(block.timestamp + 1 hours);
        op.paymasterAndData = _authorization(op, validUntil);
        // EntryPoint v0.8 layout: post-operation gas occupies bytes [36:52].
        op.paymasterAndData[51] = bytes1(uint8(op.paymasterAndData[51]) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsTamperedAccountGasLimits() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        op.paymasterAndData = _authorization(op, uint48(block.timestamp + 1 hours));
        op.accountGasLimits = bytes32(uint256(op.accountGasLimits) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsTamperedPreVerificationGas() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        op.paymasterAndData = _authorization(op, uint48(block.timestamp + 1 hours));
        op.preVerificationGas += 1;

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateRejectsTamperedGasFees() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        op.paymasterAndData = _authorization(op, uint48(block.timestamp + 1 hours));
        op.gasFees = bytes32(uint256(op.gasFees) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testConstructorRejectsZeroEntryPoint() public {
        vm.expectRevert(CampaignSponsoredPaymaster.ZeroEntryPoint.selector);
        new CampaignSponsoredPaymaster(address(0), vm.addr(SPONSOR_PRIVATE_KEY));
    }

    function testConstructorRejectsZeroSponsorSigner() public {
        vm.expectRevert(CampaignSponsoredPaymaster.ZeroSponsorSigner.selector);
        new CampaignSponsoredPaymaster(ENTRY_POINT, address(0));
    }

    function testValidateRejectsSignatureWithZeroR() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        op.paymasterAndData = _authorization(op, uint48(block.timestamp + 1 hours));
        // The r component starts immediately after the 52-byte prefix and 6-byte expiry.
        for (uint256 i; i < 32; ++i) op.paymasterAndData[58 + i] = bytes1(0);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1);
    }

    function testValidateOnlyEntryPoint() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _op(hex"1234");
        op.paymasterAndData = _authorization(op, uint48(block.timestamp + 1));

        vm.expectRevert(CampaignSponsoredPaymaster.NotEntryPoint.selector);
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    function _op(bytes memory callData) internal view returns (CampaignSponsoredPaymaster.PackedUserOperation memory op) {
        op = CampaignSponsoredPaymaster.PackedUserOperation({
            sender: sender,
            nonce: 7,
            initCode: hex"123456",
            callData: callData,
            accountGasLimits: bytes32(uint256(0x000000000000000000000000000186a00000000000000000000000000030d40)),
            preVerificationGas: 50_000,
            gasFees: bytes32(uint256(0x0000000000000000000000003b9aca00000000000000000000000077359400)),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _wordAt(bytes memory data, uint256 offset) private pure returns (bytes32 word) {
        assembly ("memory-safe") {
            word := mload(add(add(data, 0x20), offset))
        }
    }

    function _authorization(CampaignSponsoredPaymaster.PackedUserOperation memory op, uint48 validUntil)
        internal
        view
        returns (bytes memory)
    {
        uint128 verificationGasLimit = 300_000;
        uint128 postOpGasLimit = 80_000;
        bytes32 digest = paymaster.authorizationDigest(
            op.sender,
            op.nonce,
            op.initCode,
            op.callData,
            op.accountGasLimits,
            op.preVerificationGas,
            op.gasFees,
            validUntil,
            verificationGasLimit,
            postOpGasLimit
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SPONSOR_PRIVATE_KEY, digest);
        return abi.encodePacked(address(paymaster), verificationGasLimit, postOpGasLimit, validUntil, r, s, v);
    }
}
