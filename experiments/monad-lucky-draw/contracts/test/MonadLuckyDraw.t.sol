// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonadLuckyDraw} from "../src/MonadLuckyDraw.sol";

interface LuckyDrawValueCaller {
    function draw() external payable returns (uint8);
}

contract MonadLuckyDrawTest is Test {
    event CardDrawn(address indexed player, uint256 indexed drawNumber, uint8 rarity);

    MonadLuckyDraw internal draw;
    address internal constant PLAYER = address(0xA11CE);
    address internal constant OTHER_PLAYER = address(0xB0B);

    function setUp() public {
        draw = new MonadLuckyDraw();
    }

    function testDrawEmitsExpectedEventIncrementsCountAndReturnsRarity() public {
        vm.prevrandao(bytes32(uint256(123)));
        uint8 expectedRarity = uint8(uint256(keccak256(abi.encode(PLAYER, 1, block.prevrandao))) % 3);

        vm.expectEmit(true, true, false, true, address(draw));
        emit CardDrawn(PLAYER, 1, expectedRarity);

        vm.prank(PLAYER);
        uint8 rarity = draw.draw();

        assertEq(draw.drawCount(PLAYER), 1);
        assertEq(rarity, expectedRarity);
        assertLe(rarity, 2);
    }

    function testDrawWithNativeValueReverts() public {
        vm.deal(PLAYER, 1 wei);
        vm.prank(PLAYER);
        vm.expectRevert();
        LuckyDrawValueCaller(address(draw)).draw{value: 1 wei}();
    }

    function testMultipleCallersAndDrawsStayBoundedAndIndependent() public {
        vm.prevrandao(bytes32(uint256(1)));
        vm.prank(PLAYER);
        uint8 firstPlayerDraw = draw.draw();

        vm.prevrandao(bytes32(uint256(2)));
        vm.prank(OTHER_PLAYER);
        uint8 otherPlayerDraw = draw.draw();

        vm.prevrandao(bytes32(uint256(3)));
        vm.prank(PLAYER);
        uint8 secondPlayerDraw = draw.draw();

        assertLe(firstPlayerDraw, 2);
        assertLe(otherPlayerDraw, 2);
        assertLe(secondPlayerDraw, 2);
        assertEq(draw.drawCount(PLAYER), 2);
        assertEq(draw.drawCount(OTHER_PLAYER), 1);
    }
}
