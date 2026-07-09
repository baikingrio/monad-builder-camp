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

/// @notice 在 Monad Testnet 上演示 ERC-4337 的 counterfactual deployment + initCode。
/// @dev 场景：先预测智能账户地址并预充值，再由第一笔 UserOperation 部署账户并执行调用。
contract Counterfactual4337PracticeV08 is Script {
    // Monad Testnet 官方 EntryPoint v0.8。
    address internal constant ENTRY_POINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    // salt 是 CREATE2 地址计算的一部分。这里用固定 salt，方便实验复现。
    bytes32 internal constant ACCOUNT_SALT = keccak256("monad-builder-camp-counterfactual-initCode-v1");

    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(ownerKey);
        IEntryPointV08Counterfactual entryPoint = IEntryPointV08Counterfactual(ENTRY_POINT_V08);

        vm.startBroadcast(ownerKey);

        // 第一步：部署一个极简 factory。真实产品中 factory 通常会预先部署并复用。
        Minimal4337AccountFactory factory = new Minimal4337AccountFactory();

        // 第二步：账户尚未部署时，先用 CREATE2 规则预测它未来的地址。
        address account = factory.getAddress(ENTRY_POINT_V08, owner, ACCOUNT_SALT);
        _logSetup(owner, address(factory), account);

        // 应用场景：活动 App 可以先展示这个“未来智能账户地址”。
        // 即使 account.code.length 还是 0，这个地址也能先收测试币、空投或活动资产。
        // 等用户第一次真正操作时，再通过 initCode 懒部署账户。
        payable(account).transfer(0.2 ether);

        (IEntryPointV08Counterfactual.PackedUserOperation memory op, bytes32 userOpHash, uint256 initCodeLength) =
            _buildSignedOp(entryPoint, ownerKey, account, address(factory));

        IEntryPointV08Counterfactual.PackedUserOperation[] memory ops = new IEntryPointV08Counterfactual.PackedUserOperation[](1);
        ops[0] = op;

        // 第三步：handleOps 会发现 sender 还没有代码，于是先执行 initCode 部署账户，
        // 然后再调用账户的 validateUserOp 和 callData。
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
        // initCode 的后半段：调用 factory.createAccount(entryPoint, owner, salt) 的 calldata。
        bytes memory factoryCallData = abi.encodeCall(
            Minimal4337AccountFactory.createAccount,
            (ENTRY_POINT_V08, vm.addr(ownerKey), ACCOUNT_SALT)
        );

        // ERC-4337 v0.8 的 initCode 格式：前 20 bytes 是 factory 地址，后面是 factory 调用数据。
        // EntryPoint 会用它来部署 sender 对应的智能账户。
        bytes memory initCode = abi.encodePacked(factory, factoryCallData);

        // 账户部署完成后要立刻执行的动作：从智能账户给 owner 转回 0.001 MON。
        bytes memory callData = abi.encodeCall(Minimal4337Account.execute, (vm.addr(ownerKey), 0.001 ether, ""));

        op = IEntryPointV08Counterfactual.PackedUserOperation({
            sender: account,
            // 对尚未部署的账户，也可以通过 EntryPoint 读取 nonce；首次通常为 0。
            nonce: entryPoint.getNonce(account, 0),
            initCode: initCode,
            callData: callData,
            accountGasLimits: _packGasLimits(900_000, 140_000),
            preVerificationGas: 120_000,
            gasFees: _packGasFees(2 gwei, 100 gwei),
            paymasterAndData: "",
            signature: ""
        });

        // 签名必须覆盖完整 UserOperation（包括 initCode），否则部署参数被改动也可能被误执行。
        userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);
        initCodeLength = initCode.length;
    }

    function _packGasLimits(uint128 verificationGasLimit, uint128 callGasLimit) internal pure returns (bytes32) {
        // ERC-4337 v0.7+ 把 verificationGasLimit 和 callGasLimit 打包进同一个 bytes32。
        return bytes32((uint256(verificationGasLimit) << 128) | uint256(callGasLimit));
    }

    function _packGasFees(uint128 maxPriorityFeePerGas, uint128 maxFeePerGas) internal pure returns (bytes32) {
        // gasFees 同样打包：高 128 位是 priority fee，低 128 位是 max fee。
        return bytes32((uint256(maxPriorityFeePerGas) << 128) | uint256(maxFeePerGas));
    }
}
