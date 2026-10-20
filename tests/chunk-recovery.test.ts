import assert from "node:assert/strict";
import { test } from "node:test";
import { isChunkLoadError } from "../src/lib/client-errors";

test("stale route chunks request a full reload across browser error formats", () => {
  for (const error of [
    { name: "ChunkLoadError", message: "A page bundle is unavailable" },
    { message: "Loading chunk app/(dashboard)/equipment/page failed.\n(error: http://localhost:3001/_next/static/chunks/app/(dashboard)/equipment/page.js)" },
    { message: "Loading CSS chunk 12 failed." },
    { message: "Failed to fetch dynamically imported module: http://localhost:3000/chunk.js" },
    { message: "Importing a module script failed." },
  ]) assert.equal(isChunkLoadError(error), true);
});

test("form, database and unrelated network errors keep the normal retry path", () => {
  for (const message of [
    "PIN Code is required.",
    "Can't reach database server at 127.0.0.1:55432",
    "Cannot delete this bill because its equipment has service history.",
    "Failed to fetch",
    "",
  ]) assert.equal(isChunkLoadError({ name: "Error", message }), false);
});
