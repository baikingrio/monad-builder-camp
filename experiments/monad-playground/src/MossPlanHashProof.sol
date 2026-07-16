// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice A minimal Monad Testnet receipt for one already-simulated Moss Plan.
/// @dev This contract does not call Moss, verify a simulation, sign, or broadcast for a user.
///      Its immutable fields bind this receipt to the public, offchain MCP evidence.
contract MossPlanHashProof {
    bytes32 public immutable planHash;
    uint256 public immutable sourceChainId;
    address public immutable owner;

    bool public recorded;
    address public recorder;
    uint256 public recordedAtBlock;

    error NotOwner();
    error AlreadyRecorded();

    event PlanRecorded(
        bytes32 indexed planHash,
        uint256 indexed sourceChainId,
        address indexed recorder,
        uint256 warningCount
    );

    constructor(bytes32 _planHash, uint256 _sourceChainId) {
        planHash = _planHash;
        sourceChainId = _sourceChainId;
        owner = msg.sender;
    }

    /// @notice Record that the fixed Plan's offchain MCP simulation had zero warnings.
    /// @dev This is an attestable testnet receipt only; the caller must independently inspect the MCP evidence.
    function recordZeroWarningPlan() external {
        if (msg.sender != owner) revert NotOwner();
        if (recorded) revert AlreadyRecorded();

        recorded = true;
        recorder = msg.sender;
        recordedAtBlock = block.number;

        emit PlanRecorded(planHash, sourceChainId, msg.sender, 0);
    }
}
