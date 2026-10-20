import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("authentication middleware is compiled from the src application root", () => {
  assert.equal(existsSync("middleware.ts"), false);
  assert.equal(existsSync("src/middleware.ts"), true);
  const source = readFileSync("src/middleware.ts", "utf8");
  assert(source.includes('signIn: "/login"'));
  for (const route of [
    "/dashboard/:path*",
    "/bill-details/:path*",
    "/complaints/:path*",
    "/service-history/:path*",
    "/settings/:path*",
  ]) {
    assert(source.includes(route), `Missing protected route ${route}`);
  }
});
