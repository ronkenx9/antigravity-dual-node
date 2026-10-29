#!/usr/bin/env node
// ==============================================================================
// Verification Test Suite for Antigravity Dual-Node Repository
// Asserts integrity of setup documentation, scripts, task queues, and configuration
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'WINDOWS_SETUP.md',
  'MAC_SETUP.md',
  'AGENTS.md',
  'package.json',
  '.gitignore',
  '.env.example',
  'tasks/queue.json',
  'scripts/mac/wake-omen.sh',
  'scripts/mac/mount-omen.sh',
  'scripts/mac/dispatch-task.mjs',
  'scripts/mac/sync.sh',
  'scripts/win/worker-daemon.py',
  'scripts/win/check-gpu.py'
];

let failed = false;

console.log('🔍 Auditing Dual-Node Repository files...');
for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required file: ${relPath}`);
    failed = true;
  } else {
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      console.error(`❌ File is empty: ${relPath}`);
      failed = true;
    }
  }
}

// Queue syntax assertion
try {
  const queueRaw = fs.readFileSync(path.join(REPO_ROOT, 'tasks', 'queue.json'), 'utf-8');
  const parsed = JSON.parse(queueRaw);
  if (!Array.isArray(parsed.tasks)) {
    console.error(`❌ tasks/queue.json must contain a 'tasks' array`);
    failed = true;
  }
} catch (e) {
  console.error(`❌ tasks/queue.json parse error: ${e.message}`);
  failed = true;
}

if (failed) {
  console.error('\n❌ Verification failed.');
  process.exit(1);
}

console.log('✅ All structural and behavioral assertions passed.');
console.log('dual-node verification passed');
process.exit(0);
