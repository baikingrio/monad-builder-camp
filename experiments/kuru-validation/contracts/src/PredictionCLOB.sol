// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "./MockERC20.sol";
import {OutcomeVault} from "./OutcomeVault.sol";

/// @notice A deliberately bounded, prediction-native CLOB validation spike.
/// It supports only fully collateralized Above/Below buy bids. Matching mints
/// complete sets; it is not intended as a production exchange implementation.
contract PredictionCLOB {
    uint256 public constant PRICE_SCALE = 1e6;
    uint32 public constant TICK_SIZE = 10_000; // 1 cent at 1e6 precision

    enum Side {
        Above,
        Below
    }

    struct Order {
        address trader;
        Side side;
        uint32 price;
        uint96 remaining;
        uint256 escrow;
        bool active;
    }

    MockERC20 public immutable collateral;
    OutcomeVault public immutable vault;
    uint64 public immutable tradeCutoff;
    bool public tradingClosed;
    uint64 public nextOrderId = 1;
    mapping(uint64 => Order) public orders;
    uint64[] internal aboveOrderIds;
    uint64[] internal belowOrderIds;

    event OrderPlaced(uint64 indexed id, address indexed trader, Side side, uint32 price, uint96 size);
    event OrderCanceled(uint64 indexed id, address indexed trader, uint256 escrowRefund);
    event Matched(uint64 indexed aboveId, uint64 indexed belowId, uint96 size);
    event TradingClosed(uint64 cutoff);

    modifier whenTradingOpen() {
        require(!tradingClosed && block.timestamp < tradeCutoff, "trading closed");
        _;
    }

    constructor(MockERC20 collateral_, OutcomeVault vault_, uint64 tradeCutoff_) {
        require(tradeCutoff_ > block.timestamp, "invalid cutoff");
        collateral = collateral_;
        vault = vault_;
        tradeCutoff = tradeCutoff_;
    }

    function placeBid(Side side, uint32 price, uint96 size) external whenTradingOpen returns (uint64 id) {
        require(price >= TICK_SIZE && price < PRICE_SCALE && price % TICK_SIZE == 0, "invalid price");
        require(size > 0 && size % uint96(1e6) == 0, "invalid size");
        uint256 escrow = uint256(price) * uint256(size) / PRICE_SCALE;
        require(collateral.transferFrom(msg.sender, address(this), escrow), "escrow transfer failed");

        id = nextOrderId++;
        orders[id] = Order(msg.sender, side, price, size, escrow, true);
        if (side == Side.Above) aboveOrderIds.push(id);
        else belowOrderIds.push(id);
        emit OrderPlaced(id, msg.sender, side, price, size);
    }

    /// @notice Selects highest-price active bid from each side; equal-price ties keep lower ID first.
    function matchBest() external whenTradingOpen {
        (uint64 aboveId, bool aboveFound) = _best(Side.Above);
        (uint64 belowId, bool belowFound) = _best(Side.Below);
        require(aboveFound && belowFound, "no complementary orders");
        Order storage above = orders[aboveId];
        Order storage below = orders[belowId];
        require(above.trader != below.trader, "self match");
        require(uint256(above.price) + uint256(below.price) >= PRICE_SCALE, "not complementary");

        uint96 fill = above.remaining < below.remaining ? above.remaining : below.remaining;
        uint256 aboveDeposit = uint256(above.price) * uint256(fill) / PRICE_SCALE;
        uint256 belowDeposit = uint256(below.price) * uint256(fill) / PRICE_SCALE;
        bool aboveMaker = aboveId < belowId;
        uint256 aboveActual = aboveMaker ? aboveDeposit : uint256(fill) - belowDeposit;
        uint256 belowActual = aboveMaker ? uint256(fill) - aboveDeposit : belowDeposit;
        require(aboveActual <= aboveDeposit && belowActual <= belowDeposit, "invalid improvement");

        above.remaining -= fill;
        below.remaining -= fill;
        above.escrow -= aboveDeposit;
        below.escrow -= belowDeposit;
        if (above.remaining == 0) above.active = false;
        if (below.remaining == 0) below.active = false;

        uint256 aboveRefund = aboveDeposit - aboveActual;
        uint256 belowRefund = belowDeposit - belowActual;
        if (aboveRefund > 0) require(collateral.transfer(above.trader, aboveRefund), "above refund failed");
        if (belowRefund > 0) require(collateral.transfer(below.trader, belowRefund), "below refund failed");

        require(collateral.approve(address(vault), uint256(fill)), "vault approval failed");
        vault.splitFor(above.trader, below.trader, uint256(fill));
        emit Matched(aboveId, belowId, fill);
    }

    function cancel(uint64 id) external {
        Order storage order = orders[id];
        require(order.active, "inactive order");
        require(order.trader == msg.sender, "only owner");
        order.active = false;
        uint256 refund = order.escrow;
        order.escrow = 0;
        require(collateral.transfer(msg.sender, refund), "refund failed");
        emit OrderCanceled(id, msg.sender, refund);
    }

    function closeTrading() external {
        require(!tradingClosed, "already closed");
        require(block.timestamp >= tradeCutoff, "cutoff not reached");
        tradingClosed = true;
        emit TradingClosed(tradeCutoff);
    }

    function _best(Side side) internal view returns (uint64 id, bool found) {
        uint64[] storage ids = side == Side.Above ? aboveOrderIds : belowOrderIds;
        uint32 bestPrice;
        for (uint256 i; i < ids.length; ++i) {
            Order storage order = orders[ids[i]];
            if (order.active && (!found || order.price > bestPrice)) {
                id = ids[i];
                bestPrice = order.price;
                found = true;
            }
        }
    }
}
