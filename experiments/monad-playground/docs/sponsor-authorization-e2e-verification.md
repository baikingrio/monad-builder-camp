# Sponsor authorization E2E verification (read-only)

Date: 2026-07-12 UTC

## Foundry proof

`test/SponsorAuthorizationE2E.t.sol` builds the canonical call:

```text
MinimalSessionKeyAccount.execute(
  0x45CfcCa5e75474A711d077fB46bE3F77aFe31271,
  0,
  SessionKeyDemoTarget.checkIn("local sponsor verification")
)
```

It creates a raw-digest (`vm.sign`) Sponsor ECDSA signature in the same `paymasterAndData` wire layout used by the service, invokes `validatePaymasterUserOp` as EntryPoint, and proves:

- the unchanged UserOperation returns `validationData = 0`;
- replacing `gasFees` returns `validationData = 1`;
- replacing the canonical `callData` returns `validationData = 1`.

The deterministic key exists only inside the Foundry test; neither this test nor this record reads, writes, or exposes a Sponsor secret.

## Monad Testnet live read-only check

Public deployment facts queried through `https://testnet-rpc.monad.xyz`:

- Chain ID: `10143`
- Paymaster: `0xfe178d0068d91325118e65eA193D21976e9d8fcF`
- `entryPoint()`: `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`
- `sponsorSigner()`: `0x7c0343c808B827e4286381c2292d92c3f19152a4`
- SessionKeyDemoTarget: `0x45CfcCa5e75474A711d077fB46bE3F77aFe31271` (has deployed code)

On `2026-07-12T03:30:08Z`, a localhost-only Sponsor service issued a fresh short-lived authorization for this complete canonical public request:

- sender: `0x7c0343c808B827e4286381c2292d92c3f19152a4`
- nonce: `0`; initCode: `0x`
- callData: `MinimalSessionKeyAccount.execute(SessionKeyDemoTarget, 0, checkIn("local sponsor verification"))`
- accountGasLimits: `0x00000000000000000000000000030d4000000000000000000000000000061a80`
- preVerificationGas: `50000`
- gasFees: `0x0000000000000000000000003b9aca0000000000000000000000000077359400`
- Paymaster verification/post-operation gas: `300000` / `80000`
- validUntil: `1783827086`

Immediately before expiry, a non-transactional `cast call` to `validatePaymasterUserOp`, with `--from 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`, returned:

```text
context:        0x
validationData: 0
```

The same authorization with only `gasFees` changed to `0x0000000000000000000000003b9aca0000000000000000000000000077359401` returned:

```text
context:        0x
validationData: 1
```

The complete nonsecret request-and-response artifact, including the public authorization wire value and both read-only results, is at `/tmp/sponsor-authorization-live-validation-artifact.json`. The localhost server was stopped and `NUXT_SPONSOR_SIGNING_ENABLED` was restored to `false` after the check. No `handleOps`, relay, deployment, broadcast, or paid transaction was submitted.
