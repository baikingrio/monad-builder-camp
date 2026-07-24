# Local Safe7579 policy bytecode preflight

Run the local-only report generator:

```sh
npm run preflight:safe7579
```

It reads these checked-in local inputs only:

- `contracts/vendor-manifest.safe7579.json`
- `contracts/out/DrawOnlyActionPolicy.sol/DrawOnlyActionPolicy.json`
- `contracts/out/SessionTimeWindowPolicy.sol/SessionTimeWindowPolicy.json`

The generated, checked-in result is `contracts/preflight/safe7579-preflight.json`. It records each custom policy's artifact path, manifest classification, and Ethereum Keccak-256 hashes for its creation and runtime bytecode. Node's `sha3-256` is deliberately not used because it is not Ethereum Keccak-256; the generator invokes the local `cast keccak` binary with an empty environment and validates its hash output.

## Current result

The current report is `"status": "BLOCKED"`. This is intentional and fail-closed:

- `deployment.permitted` is `false` in the manifest.
- Both custom policies are classified as `localOnly: true`, `auditStatus: "NOT_AUDITED"`, and `deploymentEligible: false`.

A missing or malformed manifest/artifact/hash command is an error rather than a substituted hash or permissive result. The generator contains no deployment command or approval bypass.

## What this proves

- The two named local compiled artifacts were available when the report was generated.
- The report's creation/runtime hashes were calculated from their local bytecode using Ethereum Keccak-256.
- The report accurately carries the manifest's local-policy classification and deployment gate at generation time.
- Generation is non-broadcast and does not read `.env`, access RPC, deploy contracts, submit transactions, or create a Safe.

## What this does not prove

This is **not** Safe7579 deployment integration and does not claim Safe7579 compatibility. It does not deploy or configure Safe7579, create a Safe, verify any chain state/code, authenticate a signer, validate policy behavior, produce a user operation, or prove a future deployment is authorized. A hypothetical non-blocked review result would still need independent audit, explicit deployment authorization, and separate integration review.
