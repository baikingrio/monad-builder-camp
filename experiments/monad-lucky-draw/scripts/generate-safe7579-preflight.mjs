import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestRelativePath = "contracts/vendor-manifest.safe7579.json";
const outputRelativePath = "contracts/preflight/safe7579-preflight.json";
const policyArtifacts = [
  {
    manifestKey: "drawOnlyActionPolicy",
    contractName: "DrawOnlyActionPolicy",
    artifactRelativePath: "contracts/out/DrawOnlyActionPolicy.sol/DrawOnlyActionPolicy.json",
  },
  {
    manifestKey: "sessionTimeWindowPolicy",
    contractName: "SessionTimeWindowPolicy",
    artifactRelativePath: "contracts/out/SessionTimeWindowPolicy.sol/SessionTimeWindowPolicy.json",
  },
];

function fail(message) {
  throw new Error(`Safe7579 local preflight blocked: ${message}`);
}

function readJson(relativePath) {
  const path = resolve(projectRoot, relativePath);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${relativePath}: ${error.message}`);
  }
}

function artifactBytecode(artifact, field, artifactPath) {
  const bytecode = artifact?.[field]?.object;
  if (typeof bytecode !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(bytecode)) {
    fail(`${artifactPath} has no valid ${field}.object bytecode`);
  }
  return bytecode;
}

function keccak256(bytecode, label) {
  // Node provides SHA3-256, which is not Ethereum Keccak-256. Never substitute it.
  try {
    const hash = execFileSync("/usr/local/bin/cast", ["keccak", bytecode], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {},
    }).trim();
    if (!/^0x[0-9a-f]{64}$/.test(hash)) fail(`cast returned an invalid Keccak-256 for ${label}`);
    return hash;
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error.message;
    fail(`cannot calculate Ethereum Keccak-256 for ${label} with cast: ${detail}`);
  }
}

const manifest = readJson(manifestRelativePath);
if (!manifest?.customPolicies || !manifest?.deployment) fail("manifest lacks custom policy or deployment classification");

const policies = policyArtifacts.map(({ manifestKey, contractName, artifactRelativePath }) => {
  const classification = manifest.customPolicies[manifestKey];
  if (!classification) fail(`manifest lacks customPolicies.${manifestKey}`);

  const artifact = readJson(artifactRelativePath);
  const creationBytecode = artifactBytecode(artifact, "bytecode", artifactRelativePath);
  const runtimeBytecode = artifactBytecode(artifact, "deployedBytecode", artifactRelativePath);

  return {
    name: contractName,
    artifactPath: artifactRelativePath,
    manifestClassification: {
      sourcePath: classification.sourcePath,
      localOnly: classification.localOnly,
      auditStatus: classification.auditStatus,
      deploymentEligible: classification.deploymentEligible,
    },
    creationKeccak256: keccak256(creationBytecode, `${contractName} creation bytecode`),
    runtimeKeccak256: keccak256(runtimeBytecode, `${contractName} runtime bytecode`),
  };
});

const blockedReasons = [];
if (manifest.deployment.permitted !== true) blockedReasons.push("manifest.deployment.permitted is not true");
for (const policy of policies) {
  if (policy.manifestClassification.auditStatus === "NOT_AUDITED") {
    blockedReasons.push(`${policy.name} is NOT_AUDITED`);
  }
  if (policy.manifestClassification.deploymentEligible !== true) {
    blockedReasons.push(`${policy.name} is not deployment eligible`);
  }
}

const report = {
  schemaVersion: "1",
  kind: "local-safe7579-policy-bytecode-preflight",
  status: blockedReasons.length === 0 ? "READY_FOR_SEPARATE_REVIEW" : "BLOCKED",
  localOnly: true,
  nonBroadcast: true,
  manifestPath: manifestRelativePath,
  deployment: {
    permitted: manifest.deployment.permitted,
    blockers: manifest.deployment.blockers,
    reason: manifest.deployment.reason,
  },
  policies,
  blockedReasons,
  guarantees: [
    "Reads only the local manifest and the two local compiled artifact JSON files.",
    "Calculates Ethereum Keccak-256 through local cast keccak; no SHA3-256 substitution is used.",
    "Does not read .env, access RPC, broadcast transactions, deploy contracts, or create a Safe.",
  ],
  limitations: [
    "This is not Safe7579 deployment integration or proof of Safe7579 compatibility.",
    "This does not verify on-chain code, account state, signatures, configuration, or policy behavior.",
    "A non-BLOCKED result would still require separate audit, deployment authorization, and integration review.",
  ],
};

const outputPath = resolve(projectRoot, outputRelativePath);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Safe7579 local preflight written: ${outputRelativePath} (${report.status})`);
