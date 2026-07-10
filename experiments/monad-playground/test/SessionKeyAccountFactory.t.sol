// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MinimalSessionKeyAccount} from "../src/MinimalSessionKeyAccount.sol";
import {SessionKeyAccountFactory} from "../src/SessionKeyAccountFactory.sol";

contract SessionKeyAccountFactoryTest is Test {
    SessionKeyAccountFactory internal factory;

    function setUp() public {
        factory = new SessionKeyAccountFactory();
    }

    function testGetAddressPredictsCreate2Deployment() public {
        address entryPoint = address(0x4337);
        address owner = address(0xA11CE);
        address sessionKey = address(0xB0B);
        address allowedTarget = address(0xCAFE);
        bytes4 allowedSelector = bytes4(keccak256("checkIn(string)"));
        uint256 validUntil = block.timestamp + 1 days;
        uint256 nativeSpendLimit = 0;
        bytes32 salt = keccak256("session-account");

        address predicted = factory.getAddress(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit, salt
        );
        assertEq(predicted.code.length, 0);

        MinimalSessionKeyAccount account = factory.createAccount(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit, salt
        );

        assertEq(address(account), predicted);
        assertGt(predicted.code.length, 0);
        assertEq(account.entryPoint(), entryPoint);
        assertEq(account.owner(), owner);
        assertEq(account.sessionKey(), sessionKey);
        assertEq(account.allowedTarget(), allowedTarget);
        assertEq(account.allowedSelector(), allowedSelector);
        assertEq(account.validUntil(), validUntil);
        assertEq(account.nativeSpendLimit(), nativeSpendLimit);
    }

    function testCreateAccountReturnsExistingDeploymentForSameConfigurationAndSalt() public {
        address entryPoint = address(0x4337);
        address owner = address(0xA11CE);
        address sessionKey = address(0xB0B);
        address allowedTarget = address(0xCAFE);
        bytes4 allowedSelector = bytes4(keccak256("checkIn(string)"));
        uint256 validUntil = block.timestamp + 1 days;
        uint256 nativeSpendLimit = 0;
        bytes32 salt = keccak256("same-session-account");

        address first = address(factory.createAccount(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit, salt
        ));
        address second = address(factory.createAccount(
            entryPoint, owner, sessionKey, allowedTarget, allowedSelector, validUntil, nativeSpendLimit, salt
        ));

        assertEq(second, first);
    }
}
