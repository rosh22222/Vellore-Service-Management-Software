import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

type BrandAsset = "vellore-logo-transparent.png" | "avatar.png";
const publicDirectory = path.join(process.cwd(), "public");
const assets = new Map<string, { revision: string; contents: Buffer; version: string }>();

function readAsset(filename: BrandAsset, directory: string) {
  const file = path.join(directory, filename);
  const stat = statSync(file);
  const revision = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const cached = assets.get(file);
  if (cached?.revision === revision) return cached;

  const contents = readFileSync(file);
  const asset = {
    revision,
    contents,
    version: createHash("sha256").update(contents).digest("hex").slice(0, 16),
  };
  assets.set(file, asset);
  return asset;
}

// A replacement file gets a new browser/Next Image cache key automatically.
export function getBrandAssetSrc(filename: BrandAsset, directory = publicDirectory) {
  return `/${filename}?v=${readAsset(filename, directory).version}`;
}

// PDF generation must refresh the logo too, not keep the first file forever.
export function getBrandAssetDataUrl(filename: BrandAsset, directory = publicDirectory) {
  return `data:image/png;base64,${readAsset(filename, directory).contents.toString("base64")}`;
}
