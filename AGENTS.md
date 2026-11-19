# Project conventions

You are helping build a MongoDB application. Apply these conventions on every prompt.

## Context and stack
- Read `CONTEXT.md` and existing code before making changes.
- Use Node.js, Express, and the official `mongodb` driver; no ODMs.
- Reuse one `MongoClient`, connected at startup, not per request.

## MongoDB
- Connect to `mongodb://localhost:27017/workshop`; this is local, not Atlas.
- Model around access patterns, not CSVs. Explain embedding and index choices.
- Use Skills for guidance, MCP for live inspection, and the driver for app code.

## Workflow
- Show schemas and pipelines for review before implementation.
- Ask before destructive operations; never expose or commit credentials.
- Run changed code, test affected endpoints, and report what you verified.
  Restart the API after route changes.
