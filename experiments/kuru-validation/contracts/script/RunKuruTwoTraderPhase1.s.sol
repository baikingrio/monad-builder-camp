// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OutcomeVault} from "../src/OutcomeVault.sol";
import {KuruTestTrader, IKuruMarginAccount, IKuruOrderBook} from "../src/KuruTestTrader.sol";

interface IKuruRouterPhase1 {
    function deployProxy(
        uint8 orderBookType,
        address baseAsset,
        address quoteAsset,
        uint96 sizePrecision,
        uint32 pricePrecision,
        uint32 tickSize,
        uint96 minSize,
        uint96 maxSize,
        uint256 takerFeeBps,
        uint256 makerFeeBps,
        uint96 kuruAmmSpread
    ) external returns (address proxy);
}

/// @notice Testnet-only two-actor proof for Kuru order placement/fill and the OutcomeVault exit boundary.
contract RunKuruTwoTraderPhase1 is Script {
    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;
    address internal constant KURU_ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;
    address internal constant MARGIN_ACCOUNT = 0xd029C2D98ff85D8F64799017fE00a59B1159CE02;
    uint256 internal constant ONE_SHARE = 1e6;
    uint256 internal constant SIZE = 100 * ONE_SHARE;

    function run() external returns (address market, address aliceAddress, address bobAddress, address vaultAddress) {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "wrong chain");

        vm.startBroadcast();
        MockERC20 usdc = new MockERC20("Two Trader Test USDC", "ttUSDC", 6);
        OutcomeVault vault = new OutcomeVault(usdc);
        KuruTestTrader alice = new KuruTestTrader();
        KuruTestTrader bob = new KuruTestTrader();

        market = IKuruRouterPhase1(KURU_ROUTER).deployProxy(
            0,
            address(vault.aboveToken()),
            address(usdc),
            uint96(ONE_SHARE),
            uint32(ONE_SHARE),
            10_000,
            uint96(ONE_SHARE),
            uint96(1_000_000e6),
            0,
            0,
            100
        );

        // Alice deposits quote collateral for an Above buy; Bob mints and deposits Above for a sell.
        usdc.mint(address(alice), 60 * ONE_SHARE);
        usdc.mint(address(bob), SIZE);
        alice.approveToken(address(usdc), MARGIN_ACCOUNT, 60 * ONE_SHARE);
        alice.marginDeposit(IKuruMarginAccount(MARGIN_ACCOUNT), address(usdc), 60 * ONE_SHARE);

        bob.approveToken(address(usdc), address(vault), SIZE);
        bob.split(vault, SIZE);
        bob.approveToken(address(vault.aboveToken()), MARGIN_ACCOUNT, SIZE);
        bob.marginDeposit(IKuruMarginAccount(MARGIN_ACCOUNT), address(vault.aboveToken()), SIZE);

        // Separate contract addresses are used as Alice/Bob. Their orders cross at 0.60.
        alice.placeBuy(IKuruOrderBook(market), 600_000, uint96(SIZE), false);
        bob.placeSell(IKuruOrderBook(market), 600_000, uint96(SIZE), false);

        // The winning Kuru-held share must be withdrawn before the OutcomeVault can redeem it.
        alice.marginWithdraw(IKuruMarginAccount(MARGIN_ACCOUNT), SIZE, address(vault.aboveToken()));
        alice.approveToken(address(vault.aboveToken()), address(vault), SIZE);
        vault.resolve(OutcomeVault.Outcome.Above);
        alice.redeem(vault);

        // This succeeding post-resolution order demonstrates why Kuru lifecycle control is a hard blocker:
        // resolving OutcomeVault does not pause the independently-owned Kuru market.
        alice.approveToken(address(usdc), MARGIN_ACCOUNT, 10 * ONE_SHARE);
        alice.marginDeposit(IKuruMarginAccount(MARGIN_ACCOUNT), address(usdc), 10 * ONE_SHARE);
        alice.placeBuy(IKuruOrderBook(market), 100_000, uint96(SIZE), false);
        vm.stopBroadcast();

        aliceAddress = address(alice);
        bobAddress = address(bob);
        vaultAddress = address(vault);
        console2.log("MockUSDC", address(usdc));
        console2.log("OutcomeVault", vaultAddress);
        console2.log("AboveToken", address(vault.aboveToken()));
        console2.log("BelowToken", address(vault.belowToken()));
        console2.log("KuruMarket", market);
        console2.log("Alice", aliceAddress);
        console2.log("Bob", bobAddress);
    }
}
