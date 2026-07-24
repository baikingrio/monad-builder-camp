// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Read-only verifier for the planned Safe7579 stack on Monad Testnet.
/// @dev Confirms knownAbsent addresses still have empty code and prints planned artifact hashes from the manifest.
contract VerifySafe7579Stack is Script {
    using stdJson for string;

    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external view {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "VerifySafe7579Stack: chainId must be 10143");

        string memory manifest = vm.readFile("./vendor-manifest.safe7579.json");
        bool permitted = manifest.readBool(".deployment.permitted");
        console2.log("deployment.permitted", permitted);
        require(permitted == false, "VerifySafe7579Stack: unexpected permitted=true");

        _logAbsence("launchpad", manifest.readAddress(".monad.knownAbsent.launchpad"));
        _logAbsence("adapter", manifest.readAddress(".monad.knownAbsent.adapter"));
        _logAbsence("smartSessionEmissary", manifest.readAddress(".monad.knownAbsent.smartSessionEmissary"));
        _logAbsence("uniActionPolicy", manifest.readAddress(".monad.knownAbsent.uniActionPolicy"));
        _logAbsence("timeFramePolicy", manifest.readAddress(".monad.knownAbsent.timeFramePolicy"));
        _logAbsence("valueLimitPolicy", manifest.readAddress(".monad.knownAbsent.valueLimitPolicy"));

        console2.log("planned Safe7579 creation keccak");
        console2.log(manifest.readString(".artifacts.safe7579.creationKeccak256"));
        console2.log("planned SmartSession creation keccak");
        console2.log(manifest.readString(".artifacts.smartSession.creationKeccak256"));
        console2.log("custom policies remain localOnly / NOT_AUDITED / deploymentEligible=false");
        console2.log("VerifySafe7579Stack complete: stack not live; no secrets printed");
    }

    function _logAbsence(string memory label, address target) internal view {
        uint256 codeLen = target.code.length;
        console2.log(label, target);
        console2.log("  codeLength", codeLen);
        require(codeLen == 0, "VerifySafe7579Stack: knownAbsent address unexpectedly has code");
    }
}
