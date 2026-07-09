// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Minimal4337Account} from "../src/Minimal4337Account.sol";

/// @dev EntryPoint v0.7 最小接口（Monad / 以太坊主网通用地址）
interface IEntryPointV07 {
    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32 userOpHash);
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
}

/// @notice 部署最小 4337 账户，并构造、签名、提交一笔 UserOperation
/// @dev 完整流程：部署账户 → 组装 UserOp → owner 签名 → EntryPoint.handleOps
contract Minimal4337Practice is Script {
    /// @dev ERC-4337 EntryPoint v0.7 标准部署地址（Monad Testnet 同址）
    address internal constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        IEntryPointV07 entryPoint = IEntryPointV07(ENTRY_POINT_V07);

        vm.startBroadcast(ownerKey);

        // 1. 部署智能账户，预存 0.2 MON 作为 EntryPoint 押金来源
        Minimal4337Account account = new Minimal4337Account{value: 0.2 ether}(ENTRY_POINT_V07, owner);
        console2.log("Minimal4337Account", address(account));
        console2.log("Owner", owner);
        console2.log("EntryPoint", ENTRY_POINT_V07);

        // 2. 构造 callData：通过 UserOp 让账户向 owner 转 0.001 MON
        bytes memory callData = abi.encodeCall(Minimal4337Account.execute, (owner, 0.001 ether, ""));
        uint256 nonce = entryPoint.getNonce(address(account), 0);

        // 3. 组装 UserOperation（尚未签名）
        IEntryPointV07.PackedUserOperation memory op = IEntryPointV07.PackedUserOperation({
            sender: address(account),
            nonce: nonce,
            initCode: "",
            callData: callData,
            accountGasLimits: _packGasLimits(500_000, 120_000),
            preVerificationGas: 80_000,
            gasFees: _packGasFees(2 gwei, 100 gwei),
            paymasterAndData: "",
            signature: ""
        });

        // 4. 由 EntryPoint 计算 userOpHash，owner 离线签名后填入 op.signature
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);

        // 5. Bundler 角色：将 UserOp 提交给 EntryPoint，gas 收益给 owner
        IEntryPointV07.PackedUserOperation[] memory ops = new IEntryPointV07.PackedUserOperation[](1);
        ops[0] = op;

        entryPoint.handleOps(ops, payable(owner));
        console2.log("UserOpHash");
        console2.logBytes32(userOpHash);

        vm.stopBroadcast();
    }

    /// @dev v0.7 将 verificationGasLimit（高 128 位）与 callGasLimit（低 128 位）打包为一个 bytes32
    function _packGasLimits(uint128 verificationGasLimit, uint128 callGasLimit) internal pure returns (bytes32) {
        return bytes32((uint256(verificationGasLimit) << 128) | uint256(callGasLimit));
    }

    /// @dev v0.7 将 maxPriorityFeePerGas 与 maxFeePerGas 打包为一个 bytes32
    function _packGasFees(uint128 maxPriorityFeePerGas, uint128 maxFeePerGas) internal pure returns (bytes32) {
        return bytes32((uint256(maxPriorityFeePerGas) << 128) | uint256(maxFeePerGas));
    }
}
