# Gates: antigravity-dual-node

OWNS: README.md, ARCHITECTURE.md, WINDOWS_SETUP.md, MAC_SETUP.md, AGENTS.md, package.json, .gitignore, .env.example, scripts/**, tasks/**

Scope: Complete repository for concurrent Antigravity orchestration between Mac daily driver and Windows HP OMEN GPU compute node, published to GitHub.

- [ ] G1: Project configuration and node test suite pass
  CHECK: node scripts/verify-setup.mjs
  EXPECT: dual-node verification passed
  CWD: /Users/gadgetplug/Documents/vibecoding/antigravity-dual-node
  EVIDENCE: pending

- [ ] G2: Task queue dispatch and worker daemon validate cleanly
  CHECK: node scripts/mac/dispatch-task.mjs --test
  EXPECT: task dispatch test passed
  CWD: /Users/gadgetplug/Documents/vibecoding/antigravity-dual-node
  EVIDENCE: pending

- [ ] G3: GitHub repository initialized, committed, and pushed to remote
  CHECK: gh repo view ronkenx9/antigravity-dual-node --json nameWithOwner -q .nameWithOwner
  EXPECT: ronkenx9/antigravity-dual-node
  CWD: /Users/gadgetplug/Documents/vibecoding/antigravity-dual-node
  EVIDENCE: pending
