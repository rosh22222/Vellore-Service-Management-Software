process.env.QA_VALIDATION_SCRIPT = "scripts/verify-live-smoke.mjs";
await import("./run-core-validation.mjs");
