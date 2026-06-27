# Scope Lessons

- Always confirm the active GCP project is `scope-mvp-prod` before running cloud commands.
- Do not commit private credentials, OAuth tokens, service account keys, or local ADC files.
- Each collaborator must authenticate with their own Google account and be granted IAM access to `scope-mvp-prod`.
- Cloud Storage is for raw/indexable files; Discovery Engine / Agent Search is for retrieval; Vertex AI / Gemini is for synthesis.
- Do Discovery Engine retrieval before Gemini generation.
- Use AI Applications / Agent Search at `https://console.cloud.google.com/gen-app-builder` for Discovery Engine data store setup.
- The separate Agent Platform menu with Studio, Models, Agents, and Notebooks is not the data store setup surface we need.
- The `gcloud discovery-engine` command group may require alpha/beta SDK components; the Console path is the reliable setup path.
- Discovery Engine structured Cloud Storage imports need JSON Lines / NDJSON, not a single JSON array.
- Keep raw JSON arrays for audit/debugging and NDJSON files for indexing.
- The current ingestion source is BBC World RSS only; this is MVP bootstrap data, not the final multi-source feed.
- Python bytecode and virtual environments should stay ignored by git.
- The frontend should consume cached synthesized JSON, not trigger live RSS, Discovery Engine, or Gemini calls from the browser.
- Record generated Discovery Engine data store and search app IDs in `CLAUDE.md` as soon as they exist.
- Update `TASKS.md` after every meaningful completed step so the next agent knows exactly where to resume.
