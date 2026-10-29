#!/usr/bin/env node
// ==============================================================================
// Task Dispatcher for Mac Commander -> Windows OMEN Worker Node
// Adds work items to tasks/queue.json with cryptographic ID & timestamps
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.join(REPO_ROOT, 'tasks', 'queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    return { version: '1.0', updatedAt: new Date().toISOString(), tasks: [] };
  }
  const raw = fs.readFileSync(QUEUE_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse queue.json: ${err.message}`);
  }
}

function writeQueue(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function dispatchTask(taskSpec) {
  const queue = readQueue();
  const task = {
    id: `task_${randomUUID().slice(0, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    submittedBy: 'mac-commander',
    type: taskSpec.type || 'custom-command',
    command: taskSpec.command || '',
    priority: taskSpec.priority || 'normal',
    payload: taskSpec.payload || {}
  };

  queue.tasks.push(task);
  writeQueue(queue);
  return task;
}

// CLI Execution Handling
const args = process.argv.slice(2);

if (args.includes('--test')) {
  console.log('🧪 Running task dispatch self-test...');
  const queueBefore = readQueue();
  const testTask = dispatchTask({
    type: 'diagnostic-test',
    command: 'python -c "print(\'dual-node worker verification\')"',
    priority: 'high',
    payload: { dryRun: true }
  });

  const queueAfter = readQueue();
  const found = queueAfter.tasks.find((t) => t.id === testTask.id);

  if (!found || found.status !== 'pending') {
    console.error('❌ Task was not properly written to queue.json');
    process.exit(1);
  }

  // Clean up test task
  queueAfter.tasks = queueAfter.tasks.filter((t) => t.id !== testTask.id);
  writeQueue(queueAfter);

  console.log('✅ task dispatch test passed');
  process.exit(0);
}

// Normal CLI dispatch
const typeIdx = args.indexOf('--type');
const cmdIdx = args.indexOf('--command');

if (typeIdx === -1 && cmdIdx === -1) {
  console.log(`
Usage:
  node dispatch-task.mjs --type <task-type> --command <cmd> [--priority high|normal]
  node dispatch-task.mjs --test

Examples:
  node dispatch-task.mjs --type blender-render --command "blender -b scene.blend -f 1"
  node dispatch-task.mjs --type comfyui-prompt --command "python scripts/trigger-workflow.py"
  node dispatch-task.mjs --test
`);
  process.exit(0);
}

const taskType = typeIdx !== -1 ? args[typeIdx + 1] : 'custom-command';
const commandStr = cmdIdx !== -1 ? args[cmdIdx + 1] : '';

const dispatched = dispatchTask({
  type: taskType,
  command: commandStr,
  priority: args.includes('--high') ? 'high' : 'normal'
});

console.log(`🚀 Task dispatched to Windows OMEN queue:`);
console.log(JSON.stringify(dispatched, null, 2));
