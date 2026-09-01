---
date: "2026-08-27T04:53:45.223Z"
symptom: "DSH_SNAPSHOT=replay web e2e seed seeding fails with \"SyntaxError: Bad escaped character in JSON at position ~97\" across ~20 suite files when run on Windows"
component: "apps-web-test-scaffold"
severity: "major"
status: "fixed"
root_cause: "realizeSeedFixture in apps/web/tests/scaffold.ts interpolated the absolute workspaceCwd into session-JSONL fixture text without JSON-string escaping; POSIX paths are valid JSON verbatim, but Windows backslash paths form invalid escape sequences (\\D, \\S), so every downstream JSON.parse of realized lines threw"
fix: "Escape interpolated values as JSON string literals in apps/web/tests/scaffold.ts realizeSeedFixture: JSON.stringify(id).slice(1,-1) for {{sessionId}} and for both the {{cwd}} join and the secondary fixture-header cwd rewrite join."
related_files:
  - "apps/web/tests/scaffold.ts"
---

Found during post-change verification of the plugin-description feature via DSH_SNAPSHOT=replay of apps/web tests on Windows: ~20 suite files failed before any behavior assertion with SyntaxError at varying positions near 85-105 in line 1. Suspected Windows cwd early from failing files' reliance on seed fixtures carrying cwd:'{{cwd}}'; located realizeSeedFixture in apps/web/tests/scaffold.ts which splits '{{cwd}}'/'{{sessionId}}' placeholders against a JSONL text and joins raw values, then parses it back through parseSeedFixture/parseSessionLog. Reproduced standalone with node: an unescaped E:\... path produces exactly this SyntaxError while JSON.stringify(value).slice(1,-1) interpolation parses cleanly. Applied the escaping to all three join sites; isolated re-run of chat-scroll-contract.e2e.ts went from 5/5 fail (all SyntaxError) to 2 passed / 3 failed with purely timing/touch-related assertions and zero parse errors. The record-mode write-back direction (tokenize toward {{cwd}}) needs no counterpart change because it removes paths rather than injecting them.
