// Stable orchestration entry point used by package scripts and automation.
// Each importer owns one public-data boundary and validates before writing.
await import("./update-institutional.mjs");
await import("./update-government.mjs");
