// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PythBtcPriceProbe} from "../src/PythBtcPriceProbe.sol";

interface IPythPriceProbe {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
}

contract MockPythPriceProbe is IPythPriceProbe {
    uint256 internal fee;
    Price internal configuredPrice;
    bool internal updated;

    function configure(uint256 fee_, Price calldata price_) external {
        fee = fee_;
        configuredPrice = price_;
        updated = false;
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return fee;
    }

    function updatePriceFeeds(bytes[] calldata) external payable {
        require(msg.value == fee, "wrong-fee");
        updated = true;
    }

    function getPriceNoOlderThan(bytes32, uint256) external view returns (Price memory) {
        require(updated, "update-required");
        return configuredPrice;
    }
}

contract PythBtcPriceProbeTest is Test {
    bytes32 internal constant BTC_USD_PRICE_ID =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    uint256 internal constant MAX_PRICE_AGE = 60;

    event PriceRecorded(int64 price, uint64 confidence, int32 exponent, uint256 publishTime);

    MockPythPriceProbe internal mockPyth;
    PythBtcPriceProbe internal probe;

    function setUp() public {
        mockPyth = new MockPythPriceProbe();
        probe = new PythBtcPriceProbe(address(mockPyth), BTC_USD_PRICE_ID, MAX_PRICE_AGE);
    }

    function testRecordsVerifiedPriceAfterExactUpdateFee() public {
        IPythPriceProbe.Price memory price = IPythPriceProbe.Price({
            price: 63_999_73647162,
            conf: 1_429_245452,
            expo: -8,
            publishTime: 1_784_967_747
        });
        mockPyth.configure(1 wei, price);

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = hex"010203";

        vm.expectEmit(false, false, false, true, address(probe));
        emit PriceRecorded(price.price, price.conf, price.expo, price.publishTime);
        probe.updateAndRecord{value: 1 wei}(updateData);

        assertEq(probe.lastPrice(), price.price);
        assertEq(probe.lastConfidence(), price.conf);
        assertEq(probe.lastExponent(), price.expo);
        assertEq(probe.lastPublishTime(), price.publishTime);
    }

    function testRejectsIncorrectUpdateFeeBeforeCallingPyth() public {
        IPythPriceProbe.Price memory price = IPythPriceProbe.Price({
            price: 1,
            conf: 1,
            expo: -8,
            publishTime: block.timestamp
        });
        mockPyth.configure(1 wei, price);

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = hex"01";

        vm.expectRevert(
            abi.encodeWithSelector(PythBtcPriceProbe.IncorrectUpdateFee.selector, 1 wei, 0)
        );
        probe.updateAndRecord(updateData);
    }

    function testRejectsNonPositivePriceAfterVerifiedUpdate() public {
        IPythPriceProbe.Price memory price = IPythPriceProbe.Price({
            price: 0,
            conf: 1,
            expo: -8,
            publishTime: block.timestamp
        });
        mockPyth.configure(1 wei, price);

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = hex"01";

        vm.expectRevert(PythBtcPriceProbe.NonPositivePrice.selector);
        probe.updateAndRecord{value: 1 wei}(updateData);
    }
}
