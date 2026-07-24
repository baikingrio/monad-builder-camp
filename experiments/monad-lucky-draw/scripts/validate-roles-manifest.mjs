import { readFileSync } from "node:fs";

const manifestPath = process.env.ROLES_MANIFEST_PATH ?? new URL("../contracts/vendor-manifest.roles.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pinnedGitHubTree = /^https:\/\/github\.com\/[^/]+\/[^/]+\/tree\/[0-9a-f]{40}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Roles deployment gate: ${message}`);
}

requireCondition(/^[0-9a-f]{40}$/.test(manifest.roles.commit), "source commit must be a full SHA");
requireCondition(pinnedGitHubTree.test(manifest.roles.sourceUrl), "source URL must be pinned to a full commit SHA");
requireCondition(manifest.roles.sourceUrl.endsWith(manifest.roles.commit), "source URL must end in its pinned commit");

requireCondition(manifest.drawOnly.target === "0x4b3c1adBeeb0776ee31Fd51Eb6169da97A222E70", "draw target changed");
requireCondition(manifest.drawOnly.signature === "draw()", "draw signature changed");
requireCondition(manifest.drawOnly.selector === "0x0eecae21", "draw selector changed");
requireCondition(manifest.drawOnly.value === "0", "draw value must remain zero");
requireCondition(manifest.drawOnly.roleKeyLabel === "LUCKY_DRAW", "role key label changed");

requireCondition(manifest.deployment.permitted === true, "stack deployment must be marked permitted after CREATE2 deploy");
requireCondition(manifest.deployment.blockers?.monadCodeVerified === true, "monadCodeVerified must be true");
requireCondition(manifest.deployment.blockers?.rolesStackPinned === true, "rolesStackPinned must be true");
requireCondition(manifest.deployment.blockers?.broadcastAuthorized === true, "broadcastAuthorized must be true");
requireCondition(
  manifest.deployment.blockers?.onchainRolesProofPresent === true,
  "onchainRolesProofPresent must be true after Roles session enable + draw proof"
);
requireCondition(
  typeof manifest.deployment.sessionProof === "string" && manifest.deployment.sessionProof.length > 0,
  "sessionProof receipt path required"
);
requireCondition(
  manifest.monad.canonicalUpstream.moduleProxyFactory === "0x000000000000aDdB49795b0f9bA5BC298cDda236",
  "moduleProxyFactory address drift"
);
requireCondition(
  manifest.monad.canonicalUpstream.rolesMasterCopy === "0x9646fDAD06d3e24444381f44362a3B0eB343D337",
  "rolesMasterCopy address drift"
);

console.log("Roles manifest gate verified: stack deployed; session proof present; product path open.");
