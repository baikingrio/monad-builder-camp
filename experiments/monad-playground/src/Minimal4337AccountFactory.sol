// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Minimal4337Account} from "./Minimal4337Account.sol";

/// @notice Tiny CREATE2 factory for ERC-4337 counterfactual deployment practice.
/// @dev Learning-only factory. It lets us know an account address before the account is deployed.
contract Minimal4337AccountFactory {
    event AccountCreated(address indexed account, address indexed entryPoint, address indexed owner, bytes32 salt);

    function createAccount(address entryPoint, address owner, bytes32 salt) external returns (Minimal4337Account account) {
        address predicted = getAddress(entryPoint, owner, salt);
        if (predicted.code.length > 0) {
            return Minimal4337Account(payable(predicted));
        }

        account = new Minimal4337Account{salt: salt}(entryPoint, owner);
        emit AccountCreated(address(account), entryPoint, owner, salt);
    }

    function getAddress(address entryPoint, address owner, bytes32 salt) public view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(Minimal4337Account).creationCode, abi.encode(entryPoint, owner))
        );

        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
    }
}
