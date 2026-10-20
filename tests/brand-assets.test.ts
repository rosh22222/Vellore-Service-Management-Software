import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getBrandAssetDataUrl, getBrandAssetSrc } from "../src/lib/brand-assets";

test("public logo and avatar have versioned URLs and matching PDF bytes", () => {
  for (const filename of ["vellore-logo-transparent.png", "avatar.png"] as const) {
    const bytes = readFileSync(path.join(process.cwd(), "public", filename));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.match(getBrandAssetSrc(filename), new RegExp(`^/${filename.replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}$`));
    assert.equal(getBrandAssetDataUrl(filename), `data:image/png;base64,${bytes.toString("base64")}`);
  }
});

test("replacing a logo refreshes its URL and PDF contents without restarting", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "vfe-brand-assets-test-"));
  const file = path.join(directory, "vellore-logo-transparent.png");
  try {
    writeFileSync(file, "test-only old image bytes");
    const oldSrc = getBrandAssetSrc("vellore-logo-transparent.png", directory);
    const oldData = getBrandAssetDataUrl("vellore-logo-transparent.png", directory);
    assert.equal(getBrandAssetSrc("vellore-logo-transparent.png", directory), oldSrc);

    writeFileSync(file, "test-only replacement image bytes, different length");
    const newSrc = getBrandAssetSrc("vellore-logo-transparent.png", directory);
    assert.notEqual(newSrc, oldSrc);
    assert.notEqual(getBrandAssetDataUrl("vellore-logo-transparent.png", directory), oldData);
    assert.equal(getBrandAssetDataUrl("vellore-logo-transparent.png", directory), `data:image/png;base64,${readFileSync(file).toString("base64")}`);
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
});
