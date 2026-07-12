// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CampaignSponsoredPaymaster} from "../src/CampaignSponsoredPaymaster.sol";
import {MinimalSessionKeyAccount} from "../src/MinimalSessionKeyAccount.sol";
import {SessionKeyDemoTarget} from "../src/SessionKeyDemoTarget.sol";

/// @notice End-to-end proof of the off-chain Sponsor wire format consumed by the Paymaster.
/// @dev `vm.sign` deliberately models a real raw-digest Sponsor signature without using a wallet or secret file.
contract SponsorAuthorizationE2ETest is Test {
    uint256 internal constant SPONSOR_PRIVATE_KEY = 0x5A0A50;
    address internal constant ENTRY_POINT = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    address internal constant SENDER = 0x7c0343c808B827e4286381c2292d92c3f19152a4;
    address internal constant SESSION_KEY_DEMO_TARGET = 0x45CfcCa5e75474A711d077fB46bE3F77aFe31271;

    CampaignSponsoredPaymaster internal paymaster;

    function setUp() public {
        paymaster = new CampaignSponsoredPaymaster(ENTRY_POINT, vm.addr(SPONSOR_PRIVATE_KEY));
    }

    function testE2E_RealSponsorSignatureAcceptsExactCanonicalCheckInUserOp() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _canonicalUserOp();
        op.paymasterAndData = _signAuthorization(op, uint48(block.timestamp + 2 minutes));

        vm.prank(ENTRY_POINT);
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(context.length, 0, "successful validation has no post-op context");
        assertEq(validationData, 0, "raw Sponsor signature authorizes the exact UserOperation");
    }

    function testE2E_RealSponsorSignatureRejectsTamperedFee() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _canonicalUserOp();
        op.paymasterAndData = _signAuthorization(op, uint48(block.timestamp + 2 minutes));
        op.gasFees = bytes32(uint256(op.gasFees) ^ 1);

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1, "fee replacement invalidates Sponsor authorization");
    }

    function testE2E_RealSponsorSignatureRejectsTamperedCallData() public {
        CampaignSponsoredPaymaster.PackedUserOperation memory op = _canonicalUserOp();
        op.paymasterAndData = _signAuthorization(op, uint48(block.timestamp + 2 minutes));
        op.callData = abi.encodeWithSelector(
            MinimalSessionKeyAccount.execute.selector,
            SESSION_KEY_DEMO_TARGET,
            0,
            abi.encodeWithSelector(SessionKeyDemoTarget.checkIn.selector, "tampered sponsor verification")
        );

        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);

        assertEq(validationData, 1, "callData replacement invalidates Sponsor authorization");
    }

    function _canonicalUserOp() private pure returns (CampaignSponsoredPaymaster.PackedUserOperation memory op) {
        bytes memory checkInCall = abi.encodeWithSelector(SessionKeyDemoTarget.checkIn.selector, "local sponsor verification");
        op = CampaignSponsoredPaymaster.PackedUserOperation({
            sender: SENDER,
            nonce: 0,
            initCode: "",
            callData: abi.encodeWithSelector(
                MinimalSessionKeyAccount.execute.selector, SESSION_KEY_DEMO_TARGET, 0, checkInCall
            ),
            accountGasLimits: bytes32(uint256(0x00000000000000000000000000030d40000000000000000000000000061a80)),
            preVerificationGas: 50_000,
            gasFees: bytes32(uint256(0x0000000000000000000000003b9aca00000000000000000000000077359400)),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _signAuthorization(CampaignSponsoredPaymaster.PackedUserOperation memory op, uint48 validUntil)
        private
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
