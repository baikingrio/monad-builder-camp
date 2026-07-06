// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {CampToken} from "../src/CampToken.sol";

contract CampTokenTest is Test {
    CampToken internal token;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant INITIAL_SUPPLY = 1_000_000 ether;

    function setUp() public {
        token = new CampToken("Camp Token", "CAMP", INITIAL_SUPPLY);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Camp Token");
        assertEq(token.symbol(), "CAMP");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY);
    }

    function test_Transfer() public {
        token.transfer(alice, 100 ether);

        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY - 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_ApproveAndTransferFrom() public {
        token.approve(alice, 200 ether);

        vm.prank(alice);
        token.transferFrom(address(this), bob, 200 ether);

        assertEq(token.balanceOf(bob), 200 ether);
        assertEq(token.allowance(address(this), alice), 0);
    }
}
