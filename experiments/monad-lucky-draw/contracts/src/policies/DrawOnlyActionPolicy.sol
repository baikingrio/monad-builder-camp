// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ConfigId, ISmartSessionActionPolicy, ISmartSessionPolicy} from "../interfaces/ISmartSessionPolicy.sol";

/// @notice Non-deployable action policy that permits only Lucky Draw's draw() call.
contract DrawOnlyActionPolicy is ISmartSessionActionPolicy {
    address internal constant LUCKY_DRAW = 0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70;
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;

    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;

    struct Config {
        address target;
        bytes4 selector;
        bool initialized;
    }

    mapping(ConfigId configId => mapping(address multiplexer => mapping(address account => Config))) private configs;

    function initializeWithMultiplexer(address account, ConfigId configId, bytes calldata initData) external override {
        require(initData.length == 64, "invalid init data");
        (address target, bytes4 selector) = abi.decode(initData, (address, bytes4));
        require(target == LUCKY_DRAW && selector == DRAW_SELECTOR, "invalid draw action");

        configs[configId][msg.sender][account] = Config({target: target, selector: selector, initialized: true});
        emit PolicySet(configId, msg.sender, account);
    }

    function checkAction(ConfigId configId, address account, address target, uint256 value, bytes calldata data)
        external
        view
        override
        returns (uint256)
    {
        Config storage config = configs[configId][msg.sender][account];
        if (!config.initialized || target != config.target || value != 0 || data.length != 4) {
            return VALIDATION_FAILED;
        }

        bytes4 selector;
        assembly ("memory-safe") {
            selector := calldataload(data.offset)
        }
        return selector == config.selector ? VALIDATION_SUCCESS : VALIDATION_FAILED;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == type(ISmartSessionPolicy).interfaceId
            || interfaceId == type(ISmartSessionActionPolicy).interfaceId;
    }
}
