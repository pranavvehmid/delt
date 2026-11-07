# Brief: fix the open issues one by one

- Goal: fix open issues in priority order (security/privacy, data-loss bugs, visible frontend bugs, performance/UX), one issue per commit.
- Context: issues #79-#286 and older open ones; docs/AUDIT.md.
- Requirements: per fix a test where possible, build + relevant tests, commit, push, close the issue with the SHA; full suite in the background, failures fixed at the end.
- Non-goals: items needing accounts/money/phone (#79, signing key, dashboard region moves, #1 #5 #15 #17 #37 #78), F1 rebuild, feature proposals before bugs.
- Acceptance: each fixed issue closed with its commit.
- Assumptions: small safe changes first.
