// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Minimal4337Account} from "../src/Minimal4337Account.sol";
import {Minimal4337AccountFactory} from "../src/Minimal4337AccountFactory.sol";

interface IEntryPointV08Counterfactual {
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

/// @notice Demonstrates ERC-4337 counterfactual deployment with initCode on Monad Testnet.
/// @dev Scenario: pre-compute a smart account address, fund it before deployment,
///      then let the first UserOperation deploy the account and execute a call.
contract Counterfactual4337PracticeV08 is Script {
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    bytes32 internal constant ACCOUNT_SALT = keccak256("monad-builder-camp-counterfactual-initCode-v1");

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        IEntryPointV08Counterfactual entryPoint = IEntryPointV08Counterfactual(ENTRY_POINT_V08);

        vm.startBroadcast(ownerKey);

        Minimal4337AccountFactory factory = new Minimal4337AccountFactory();
        address account = factory.getAddress(ENTRY_POINT_V08, owner, ACCOUNT_SALT);
        _logSetup(owner, address(factory), account);

        // Application scenario: a dapp can show this address before deployment, so the
        // user/airdrop/backend can send funds there first. The first UserOperation pays
        // gas from that pre-funded balance and deploys the wallet only when needed.
        payable(account).transfer(0.2 ether);

        (IEntryPointV08Counterfactual.PackedUserOperation memory op, bytes32 userOpHash, uint256 initCodeLength) =
            _buildSignedOp(entryPoint, ownerKey, account, address(factory));

        IEntryPointV08Counterfactual.PackedUserOperation[] memory ops = new IEntryPointV08Counterfactual.PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(owner));

        console2.log("AfterCodeLength", account.code.length);
        console2.log("AccountBalance", account.balance);
        console2.log("EntryPointNonce", entryPoint.getNonce(account, 0));
        console2.log("UserOpHash");
        console2.logBytes32(userOpHash);
        console2.log("InitCodeLength", initCodeLength);

        vm.stopBroadcast();
    }

    function _logSetup(address owner, address factory, address account) internal view {
        console2.log("Owner", owner);
        console2.log("EntryPointV08", ENTRY_POINT_V08);
        console2.log("Factory", factory);
        console2.log("CounterfactualAccount", account);
        console2.log("BeforeCodeLength", account.code.length);
    }

    function _buildSignedOp(
        IEntryPointV08Counterfactual entryPoint,
        uint256 ownerKey,
        address account,
        address factory
    ) internal view returns (IEntryPointV08Counterfactual.PackedUserOperation memory op, bytes32 userOpHash, uint256 initCodeLength) {
        bytes memory factoryCallData = abi.encodeCall(
            Minimal4337AccountFactory.createAccount,
            (ENTRY_POINT_V08, vm.addr(ownerKey), ACCOUNT_SALT)
        );
        bytes memory initCode = abi.encodePacked(factory, factoryCallData);
        bytes memory callData = abi.encodeCall(Minimal4337Account.execute, (vm.addr(ownerKey), 0.001 ether, ""));

        op = IEntryPointV08Counterfactual.PackedUserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account, 0),
            initCode: initCode,
            callData: callData,
            accountGasLimits: _packGasLimits(900_000, 140_000),
            preVerificationGas: 120_000,
            gasFees: _packGasFees(2 gwei, 100 gwei),
            paymasterAndData: "",
            signature: ""
        });

        userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);
        initCodeLength = initCode.length;
    }

    function _packGasLimits(uint128 verificationGasLimit, uint128 callGasLimit) internal pure returns (bytes32) {
        return bytes32((uint256(verificationGasLimit) << 128) | uint256(callGasLimit));
    }

    function _packGasFees(uint128 maxPriorityFeePerGas, uint128 maxFeePerGas) internal pure returns (bytes32) {
        return bytes32((uint256(maxPriorityFeePerGas) << 128) | uint256(maxFeePerGas));
    }
}
