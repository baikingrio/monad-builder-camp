# User-Funded Session Draw Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add an explicit Monad Testnet EntryPoint-deposit recharge flow and make Session Key draws pay gas from the Safe's EntryPoint deposit instead of Pimlico sponsorship.

**Architecture:** The browser EOA sends a direct `EntryPoint.depositTo(safe)` transaction after displaying the counterfactual/deployed Safe address. The server retains the Pimlico-configured bundler URL privately for ERC-4337 submission and estimation, but creates session-draw UserOperations without any Paymaster fields. The fixed `LuckyDraw.draw()` and zero-value checks, authenticated browser session, short Session TTL, and existing three-call cap remain unchanged in this phase.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, viem 2, permissionless 0.3, Pimlico Bundler, Safe 1.4.1, EntryPoint v0.7, Monad Testnet (10143).

---

## Non-negotiable boundaries

- Recharge means `EntryPoint.depositTo(safe)`, not a transfer to an application wallet and not app custody.
- The browser must never receive Pimlico credentials, server session secrets, or any private key.
- User-funded draw UserOperations must have no `paymaster`, `paymasterData`, or Paymaster gas fields.
- Do not change `SESSION_KEY_MAX_CALLS`, TTL, target, selector, value, or current owner-based Session Key model in this phase.
- Do not change `SESSION_KEY_MAX_CALLS` (legacy remains 3), TTL, target, selector, value, or current owner-based Session Key model until Safe7579 has an on-chain policy receipt.
- Session Key enablement and Session draws are user-funded via `EntryPoint.depositTo(safe)`.
- No actual testnet transaction, funding, or contract change is made without a separate explicit user authorization.

## Task 1: Create a pure EntryPoint deposit utility

**Objective:** Provide browser-safe ABI and helpers for reading a Safe deposit and building a deposit transaction.

**Files:**
- Create: `app/lib/entryPointDeposit.ts`
- Create: `tests/entryPointDeposit.test.ts`

**Step 1: Write failing tests** for a fixed EntryPoint target, a fixed Safe beneficiary, native-MON value parsing, and rejection of invalid or zero amounts.

**Step 2: Run** `npm test -- tests/entryPointDeposit.test.ts`; expected: failing because the module does not exist.

**Step 3: Implement** a pure helper exposing `entryPointDepositAbi`, `createDepositRequest`, and amount validation. It must only construct data and never sign or send.

**Step 4: Run the focused test**; expected: pass.

## Task 2: Expose a read-only funding status endpoint

**Objective:** Return the EntryPoint deposit for the authenticated user's derived Safe without exposing sponsor configuration.

**Files:**
- Create: `server/api/draw/funding.get.ts`
- Create: `server/utils/userFundedExecution.ts`
- Create: `tests/userFundedExecution.test.ts`

**Step 1: Write failing tests** for valid Monad/Testnet-safe deposit reads, invalid Safe rejection, and serializable responses that contain no secret-like content.

**Step 2: Run focused tests**; expected: failure because helpers do not exist.

**Step 3: Implement** a server-only RPC reader and a function returning EntryPoint address, Safe address, and deposit balance only. Keep the RPC URL server-side.

**Step 4: Run focused tests**; expected: pass.

## Task 3: Build a no-Paymaster Session Draw UserOperation

**Objective:** Prepare and submit a Session Draw UserOperation paid by the Safe's EntryPoint deposit.

**Files:**
- Modify: `server/utils/sessionExecution.ts`
- Modify: `server/api/draw/session-draw.post.ts`
- Modify: `server/api/draw/session-draw-submit.post.ts`
- Modify: `app/lib/signSessionUserOperation.ts` only if types need to support absent Paymaster fields
- Modify: `tests/sessionKeyPolicy.test.ts`
- Create: `tests/userFundedSessionDraw.test.ts`

**Step 1: Write failing tests** proving a prepared user-funded draw has fixed target/selector/value, no Paymaster fields, and fails before signing when EntryPoint deposit is below a conservative estimated max cost.

**Step 2: Run focused tests**; expected: fail due to current Sponsor-only behavior.

**Step 3: Implement** a `prepareUserFundedSafeCalls` path that gets gas price and estimates through the private Bundler URL but does not call `sponsorUserOperation`. Require sufficient `EntryPoint.balanceOf(safe)` before returning the unsigned UserOperation. Update submission parsing so absent Paymaster fields remain absent.

**Step 4: Run focused tests**; expected: pass.

## Task 4: Add the recharge UI and payment-mode evidence

**Objective:** Let an authenticated user read deposit balance, submit a direct wallet recharge, and see that later draws are user-funded.

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/components/DrawResultCard.vue`
- Create: `tests/entryPointDepositUi.test.ts` if component testing is already supported; otherwise cover extracted pure state helpers.

**Step 1: Write failing tests** for a recharge request that can only target the fixed EntryPoint and current Safe, and for UI state distinguishing Sponsor activation from user-funded draws.

**Step 2: Implement** the read/refresh flow, amount input, wallet `eth_sendTransaction`, receipt wait, error state, and Deposit balance display. Draw controls must remain disabled if user-funded balance is insufficient.

**Step 3: Update wording** so it does not claim later Session draws are sponsored or unlimited.

**Step 4: Run component/pure tests**; expected: pass.

## Task 5: Documentation and regression verification

**Objective:** Align public documentation with actual capabilities and prove no regression.

**Files:**
- Modify: `README.md`
- Modify: `docs/onchain-proof.md`
- Modify: `.env.example` only if a non-secret public configuration value is needed

**Step 1: Document** exact first-draw Sponsor vs later user-funded behavior; explain that EntryPoint Deposit is user-controlled and not app custody.

**Step 2: Retain** the warning that Session Key is currently a Safe owner with broad chain-level authority, so 3-call / TTL limits are not being removed in this phase.

**Step 3: Run:**
```bash
npm test
npx nuxi typecheck
npm run build
git diff --check
```
Expected: all pass.

**Step 4: Commit:**
```bash
git add app server tests README.md docs .env.example
git commit -m "feat(lucky-draw): 支持用户充值支付Session抽卡Gas"
```
