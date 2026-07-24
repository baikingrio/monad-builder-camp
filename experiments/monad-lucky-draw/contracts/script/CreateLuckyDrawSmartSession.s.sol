// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Dry-run session creation planner. Never broadcasts; aborts if 7579 stack is not live on Monad.
contract CreateLuckyDrawSmartSession is Script {
    using stdJson for string;

    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;
    address internal constant LUCKY_DRAW = 0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70;
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;

    function run() external view {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "CreateLuckyDrawSmartSession: chainId must be 10143");
        require(!_broadcastRequested(), "CreateLuckyDrawSmartSession: broadcast forbidden");

        string memory manifest = vm.readFile("./vendor-manifest.safe7579.json");
        require(manifest.readBool(".deployment.permitted") == false, "CreateLuckyDrawSmartSession: deployment not permitted");
        require(
            keccak256(bytes(manifest.readString(".drawOnly.selector"))) == keccak256(bytes("0x0eecae21")),
            "CreateLuckyDrawSmartSession: draw selector mismatch"
        );
        require(manifest.readAddress(".drawOnly.target") == LUCKY_DRAW, "CreateLuckyDrawSmartSession: lucky draw mismatch");

        address launchpad = manifest.readAddress(".monad.knownAbsent.launchpad");
        address adapter = manifest.readAddress(".monad.knownAbsent.adapter");
        address smartSession = manifest.readAddress(".monad.knownAbsent.smartSessionEmissary");
        require(launchpad.code.length == 0, "CreateLuckyDrawSmartSession: unexpected launchpad code");
        require(adapter.code.length == 0, "CreateLuckyDrawSmartSession: unexpected adapter code");
        require(smartSession.code.length == 0, "CreateLuckyDrawSmartSession: unexpected smartSession code");

        bytes32 actionInitHash = keccak256(abi.encode(LUCKY_DRAW, DRAW_SELECTOR));
        console2.log("CreateLuckyDrawSmartSession dry-run OK");
        console2.log("planned action init hash");
        console2.logBytes32(actionInitHash);
        console2.log("no Safe/session was created; stack still absent on Monad");
    }

    function _broadcastRequested() internal view returns (bool) {
        try vm.envBool("SAFE7579_ALLOW_BROADCAST") returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }
}
