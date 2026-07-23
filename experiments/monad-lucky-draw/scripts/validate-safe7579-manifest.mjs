import { readFileSync } from "node:fs";

const manifestPath = process.env.SAFE7579_MANIFEST_PATH ?? new URL("../contracts/vendor-manifest.safe7579.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sha256 = /^[0-9a-f]{64}$/;
const keccak256 = /^0x[0-9a-f]{64}$/;
const pinnedGitHubTree = /^https:\/\/github\.com\/[^/]+\/[^/]+\/tree\/[0-9a-f]{40}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Safe7579 deployment gate: ${message}`);
}

for (const source of [manifest.safe7579, manifest.smartSessions]) {
  requireCondition(/^[0-9a-f]{40}$/.test(source.commit), "source commit must be a full SHA");
  requireCondition(pinnedGitHubTree.test(source.sourceUrl), "source URL must be pinned to a full commit SHA");
  requireCondition(source.sourceUrl.endsWith(source.commit), "source URL must end in its pinned commit");
}

for (const artifact of Object.values(manifest.artifacts)) {
  requireCondition(sha256.test(artifact.sourceSha256), "artifact source SHA-256 is invalid");
  requireCondition(sha256.test(artifact.artifactSha256), "artifact JSON SHA-256 is invalid");
  requireCondition(keccak256.test(artifact.creationKeccak256), "artifact creation keccak256 is invalid");
  requireCondition(keccak256.test(artifact.runtimeKeccak256), "artifact runtime keccak256 is invalid");
}

requireCondition(manifest.drawOnly.target === "0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70", "draw target changed");
requireCondition(manifest.drawOnly.signature === "draw()", "draw signature changed");
requireCondition(manifest.drawOnly.selector === "0x0eecae21", "draw selector changed");
requireCondition(manifest.drawOnly.value === "0", "draw value must remain zero");

requireCondition(manifest.deployment.permitted === false, "deployment must remain disabled");
for (const name of [
  "timeFramePolicyAudited",
  "valueLimitPolicyAudited",
  "fullPolicyStackPinned",
  "monadCodeVerified",
]) {
  requireCondition(manifest.deployment.blockers?.[name] === false, `required blocker ${name} must remain unresolved`);
}

console.log("Safe7579 manifest gate verified: deployment remains disabled.");
