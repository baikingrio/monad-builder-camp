# Pimlico Sponsor Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Pimlico-sponsored Safe activation + LuckyDraw.draw() UserOperation on Monad Testnet with fail-closed gates and honest UI.

**Architecture:** Server holds Pimlico credentials and policy gates (SQLite claimOnce, rate limit, budget, circuit breaker). Activate returns an unsigned-sponsored UserOp for Owner wallet signature; submit broadcasts and waits for receipt. No browser secrets.

**Tech Stack:** Nuxt 4, Nitro, Viem, permissionless, SQLite (`node:sqlite`), Vitest, Safe4337Module `0x75cf…`, EntryPoint v0.7.

## Global Constraints

- Chain ID must be `10143` only
- LuckyDraw target pinned to deployed contract; selector `0x0eecae21`; value `0`
- Never require or expose `LUCKY_DRAW_SPONSOR_PRIVATE_KEY`
- Never claim UserOp success without public hash/receipt
- Session Key and Faucet remain out of scope

---

## File map

| File | Responsibility |
|------|----------------|
| `server/utils/runtime.ts` | Sponsor readiness can become `enabled: true` without private key |
| `server/utils/rateLimit.ts` | In-process IP/EOA rate limit, budget gate, circuit breaker |
| `server/utils/budgetStore.ts` | Durable spent-gas counter (SQLite or extend sqliteStore) |
| `server/utils/liveExecutionConfig.ts` | Bundler URL factory with `monad-testnet` + `add_balance_override` |
| `server/api/draw/readiness.get.ts` | Wire real gates |
| `server/api/draw/activate.post.ts` | Claim + build + sponsor UserOp, return unsigned fields |
| `server/api/draw/submit.post.ts` | Accept signed UserOp, send, poll receipt |
| `app/lib/activationUserOperation.ts` | Pure helpers / client signing helpers |
| `app/components/DrawResultCard.vue` + `index.vue` | Enable activate CTA |
| `tests/*` | TDD coverage for each gate and API boundary |
| `.env.example` / `README.md` | Document enable path honestly |

---

### Task 1: Sponsor readiness without private key

**Files:** `server/utils/runtime.ts`, `tests/sponsorPolicy.test.ts` (or `tests/runtime.test.ts`)

- [ ] Write failing test: when all gates true (enabled flag, persistent store, sessionSecret≥32, paymaster, target, budget, breaker) → `enabled: true`; response never includes secrets; private key not required
- [ ] Write failing test: any missing gate → `enabled: false` with that gate in `missing`; no `non-signing-task-boundary`
- [ ] Implement `sponsorReadiness` accordingly
- [ ] Run `npm test -- --run tests/sponsorPolicy.test.ts`
- [ ] Commit: `feat(lucky-draw): allow sponsor readiness without private key`

### Task 2: Rate limit, budget, circuit breaker

**Files:** `server/utils/rateLimit.ts`, optionally `server/utils/sqliteStore.ts`, `tests/rateLimit.test.ts`

- [ ] Failing tests for allow/deny by IP and EOA cooldown
- [ ] Failing tests for budget available → spent → unavailable
- [ ] Failing tests for breaker open after N failures, closed after success/cooldown
- [ ] Minimal in-process + SQLite budget implementation
- [ ] Run tests green
- [ ] Commit: `feat(lucky-draw): add sponsor rate limit budget breaker`

### Task 3: Wire readiness API

**Files:** `server/api/draw/readiness.get.ts`, `tests` if present

- [ ] Pass real budget/breaker availability into `sponsorReadiness`
- [ ] Update `.env.example` comments (private key optional / unused)
- [ ] Commit: `feat(lucky-draw): wire draw readiness to live gates`

### Task 4: Activation UserOperation construction (pure + mocked sponsor)

**Files:** `app/lib/activationUserOperation.ts`, `tests/activationUserOperation.test.ts`

- [ ] Failing tests: only fixed LuckyDraw draw calldata; rejects tampering; requires verified owner + not-deployed (or deployed draw-only) Safe; never embeds API keys
- [ ] Implement factory+module callData construction helpers (permissionless/viem)
- [ ] Run tests green
- [ ] Commit: `feat(lucky-draw): add activation user operation builders`

### Task 5: Activate + submit API

**Files:** `server/api/draw/activate.post.ts`, `server/api/draw/submit.post.ts`, server utils, tests with mocked fetch

- [ ] Failing tests: unauthenticated / rate-limited / budget / policy reject
- [ ] Activate: claimOnce then sponsor; return serializable UserOp without secrets
- [ ] Submit: require matching claim/session; sendUserOperation; return hashes only after success path
- [ ] Commit: `feat(lucky-draw): add sponsored activate and submit APIs`

### Task 6: UI wiring

**Files:** `DrawResultCard.vue`, `index.vue`, `tests/index-page.test.ts`, related component tests

- [ ] Enable button when authenticated + safe derived + deployment checked + readiness enabled
- [ ] Flow: activate → wallet sign → submit → show explorer links only with hashes
- [ ] Failures surface honestly
- [ ] Update README status
- [ ] Commit: `feat(lucky-draw): wire sponsored activation UI`

### Task 7: Verification

- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual smoke: enable flag true, one real UserOp or document failure with public error
