// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IPyth {
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

/// @title PythBtcPriceProbe
/// @notice Minimal Monad Testnet probe that verifies a Pyth BTC/USD update before recording it.
/// @dev This is a research artifact, not a prediction-market settlement contract.
contract PythBtcPriceProbe {
    error IncorrectUpdateFee(uint256 expected, uint256 received);
    error NonPositivePrice();

    event PriceRecorded(int64 price, uint64 confidence, int32 exponent, uint256 publishTime);

    IPyth public immutable pyth;
    bytes32 public immutable priceId;
    uint256 public immutable maxPriceAge;

    int64 public lastPrice;
    uint64 public lastConfidence;
    int32 public lastExponent;
    uint256 public lastPublishTime;

    constructor(address pyth_, bytes32 priceId_, uint256 maxPriceAge_) {
        pyth = IPyth(pyth_);
        priceId = priceId_;
        maxPriceAge = maxPriceAge_;
    }

    /// @notice Verifies the supplied Pyth update, then stores the fresh BTC/USD observation.
    /// @dev Callers must provide exactly the Pyth update fee; any excess is rejected, not retained.
    function updateAndRecord(bytes[] calldata updateData) external payable {
        uint256 fee = pyth.getUpdateFee(updateData);
        if (msg.value != fee) revert IncorrectUpdateFee(fee, msg.value);

        pyth.updatePriceFeeds{value: fee}(updateData);
        IPyth.Price memory observed = pyth.getPriceNoOlderThan(priceId, maxPriceAge);
        if (observed.price <= 0) revert NonPositivePrice();

        lastPrice = observed.price;
        lastConfidence = observed.conf;
        lastExponent = observed.expo;
        lastPublishTime = observed.publishTime;

        emit PriceRecorded(observed.price, observed.conf, observed.expo, observed.publishTime);
    }
}
