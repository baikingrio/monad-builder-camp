// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MossPlanHashProof} from "../src/MossPlanHashProof.sol";

contract MossPlanHashProofTest is Test {
    bytes32 internal constant PLAN_HASH = 0xd79ace0ec5ac5e8f53b8a5ea96d500db16e405c40c82d8e190fd39ac25915fcf;
    uint256 internal constant MOSS_MAINNET_CHAIN_ID = 143;

    address internal owner = makeAddr("owner");
    address internal other = makeAddr("other");
    MossPlanHashProof internal proof;

    function setUp() external {
        vm.prank(owner);
        proof = new MossPlanHashProof(PLAN_HASH, MOSS_MAINNET_CHAIN_ID);
    }

    function test_ownerRecordsTheExactPlanHashAfterZeroWarningSimulation() external {
        vm.expectEmit(true, true, true, true, address(proof));
        emit MossPlanHashProof.PlanRecorded(PLAN_HASH, MOSS_MAINNET_CHAIN_ID, owner, 0);

        vm.prank(owner);
        proof.recordZeroWarningPlan();

        assertTrue(proof.recorded());
        assertEq(proof.recorder(), owner);
        assertEq(proof.recordedAtBlock(), block.number);
        assertEq(proof.planHash(), PLAN_HASH);
        assertEq(proof.sourceChainId(), MOSS_MAINNET_CHAIN_ID);
    }

    function test_nonOwnerCannotCreateTheProofRecord() external {
        vm.expectRevert(MossPlanHashProof.NotOwner.selector);
        vm.prank(other);
        proof.recordZeroWarningPlan();
    }

    function test_recordingCannotBeRepeated() external {
        vm.prank(owner);
        proof.recordZeroWarningPlan();

        vm.expectRevert(MossPlanHashProof.AlreadyRecorded.selector);
        vm.prank(owner);
        proof.recordZeroWarningPlan();
    }
}
