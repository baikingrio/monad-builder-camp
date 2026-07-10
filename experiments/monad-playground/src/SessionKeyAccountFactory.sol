// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MinimalSessionKeyAccount} from "./MinimalSessionKeyAccount.sol";

/// @notice Deterministically deploys restricted session-key accounts for the ERC-4337 learning demo.
contract SessionKeyAccountFactory {
    function createAccount(
        address entryPoint,
        address owner,
        address sessionKey,
        address allowedTarget,
        bytes4 allowedSelector,
        uint256 validUntil,
        uint256 nativeSpendLimit,
        bytes32 salt
    ) external returns (MinimalSessionKeyAccount account) {
        address predicted = getAddress(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit, salt
        );
        if (predicted.code.length != 0) return MinimalSessionKeyAccount(payable(predicted));

        account = new MinimalSessionKeyAccount{salt: salt}(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit
        );
    }

    function getAddress(
        address entryPoint,
        address owner,
        address sessionKey,
        address allowedTarget,
        bytes4 allowedSelector,
        uint256 validUntil,
        uint256 nativeSpendLimit,
        bytes32 salt
    ) public view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(MinimalSessionKeyAccount).creationCode,
                abi.encode(entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit)
            )
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
