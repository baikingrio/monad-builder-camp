// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title MonadLuckyDraw
/// @notice A learning-only card draw for Monad Testnet demonstrations.
/// @dev This pseudo-randomness is manipulable and demo-only; it is not production randomness.
contract MonadLuckyDraw {
    event CardDrawn(address indexed player, uint256 indexed drawNumber, uint8 rarity);

    mapping(address player => uint256 count) public drawCount;

    /// @notice Draw a demo card rarity from 0 through 2.
    /// @dev Uses manipulable block data and must not be used for production randomness.
    function draw() external returns (uint8 rarity) {
        uint256 drawNumber = ++drawCount[msg.sender];
        rarity = uint8(uint256(keccak256(abi.encode(msg.sender, drawNumber, block.prevrandao))) % 3);

        emit CardDrawn(msg.sender, drawNumber, rarity);
    }
}
