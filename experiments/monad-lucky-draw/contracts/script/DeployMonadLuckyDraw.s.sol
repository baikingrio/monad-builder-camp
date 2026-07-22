// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {MonadLuckyDraw} from "../src/MonadLuckyDraw.sol";

/// @notice Deploys only the learning-only MonadLuckyDraw contract in Forge's default dry-run mode.
/// @dev This script reads no environment variables and never starts broadcasting.
contract DeployMonadLuckyDraw is Script {
    function run() external returns (MonadLuckyDraw deployed) {
        deployed = new MonadLuckyDraw();
    }
}
