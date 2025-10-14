# GameOrganization join table (multi-group support)

Context: Transition from single Game.organizationId to many-to-many via GameOrganization.

Phases:
1) Schema: add GameOrganization (gameId, organizationId) + indexes; keep existing FK.
2) Backfill: copy existing organizationId into join table.
3) Reads/Writes: update queries to read via join table; writes to insert associations.
4) Cleanup (follow-up PR): drop Game.organizationId once stable.

Tests:
- Ensure games appear in all associated org queries.
- Keep org-scoped creation and guest support intact.

Refs: PR #168; Requested by Mike Wickett (@mwickett)
Devin run: https://app.devin.ai/sessions/7cd67157f5ca4cd4af19542a7760cbe1
