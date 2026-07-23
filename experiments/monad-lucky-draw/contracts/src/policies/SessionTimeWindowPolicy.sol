// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    ConfigId,
    PackedUserOperation,
    ISmartSessionActionPolicy,
    ISmartSessionPolicy,
    ISmartSessionUserOpPolicy
} from "../interfaces/ISmartSessionPolicy.sol";

/// @notice Non-deployable user-operation policy that returns a configured ERC-4337 validity window.
contract SessionTimeWindowPolicy is ISmartSessionUserOpPolicy {
    uint256 internal constant VALIDATION_FAILED = 1;

    struct Config {
        uint48 validAfter;
        uint48 validUntil;
        bool initialized;
    }

    mapping(ConfigId configId => mapping(address multiplexer => mapping(address account => Config))) private configs;

    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData) external override {
        require(initData.length == 64, "invalid init data");
        (uint48 validAfter, uint48 validUntil) = abi.decode(initData, (uint48, uint48));
        require(validUntil != 0 && validUntil > validAfter, "invalid time window");

        configs[configId][msg.sender][account] =
            Config({validAfter: validAfter, validUntil: validUntil, initialized: true});
        emit PolicySet(configId, msg.sender, account);
    }

    function checkUserOpPolicy(ConfigId configId, PackedUserOperation calldata userOp)
        external
        view
        override
        returns (uint256)
    {
        Config storage config = configs[configId][msg.sender][userOp.sender];
        if (!config.initialized) return VALIDATION_FAILED;

        return (uint256(config.validUntil) << 160) | (uint256(config.validAfter) << 208);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == type(ISmartSessionPolicy).interfaceId
            || interfaceId == type(ISmartSessionUserOpPolicy).interfaceId;
    }
}
