export function isChunkLoadError(error: { name?: string; message?: string }) {
  return error.name === "ChunkLoadError" ||
    /Loading (?:CSS )?chunk\b[\s\S]*failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message ?? "");
}
