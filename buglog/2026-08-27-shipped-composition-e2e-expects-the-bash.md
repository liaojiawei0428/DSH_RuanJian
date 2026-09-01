---
date: "2026-08-27T04:53:45.269Z"
symptom: "shipped-composition.e2e expects the bash tool but receives pwsh (\\\"unknown tool \\\\\\\"bash\\\\\\\"\\\" in code-mode/turn-tail rows; minimal-preset roster mismatch) when replaying apps/web suites on Windows"
component: "apps-web-e2e-lane"
severity: "minor"
status: "open"
root_cause: "The shell capability registers the pwsh provider on Windows and the bash provider on POSIX, while the committed web e2e tool rosters and fixture scripts pin the POSIX spelling; the lane is therefore only decisive on POSIX hosts by design (platform matrix owned by CI)."
fix: "No repo change made. Classification: authoritative verdicts for these expectations come from CI's POSIX matrix; local Windows runs should treat this cluster as expected-to-fail until someone opts to add per-platform rosters."
related_files:
---

Observed while verifying that the plugin-description projection change did not regress the web surface: after fixing a JSONL escaping defect, remaining failure clusters were (a) tool-roster equality vs the POSIX pinned golden, (b) code-mode/turn-tail rows reading unknown tool \"bash\", and (c) minimal-preset persisted-shell assertions. Every dispatched shell call succeeds locally through pwsh. Unrelated to the host plugin-inventory description field or the client ui-settings-plugin-inventory card changes: those lanes are covered by packages/host/plugin-inventory and packages/client/ui-settings-plugin-inventory vitest suites plus build, all green. Also noted separately: settings-chrome overlay-mask interception flake under sequential full-suite load.
