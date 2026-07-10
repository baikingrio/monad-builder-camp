// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Restricted ERC-4337 paymaster for the learning-only campaign demo.
/// @dev Authorizations are signed by the immutable sponsor signer and are bound to one UserOperation's relevant fields.
contract CampaignSponsoredPaymaster {
    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    // EntryPoint v0.8 paymasterAndData prefix: paymaster (20) + verification gas (16) + postOp gas (16).
    uint256 internal constant PAYMASTER_PREFIX_LENGTH = 52;
    uint256 internal constant VALID_UNTIL_LENGTH = 6;
    uint256 internal constant SPONSOR_SIGNATURE_LENGTH = 65;
    uint256 internal constant AUTHORIZATION_LENGTH =
        PAYMASTER_PREFIX_LENGTH + VALID_UNTIL_LENGTH + SPONSOR_SIGNATURE_LENGTH;
    uint256 private constant SECP256K1N_DIV_2 =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable entryPoint;
    address public immutable sponsorSigner;

    error NotEntryPoint();

    constructor(address _entryPoint, address _sponsorSigner) {
        entryPoint = _entryPoint;
        sponsorSigner = _sponsorSigner;
    }

    /// @notice Returns the digest the restricted sponsor service must sign (not an EIP-191 prefixed message).
    function authorizationDigest(
        address sender,
        uint256 nonce,
        bytes memory initCode,
        bytes memory callData,
        uint48 validUntil
    ) public view returns (bytes32) {
        return keccak256(abi.encode(sender, nonce, keccak256(initCode), keccak256(callData), validUntil, block.chainid, address(this)));
    }

    /// @notice EntryPoint validation hook. A nonzero validationData rejects sponsorship without reverting the whole bundle.
    function validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32, uint256)
        external
        view
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        if (userOp.paymasterAndData.length != AUTHORIZATION_LENGTH) return ("", 1);

        bytes calldata paymasterAndData = userOp.paymasterAndData;
        if (address(bytes20(paymasterAndData[:20])) != address(this)) return ("", 1);

        uint48 validUntil = uint48(bytes6(paymasterAndData[PAYMASTER_PREFIX_LENGTH:PAYMASTER_PREFIX_LENGTH + VALID_UNTIL_LENGTH]));
        if (validUntil < block.timestamp) return ("", 1);

        bytes32 digest = authorizationDigest(userOp.sender, userOp.nonce, userOp.initCode, userOp.callData, validUntil);
        if (!_isValidSponsorSignature(digest, paymasterAndData[PAYMASTER_PREFIX_LENGTH + VALID_UNTIL_LENGTH:])) return ("", 1);

        return ("", 0);
    }

    function _isValidSponsorSignature(bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signature.length != SPONSOR_SIGNATURE_LENGTH) return false;

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28 || uint256(s) == 0 || uint256(s) > SECP256K1N_DIV_2) return false;

        return ecrecover(digest, v, r, s) == sponsorSigner;
    }
}
