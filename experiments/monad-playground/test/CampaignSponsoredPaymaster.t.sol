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
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _authorization(CampaignSponsoredPaymaster.PackedUserOperation memory op, uint48 validUntil)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = paymaster.authorizationDigest(op.sender, op.nonce, op.initCode, op.callData, validUntil);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SPONSOR_PRIVATE_KEY, digest);
        return abi.encodePacked(address(paymaster), uint128(300_000), uint128(80_000), validUntil, r, s, v);
    }
}
