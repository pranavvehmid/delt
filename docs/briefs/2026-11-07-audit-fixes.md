# Brief: non-F1 audit fixes

- Goal: fix the open items in docs/AUDIT.md (A03-A18) in the planned order, F1 items excluded.
- Context: src/app/styles/*.css, list-states.tsx, inbox-app.tsx, mail-view.tsx; e2e tests.
- Requirements: one item (or tight group) per commit; build, relevant tests and a phone + laptop screenshot each; mark AUDIT.md; push.
- Non-goals: F1 redesign (F01-F06), deploys.
- Acceptance: each item marked fixed with its SHA, or honestly reported as partial.
- Assumptions: keep each look's identity; only correct the defect.
