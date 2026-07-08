// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Minimal4337Account} from "../src/Minimal4337Account.sol";

interface IEntryPointV08 {
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

/// @notice Deploys a minimal ERC-4337 account and sends one UserOperation through EntryPoint v0.8.
/// @dev Uses Monad Testnet official EntryPoint v0.8. This is learning-only and not production-safe.
contract Minimal4337PracticeV08 is Script {
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        IEntryPointV08 entryPoint = IEntryPointV08(ENTRY_POINT_V08);

        vm.startBroadcast(ownerKey);

        Minimal4337Account account = new Minimal4337Account{value: 0.2 ether}(ENTRY_POINT_V08, owner);
        console2.log("Minimal4337AccountV08", address(account));
        console2.log("Owner", owner);
        console2.log("EntryPointV08", ENTRY_POINT_V08);

        bytes memory callData = abi.encodeCall(Minimal4337Account.execute, (owner, 0.001 ether, ""));
        uint256 nonce = entryPoint.getNonce(address(account), 0);

        IEntryPointV08.PackedUserOperation memory op = IEntryPointV08.PackedUserOperation({
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

        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);

        IEntryPointV08.PackedUserOperation[] memory ops = new IEntryPointV08.PackedUserOperation[](1);
        ops[0] = op;

        entryPoint.handleOps(ops, payable(owner));
        console2.log("UserOpHash");
        console2.logBytes32(userOpHash);

        vm.stopBroadcast();
    }

    function _packGasLimits(uint128 verificationGasLimit, uint128 callGasLimit) internal pure returns (bytes32) {
        return bytes32((uint256(verificationGasLimit) << 128) | uint256(callGasLimit));
    }

    function _packGasFees(uint128 maxPriorityFeePerGas, uint128 maxFeePerGas) internal pure returns (bytes32) {
        return bytes32((uint256(maxPriorityFeePerGas) << 128) | uint256(maxFeePerGas));
    }
}
