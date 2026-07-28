// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "./MockERC20.sol";
import {OutcomeToken} from "./OutcomeToken.sol";

contract OutcomeVault {
    enum Outcome {
        Unresolved,
        Above,
        Below,
        Void
    }

    MockERC20 public immutable collateral;
    OutcomeToken public immutable aboveToken;
    OutcomeToken public immutable belowToken;
    Outcome public outcome;
    address public immutable resolver;
    address public matcher;

    event Split(address indexed user, uint256 amount);
    event Merged(address indexed user, uint256 amount);
    event Resolved(Outcome outcome);
    event Redeemed(address indexed user, uint256 payout);

    modifier beforeResolution() {
        require(outcome == Outcome.Unresolved, "market resolved");
        _;
    }

    modifier onlyResolver() {
        require(msg.sender == resolver, "only resolver");
        _;
    }

    modifier onlyMatcher() {
        require(msg.sender == matcher, "only matcher");
        _;
    }

    constructor(MockERC20 collateral_) {
        collateral = collateral_;
        resolver = msg.sender;
        aboveToken = new OutcomeToken("BTC Above", "ABOVE", address(this));
        belowToken = new OutcomeToken("BTC Below", "BELOW", address(this));
    }

    function setMatcher(address matcher_) external onlyResolver beforeResolution {
        require(matcher == address(0), "matcher already set");
        require(matcher_ != address(0), "zero matcher");
        matcher = matcher_;
    }

    function split(uint256 amount) external beforeResolution {
        _split(msg.sender, msg.sender, msg.sender, amount);
    }

    function splitFor(address aboveRecipient, address belowRecipient, uint256 amount) external onlyMatcher beforeResolution {
        _split(msg.sender, aboveRecipient, belowRecipient, amount);
    }

    function merge(uint256 amount) external beforeResolution {
        require(aboveToken.transferFrom(msg.sender, address(this), amount), "above transfer failed");
        require(belowToken.transferFrom(msg.sender, address(this), amount), "below transfer failed");
        aboveToken.burn(amount);
        belowToken.burn(amount);
        require(collateral.transfer(msg.sender, amount), "collateral transfer failed");
        emit Merged(msg.sender, amount);
    }

    function resolve(Outcome result) external onlyResolver beforeResolution {
        require(result != Outcome.Unresolved, "invalid outcome");
        outcome = result;
        emit Resolved(result);
    }

    function redeem() external {
        require(outcome != Outcome.Unresolved, "not resolved");
        uint256 payout;
        if (outcome == Outcome.Above) {
            uint256 above = aboveToken.balanceOf(msg.sender);
            require(above > 0, "no winning shares");
            require(aboveToken.transferFrom(msg.sender, address(this), above), "above transfer failed");
            aboveToken.burn(above);
            payout = above;
        } else if (outcome == Outcome.Below) {
            uint256 below = belowToken.balanceOf(msg.sender);
            require(below > 0, "no winning shares");
            require(belowToken.transferFrom(msg.sender, address(this), below), "below transfer failed");
            belowToken.burn(below);
            payout = below;
        } else {
            uint256 above = aboveToken.balanceOf(msg.sender);
            uint256 below = belowToken.balanceOf(msg.sender);
            require(above > 0 || below > 0, "no shares");
            if (above > 0) {
                require(aboveToken.transferFrom(msg.sender, address(this), above), "above transfer failed");
                aboveToken.burn(above);
            }
            if (below > 0) {
                require(belowToken.transferFrom(msg.sender, address(this), below), "below transfer failed");
                belowToken.burn(below);
            }
            payout = (above + below) / 2;
        }
        require(collateral.transfer(msg.sender, payout), "collateral transfer failed");
        emit Redeemed(msg.sender, payout);
    }

    function _split(address payer, address aboveRecipient, address belowRecipient, uint256 amount) internal {
        require(amount > 0, "zero amount");
        require(collateral.transferFrom(payer, address(this), amount), "collateral transfer failed");
        aboveToken.mint(aboveRecipient, amount);
        belowToken.mint(belowRecipient, amount);
        emit Split(aboveRecipient, amount);
    }
}
