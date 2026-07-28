// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OutcomeVault} from "./OutcomeVault.sol";

interface IERC20Approval {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IKuruMarginAccount {
    function deposit(address user, address token, uint256 amount) external payable;
    function withdraw(uint256 amount, address token) external;
}

interface IKuruOrderBook {
    function addBuyOrder(uint32 price, uint96 size, bool postOnly) external;
    function addSellOrder(uint32 price, uint96 size, bool postOnly) external;
    function batchCancelOrders(uint40[] calldata orderIds) external;
}

/// @notice Test-only independent actor. It holds no privileged protocol role.
contract KuruTestTrader {
    function approveToken(address token, address spender, uint256 amount) external {
        require(IERC20Approval(token).approve(spender, amount), "approval failed");
    }

    function split(OutcomeVault vault, uint256 amount) external {
        vault.split(amount);
    }

    function redeem(OutcomeVault vault) external {
        vault.redeem();
    }

    function marginDeposit(IKuruMarginAccount margin, address token, uint256 amount) external {
        margin.deposit(address(this), token, amount);
    }

    function marginWithdraw(IKuruMarginAccount margin, uint256 amount, address token) external {
        margin.withdraw(amount, token);
    }

    function placeBuy(IKuruOrderBook market, uint32 price, uint96 size, bool postOnly) external {
        market.addBuyOrder(price, size, postOnly);
    }

    function placeSell(IKuruOrderBook market, uint32 price, uint96 size, bool postOnly) external {
        market.addSellOrder(price, size, postOnly);
    }

    function cancel(IKuruOrderBook market, uint40[] calldata orderIds) external {
        market.batchCancelOrders(orderIds);
    }
}
