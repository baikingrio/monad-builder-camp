// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {KuruTestTrader, IKuruMarginAccount, IKuruOrderBook} from "../src/KuruTestTrader.sol";

interface IKuruRouterEdgeCases {
    function deployProxy(
        uint8 orderBookType, address baseAsset, address quoteAsset, uint96 sizePrecision, uint32 pricePrecision,
        uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps, uint256 makerFeeBps, uint96 kuruAmmSpread
    ) external returns (address proxy);
}

/// @notice Testnet-only Kuru partial fill and batch-cancel proof. No real tokens.
contract RunKuruEdgeCases is Script {
    uint256 internal constant CHAIN_ID = 10143;
    address internal constant ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;
    address internal constant MARGIN = 0xd029C2D98ff85D8F64799017fE00a59B1159CE02;
    uint256 internal constant ONE = 1e6;

    function run() external returns (address market, address aliceAddress, address bobAddress) {
        require(block.chainid == CHAIN_ID, "wrong chain");
        vm.startBroadcast();
        MockERC20 usdc = new MockERC20("Kuru Edge Test USDC", "keUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        KuruTestTrader alice = new KuruTestTrader();
        KuruTestTrader bob = new KuruTestTrader();
        market = IKuruRouterEdgeCases(ROUTER).deployProxy(
            0, address(vault.aboveToken()), address(usdc), uint96(ONE), uint32(ONE), 10_000,
            uint96(ONE), uint96(1_000_000e6), 0, 0, 100
        );

        // Bob provides 100 Above. Alice buys 40, leaving Bob's first sell partially filled at 60.
        usdc.mint(address(bob), 100 * ONE);
        bob.approveToken(address(usdc), address(vault), 100 * ONE);
        bob.split(vault, 100 * ONE);
        bob.approveToken(address(vault.aboveToken()), MARGIN, 100 * ONE);
        bob.marginDeposit(IKuruMarginAccount(MARGIN), address(vault.aboveToken()), 100 * ONE);
        bob.placeSell(IKuruOrderBook(market), 600_000, uint96(100 * ONE), false); // order id 1

        usdc.mint(address(alice), 24 * ONE);
        alice.approveToken(address(usdc), MARGIN, 24 * ONE);
        alice.marginDeposit(IKuruMarginAccount(MARGIN), address(usdc), 24 * ONE);
        alice.placeBuy(IKuruOrderBook(market), 600_000, uint96(40 * ONE), false);

        // The 60-share remainder may be canceled. Add two orders and batch cancel them as well.
        uint40[] memory first = new uint40[](1);
        first[0] = 1;
        bob.cancel(IKuruOrderBook(market), first);
        bob.placeSell(IKuruOrderBook(market), 700_000, uint96(20 * ONE), false); // id 2
        bob.placeSell(IKuruOrderBook(market), 800_000, uint96(20 * ONE), false); // id 3
        uint40[] memory batch = new uint40[](2);
        batch[0] = 2;
        batch[1] = 3;
        bob.cancel(IKuruOrderBook(market), batch);
        bob.marginWithdraw(IKuruMarginAccount(MARGIN), 60 * ONE, address(vault.aboveToken()));
        vm.stopBroadcast();

        aliceAddress = address(alice);
        bobAddress = address(bob);
        console2.log("MockUSDC", address(usdc));
        console2.log("OutcomeVault", address(vault));
        console2.log("AboveToken", address(vault.aboveToken()));
        console2.log("KuruMarket", market);
        console2.log("Alice", aliceAddress);
        console2.log("Bob", bobAddress);
    }
}
