import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname), "Local PostgreSQL only");
const name = `vfe_qa_${Date.now()}`;
assert(/^vfe_qa_\d+$/.test(name));
const maintenanceUrl = new URL(url); maintenanceUrl.pathname = "/postgres";
const maintenance = new PrismaClient({ datasourceUrl: maintenanceUrl.toString() });
let created = false, db;
try {
  await maintenance.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created = true;
  url.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "production", VFE_ADMIN_PASSWORD: randomUUID() };
  for (const args of [["migrate", "deploy"], ["seed"]]) {
    const result = spawnSync(process.execPath, ["scripts/db-command.mjs", ...args], { env, stdio: "inherit" });
    assert.equal(result.status, 0, `Fresh database ${args.join(" ")}`);
  }
  db = new PrismaClient({ datasourceUrl: url.toString() });
  assert.equal(await db.user.count(), 1, "Production seed only creates owner");
  assert.equal(await db.customer.count(), 0);
  assert.equal(await db.billDetail.count(), 0);
  assert.equal(await db.technician.count(), 0);
  assert.equal(await db.brand.count(), 8, "Default brand master data is seeded");
  const migrations = await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
  const expectedMigrationCount = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  assert.equal(migrations[0].count, expectedMigrationCount);
  console.log(`PASS All ${expectedMigrationCount} migrations apply to a fresh database; production seed creates only the owner, brand master data, no demo business records or technicians.`);
} finally {
  if (db) await db.$disconnect();
  if (created) {
    await maintenance.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    console.log("Cleanup: only the temporary migration-test database was removed.");
  }
  await maintenance.$disconnect();
}
