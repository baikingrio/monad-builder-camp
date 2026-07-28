// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "./MockERC20.sol";
import {OutcomeVault} from "./OutcomeVault.sol";

/// @notice Local-only Phase 5 spike. It deliberately supports only equal-size
/// complementary BUY orders; it is not a production order book.
contract ComplementaryMatchPoC {
    uint256 public constant PRICE_SCALE = 1e6;

    enum Side {
        Above,
        Below
    }

    struct Bid {
        address trader;
        Side side;
        uint256 price;
        uint256 size;
        uint256 escrow;
        bool active;
    }

    MockERC20 public immutable collateral;
    OutcomeVault public immutable vault;
    uint256 public nextOrderId = 1;
    mapping(uint256 => Bid) public bids;

    event BidPlaced(uint256 indexed orderId, address indexed trader, Side side, uint256 price, uint256 size);
    event ComplementaryMatched(uint256 indexed aboveOrderId, uint256 indexed belowOrderId, uint256 size);

    modifier beforeResolution() {
        require(vault.outcome() == OutcomeVault.Outcome.Unresolved, "market resolved");
        _;
    }

    constructor(MockERC20 collateral_, OutcomeVault vault_) {
        collateral = collateral_;
        vault = vault_;
    }

    function placeBid(Side side, uint256 price, uint256 size) external beforeResolution returns (uint256 orderId) {
        require(price > 0 && price <= PRICE_SCALE, "invalid price");
        require(size > 0, "zero size");

        uint256 escrow = _ceilDiv(price * size, PRICE_SCALE);
        require(escrow > 0, "zero escrow");
        require(collateral.transferFrom(msg.sender, address(this), escrow), "escrow transfer failed");

        orderId = nextOrderId++;
        bids[orderId] = Bid({trader: msg.sender, side: side, price: price, size: size, escrow: escrow, active: true});
        emit BidPlaced(orderId, msg.sender, side, price, size);
    }

    function cancelBid(uint256 orderId) external {
        Bid storage bid = bids[orderId];
        require(bid.active, "inactive order");
        require(bid.trader == msg.sender, "only trader");
        bid.active = false;
        require(collateral.transfer(bid.trader, bid.escrow), "escrow refund failed");
    }

    function matchComplementary(uint256 aboveOrderId, uint256 belowOrderId) external beforeResolution {
        Bid storage above = bids[aboveOrderId];
        Bid storage below = bids[belowOrderId];
        require(above.active && below.active, "inactive order");
        require(above.side == Side.Above && below.side == Side.Below, "wrong sides");
        require(above.trader != below.trader, "self match");
        require(above.size == below.size, "partial fills unsupported");
        require(above.price + below.price >= PRICE_SCALE, "not complementary");

        Bid storage maker = aboveOrderId < belowOrderId ? above : below;
        Bid storage taker = aboveOrderId < belowOrderId ? below : above;
        uint256 makerPayment = (maker.price * above.size) / PRICE_SCALE;
        uint256 takerPayment = above.size - makerPayment;
        require(maker.escrow >= makerPayment && taker.escrow >= takerPayment, "escrow shortfall");

        above.active = false;
        below.active = false;

        uint256 aboveRefund = above.escrow - (aboveOrderId < belowOrderId ? makerPayment : takerPayment);
        uint256 belowRefund = below.escrow - (aboveOrderId < belowOrderId ? takerPayment : makerPayment);
        if (aboveRefund > 0) require(collateral.transfer(above.trader, aboveRefund), "above refund failed");
        if (belowRefund > 0) require(collateral.transfer(below.trader, belowRefund), "below refund failed");

        require(collateral.approve(address(vault), above.size), "vault approval failed");
        vault.splitFor(above.trader, below.trader, above.size);
        emit ComplementaryMatched(aboveOrderId, belowOrderId, above.size);
    }

    function _ceilDiv(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        return numerator / denominator + (numerator % denominator == 0 ? 0 : 1);
    }
}
