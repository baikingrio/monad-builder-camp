// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SimpleSponsoredPaymaster} from "../src/SimpleSponsoredPaymaster.sol";

contract MockEntryPointDeposit {
    mapping(address => uint256) public balanceOf;

    function depositTo(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        balanceOf[msg.sender] -= withdrawAmount;
        withdrawAddress.transfer(withdrawAmount);
    }
}

contract SimpleSponsoredPaymasterTest is Test {
    bytes32 internal constant DEMO_USER_OP_HASH = keccak256("userOp");

    function testDepositToEntryPointFundsPaymasterBudget() public {
        address owner = address(0xA11CE);
        address account = address(0x4337);
        MockEntryPointDeposit entryPoint = new MockEntryPointDeposit();
        SimpleSponsoredPaymaster paymaster = new SimpleSponsoredPaymaster(address(entryPoint), owner, account);

        vm.deal(owner, 1 ether);
        vm.prank(owner);
        paymaster.depositToEntryPoint{value: 0.2 ether}();

        assertEq(entryPoint.balanceOf(address(paymaster)), 0.2 ether, "deposit pays future sponsored gas");
        assertEq(paymaster.entryPointDeposit(), 0.2 ether, "paymaster reports EntryPoint deposit");
    }

    function testValidateAcceptsOnlySponsoredAccount() public {
        address owner = address(0xA11CE);
        address sponsoredAccount = address(0xCAFE);
        MockEntryPointDeposit entryPoint = new MockEntryPointDeposit();
        SimpleSponsoredPaymaster paymaster = new SimpleSponsoredPaymaster(address(entryPoint), owner, sponsoredAccount);

        SimpleSponsoredPaymaster.PackedUserOperation memory op = _op(sponsoredAccount, address(paymaster));

        // validatePaymasterUserOp 只能由 EntryPoint 调用；被赞助账户匹配时 validationData = 0。
        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(op, DEMO_USER_OP_HASH, 1 ether);

        assertEq(context.length, 0, "demo returns empty postOp context");
        assertEq(validationData, 0, "sponsored account is accepted");

        // 其他账户不能随便消耗 Paymaster 的 deposit，应该被拒绝赞助。
        op.sender = address(0xBEEF);
        vm.prank(address(entryPoint));
        (, validationData) = paymaster.validatePaymasterUserOp(op, DEMO_USER_OP_HASH, 1 ether);
        assertEq(validationData, 1, "non-sponsored account is rejected");
    }

    function testValidateRejectsShortPaymasterAndDataAndNonEntryPointCaller() public {
        address owner = address(0xA11CE);
        address sponsoredAccount = address(0xCAFE);
        MockEntryPointDeposit entryPoint = new MockEntryPointDeposit();
        SimpleSponsoredPaymaster paymaster = new SimpleSponsoredPaymaster(address(entryPoint), owner, sponsoredAccount);

        SimpleSponsoredPaymaster.PackedUserOperation memory op = _op(sponsoredAccount, address(paymaster));
        op.paymasterAndData = abi.encodePacked(address(paymaster));

        // v0.8 至少需要 paymaster 地址 + 两个 gas limit；长度不足时拒绝。
        vm.prank(address(entryPoint));
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, DEMO_USER_OP_HASH, 1 ether);
        assertEq(validationData, 1, "short paymasterAndData is rejected");

        // 不是 EntryPoint 的直接调用应该 revert，避免外部随意伪造验证流程。
        vm.expectRevert(SimpleSponsoredPaymaster.NotEntryPoint.selector);
        paymaster.validatePaymasterUserOp(op, DEMO_USER_OP_HASH, 1 ether);
    }

    function _op(address sender, address paymaster) internal pure returns (SimpleSponsoredPaymaster.PackedUserOperation memory op) {
        op = SimpleSponsoredPaymaster.PackedUserOperation({
            sender: sender,
            nonce: 0,
            initCode: "",
            callData: "",
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            // paymasterAndData = paymaster 地址 + verificationGasLimit + postOpGasLimit + demo data。
            paymasterAndData: abi.encodePacked(paymaster, uint128(300_000), uint128(80_000), bytes("demo")),
            signature: ""
        });
    }
}
