// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Minimal4337Account} from "./Minimal4337Account.sol";

/// @notice 用于 ERC-4337 counterfactual deployment 练习的极简 CREATE2 工厂。
/// @dev 仅用于学习：它的核心作用是“账户还没部署前，先算出未来账户地址”。
contract Minimal4337AccountFactory {
    event AccountCreated(address indexed account, address indexed entryPoint, address indexed owner, bytes32 salt);

    function createAccount(address entryPoint, address owner, bytes32 salt) external returns (Minimal4337Account account) {
        // CREATE2 地址只由 factory、salt、creationCode + constructor 参数决定。
        // 所以只要这些输入不变，链下/链上计算出的 predicted 都会相同。
        address predicted = getAddress(entryPoint, owner, salt);

        // 如果账户已经部署过，直接返回已有账户，避免同一个 salt 重复部署导致 revert。
        // 这让 factory.createAccount 可以安全地被重复调用。
        if (predicted.code.length > 0) {
            return Minimal4337Account(payable(predicted));
        }

        // 真正部署账户。这里使用 CREATE2（salt 参数）而不是普通 CREATE，
        // 因此部署出来的地址会等于上面 getAddress 预测出的地址。
        account = new Minimal4337Account{salt: salt}(entryPoint, owner);
        emit AccountCreated(address(account), entryPoint, owner, salt);
    }

    function getAddress(address entryPoint, address owner, bytes32 salt) public view returns (address) {
        // Minimal4337Account 的 constructor 参数也会影响最终 init code hash。
        // 如果 owner 或 entryPoint 改变，即使 salt 相同，预测地址也会改变。
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(Minimal4337Account).creationCode, abi.encode(entryPoint, owner))
        );

        // CREATE2 标准地址公式：
        // address = keccak256(0xff ++ factory ++ salt ++ keccak256(init_code))[12:]
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
    }
}
