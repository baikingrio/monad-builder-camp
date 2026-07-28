# Pause and Cutoff Tests

## Official Kuru Router

The project deployer attempted a read-only call to:

```solidity
toggleMarkets([market], SOFT_PAUSED)
```

It reverted with `0x82b42900`, proving the project is not the official Router owner and cannot independently control the Market state.

## Settlement boundary

After OutcomeVault resolved, Kuru still accepted a new Buy:

<https://testnet.monadvision.com/tx/0x0c13ca3ecd20930d864b08b6e9dffe5e79d8d1a003505081c1d9e9a10828ec05>

Onchain read afterward: `marketState() = ACTIVE`.

This is the direct No-Go evidence for official Kuru integration.
