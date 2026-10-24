import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const base = new URL(process.env.QA_BASE_URL || "http://localhost:3100");
assert(
  ["localhost", "127.0.0.1"].includes(base.hostname),
  "Core validation may start only on localhost.",
);

const validationScript =
  process.env.QA_VALIDATION_SCRIPT || "scripts/verify-core.mjs";
if (validationScript === "scripts/verify-core.mjs") {
  const database = new URL(process.env.DATABASE_URL);
  assert(
    ["localhost", "127.0.0.1"].includes(database.hostname),
    "Core validation may use only a local database.",
  );
}

const port = base.port || "3100";
const nextBin = join(dirname(require.resolve("next/package.json")), "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-p", port], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
const remember = (chunk) => {
  serverOutput = (serverOutput + chunk.toString()).slice(-12_000);
};
server.stdout.on("data", remember);
server.stderr.on("data", remember);

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Validation server stopped early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(new URL("/login", base), {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Validation server did not become ready.\n${serverOutput}`);
}

function runCoreSuite() {
  return new Promise((resolve, reject) => {
    const test = spawn(process.execPath, [validationScript], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    test.once("error", reject);
    test.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Core validation failed (${signal ?? `exit ${code}`}).`));
    });
  });
}

try {
  await waitUntilReady();
  await runCoreSuite();
} finally {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}
