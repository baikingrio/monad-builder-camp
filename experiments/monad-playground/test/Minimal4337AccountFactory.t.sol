// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Minimal4337Account} from "../src/Minimal4337Account.sol";
import {Minimal4337AccountFactory} from "../src/Minimal4337AccountFactory.sol";

contract Minimal4337AccountFactoryTest is Test {
    function testCreate2AddressCanBeKnownBeforeDeploymentAndFunded() public {
        address entryPoint = address(0x4337);
        address owner = address(0xA11CE);
        bytes32 salt = keccak256("counterfactual-demo");
        Minimal4337AccountFactory factory = new Minimal4337AccountFactory();

        address predicted = factory.getAddress(entryPoint, owner, salt);
        assertEq(predicted.code.length, 0, "account is not deployed yet");

        vm.deal(address(this), 1 ether);
        payable(predicted).transfer(0.1 ether);
        assertEq(predicted.balance, 0.1 ether, "counterfactual address can be pre-funded");

        Minimal4337Account account = factory.createAccount(entryPoint, owner, salt);
        assertEq(address(account), predicted, "factory deploys to the predicted address");
        assertGt(predicted.code.length, 0, "account is deployed after createAccount");
        assertEq(predicted.balance, 0.1 ether, "pre-funded balance remains on the deployed account");
        assertEq(account.entryPoint(), entryPoint);
        assertEq(account.owner(), owner);
    }

    function testCreateAccountIsIdempotentForSameSalt() public {
        address entryPoint = address(0x4337);
        address owner = address(0xB0B);
        bytes32 salt = keccak256("same-account");
        Minimal4337AccountFactory factory = new Minimal4337AccountFactory();

        address first = address(factory.createAccount(entryPoint, owner, salt));
        address second = address(factory.createAccount(entryPoint, owner, salt));

        assertEq(second, first, "second call returns existing account");
    }
}
