import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
// Prisma CLI does not automatically load the .env.local used by Next.js.
require("@next/env").loadEnvConfig(process.cwd());
const [command, ...args] = process.argv.slice(2);
const entry = command === "seed" ? require.resolve("tsx/cli") : join(dirname(require.resolve("prisma/package.json")), "build", "index.js");
const cliArgs = command === "seed" ? ["prisma/seed.ts", ...args] : [command, ...args];
const result = spawnSync(process.execPath, [entry, ...cliArgs], { stdio: "inherit", env: process.env });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
