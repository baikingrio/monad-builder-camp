# Safe 7579 Smart Session Migration — Deployment Preparation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current owner-based Session Key demo with a new Monad Testnet ERC-7579 Safe account whose Session Key has chain-enforced permission to invoke only `MonadLuckyDraw.draw()` with `value = 0`, is revocable/expiring, and can submit user-funded UserOperations without a product call-count cap.

**Architecture:** The current Safe 1.4.1 account remains a legacy proof account and must retain its three-call/24-hour server guard. The new account is created through Safe 7579 Launchpad/Adapter and installs Smart Session validation plus a fixed-action policy, value-zero policy, and expiry policy. The user funds the new account’s EntryPoint deposit; the Session Key signs only UserOperations accepted by the chain-level validator. All critical policies must be enforced by deployed bytecode, not only by the app server.

**Tech Stack:** Monad Testnet (10143), EntryPoint v0.7, Safe 7579 Launchpad/Adapter v2, Rhinestone Smart Session Emissary and policies, `@rhinestone/sdk` pinned after source review, Viem, Foundry, Nuxt/Nitro.

---

## Verified prerequisite status — 2026-07-23

The following known Safe/Rhinestone deterministic addresses have **no bytecode on Monad Testnet** and cannot be assumed usable:

- Safe 7579 Launchpad v2: `0x75798463024bda64d83c94a64bc7d7eab41300ef`
- Safe 7579 Adapter v2: `0x7579f2ad53b01c3d8779fe17928e0d48885b0003`
- Smart Session Emissary: `0xad568b3f825a8d5ffc06dd3253526b64d810ae89`
- Universal Action Policy: `0x0000006dda6c463511c4e9b05cfc34c1247fcf1f`
- Time Frame Policy: `0x8177451511de0577b911c254e9551d981c26dc72`
- Value Limit Policy: `0xa09b47de6e510cbdc18b97e9239bedcb44fb4901`

Read-only RPC evidence: `eth_getCode` returned `0x` for each address. Do not use cross-chain addresses as if they were deployed on Monad.

The SDK source examined is `rhinestonewtf/sdk` commit `e1dd824fe28e7b9788b066f76c8716c756b99f1c`; its Safe support explicitly identifies the above Launchpad/Adapter v2 constants. It cannot make these contracts exist on Monad.

## Non-negotiable boundaries

- No existing Safe Session Key call cap is removed before the new Smart Session path has an on-chain receipt proving policy enforcement.
- No production/testnet broadcast occurs from this plan without a separate explicit broadcast approval.
- Do not deploy unreviewed copies of third-party authorization contracts merely to reproduce missing addresses.
- The new account must be distinct from legacy Safe `0xB127994eed5f0AA8A42a446E796A2Fcc0D1bB276`; its EntryPoint deposit must not be represented as migrated automatically.
- Browser code must never hold a relayer credential, sponsor credential, or owner private key.
- A policy rejection test for arbitrary target, arbitrary selector, nonzero `value`, expiry, and explicit revocation is required before live deployment.

## Task 1: Lock audited dependency sources and deployment provenance

**Objective:** Identify the exact upstream Solidity repositories, release tags/commit SHAs, licenses, compiler versions, and deployment scripts for Safe 7579 and Smart Sessions.

**Files:**
- Create: `contracts/vendor-manifest.safe7579.json`
- Create: `docs/safe7579-deployment-provenance.md`
- Test: `contracts/test/DeploymentManifest.t.sol`

**Step 1:** Record source URL, immutable tag/SHA, compiler, SPDX license, checksums, expected creation/runtime bytecode and all dependent addresses.

**Step 2:** Reject floating branches, unpinned npm versions, and raw copied contracts with unknown provenance.

**Step 3:** Run a Foundry test that asserts every expected artifact hash and selector used by this project.

## Task 2: Build a local policy harness before adding frontend wiring

**Objective:** Demonstrate chain-level rejection using the exact selected Smart Session contracts.

**Files:**
- Create: `contracts/test/DrawOnlySmartSession.t.sol`
- Create: `contracts/src/DrawOnlySessionPolicy.sol` only if the audited upstream stack requires a project-specific policy adapter
- Test: `contracts/test/DrawOnlySmartSession.t.sol`

**Required tests:**

1. Permits only the deployed Lucky Draw address `0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70`.
2. Permits only selector `draw()` / `0x0eecae21`.
3. Rejects arbitrary target independently.
4. Rejects arbitrary selector independently.
5. Rejects nonzero value independently.
6. Rejects after expiry.
7. Rejects after explicit session revocation.
8. Allows repeated valid draw calls without a count cap.
9. Shows the primary owner can revoke the session without giving the Session Key an admin path.

## Task 3: Create non-broadcast Monad deployment scripts

**Objective:** Produce deterministic scripts that compile and simulate the full stack without broadcasting.

**Files:**
- Create: `contracts/script/DeploySafe7579Stack.s.sol`
- Create: `contracts/script/CreateLuckyDrawSmartSession.s.sol`
- Create: `contracts/script/VerifySafe7579Stack.s.sol`
- Modify: `contracts/foundry.toml`
- Modify: `.env.example` with only variable names and no values

**Required script checks:**

- Monad chain ID is exactly 10143.
- Existing chain code at each expected address is checked before reuse.
- Deployment aborts rather than silently uses a foreign-chain address.
- Scripts distinguish dry-run/simulation from broadcast.
- No script prints private keys, RPC credential values, or secret values.
- The planned deployment output includes code hashes, deployed addresses, and initializer calldata hashes.

## Task 4: Plan new-account funding and app migration without hidden transfers

**Objective:** Keep legacy and new accounts separate and require explicit user-controlled deposits.

**Files:**
- Create: `docs/safe7579-migration-runbook.md`
- Modify: `app/lib/monadConfig.ts`
- Create: `app/lib/safe7579Readiness.ts`
- Test: `tests/safe7579Readiness.test.ts`

**Rules:**

- The new Safe address must not replace the legacy account until bytecode, installed modules and Smart Session authorization are verified.
- The frontend must label legacy/limited and 7579/restricted modes separately.
- A user explicitly deposits into the new Safe’s EntryPoint balance; no balance is moved from the legacy Safe by app code.
- The old 3-call owner-based Session Key remains available only as a clearly marked legacy testnet path until the new flow proves all required rejections.

## Task 5: Broadcast gate — requires separate user authorization

Before testnet broadcast, provide the user with:

- exact third-party deployment artifacts and pinned SHAs;
- count and purpose of every transaction;
- sending EOA / expected gas source;
- all new addresses and bytecode hashes;
- dry-run output and local Foundry test results;
- rollback/recovery process;
- proof that any Session Key has no admin/transfer path.

Only after explicit confirmation may deployment and new Safe/session setup transactions be broadcast.
