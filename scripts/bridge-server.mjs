#!/usr/bin/env node
// ==============================================================================
// Antigravity Direct LAN Bridge Server
// Runs on Mac (192.168.100.203:8080) for real-time task streaming to HP OMEN
// ==============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(REPO_ROOT, 'tasks', 'results');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const PORT = 8080;
const HOST = '0.0.0.0';

// In-memory queue with disk persistence
const taskQueue = [];
const taskResults = new Map();
let lastWorkerHeartbeat = null;
let workerInfo = { host: 'Waiting for OMEN...', gpu: 'Unknown' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Worker Heartbeat & Registration
  if (req.method === 'POST' && url.pathname === '/api/heartbeat') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        lastWorkerHeartbeat = new Date().toISOString();
        if (data.host) workerInfo.host = data.host;
        if (data.gpu) workerInfo.gpu = data.gpu;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: lastWorkerHeartbeat }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Worker Polls for Next Task
  if (req.method === 'GET' && url.pathname === '/api/next-task') {
    lastWorkerHeartbeat = new Date().toISOString();
    const pendingIdx = taskQueue.findIndex(t => t.status === 'pending');
    if (pendingIdx !== -1) {
      const task = taskQueue[pendingIdx];
      task.status = 'in_progress';
      task.startedAt = new Date().toISOString();
      console.log(`⚡ [LAN Bridge] Handed task ${task.id} (${task.type}) to HP OMEN worker`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasTask: true, task }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasTask: false }));
    }
    return;
  }

  // 3. Worker Submits Task Result
  if (req.method === 'POST' && url.pathname.startsWith('/api/task/') && url.pathname.endsWith('/result')) {
    const parts = url.pathname.split('/');
    const taskId = parts[3];
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const result = JSON.parse(body);
        result.receivedAt = new Date().toISOString();
        taskResults.set(taskId, result);

        // Update task state in queue
        const task = taskQueue.find(t => t.id === taskId);
        if (task) {
          task.status = result.status;
          task.durationSec = result.durationSec;
          task.finishedAt = result.finishedAt;
        }

        // Save result file to tasks/results/
        const resultPath = path.join(RESULTS_DIR, `${taskId}.json`);
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

        console.log(`🏁 [LAN Bridge] Task ${taskId} COMPLETED by HP OMEN in ${result.durationSec}s!`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'recorded', taskId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4. Submit New Task (from Mac Commander or CLI)
  if (req.method === 'POST' && url.pathname === '/api/dispatch') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const spec = JSON.parse(body || '{}');
        const task = {
          id: `task_${randomUUID().slice(0, 8)}`,
          status: 'pending',
          createdAt: new Date().toISOString(),
          type: spec.type || 'custom-command',
          command: spec.command || '',
          priority: spec.priority || 'normal',
          payload: spec.payload || {}
        };
        taskQueue.push(task);
        console.log(`📥 [LAN Bridge] New task queued: ${task.id} -> "${task.command}"`);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'queued', task }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Query Status & Telemetry
  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      bridge: 'online',
      commander: 'Mac (192.168.100.203)',
      workerInfo,
      lastHeartbeat: lastWorkerHeartbeat,
      queueLength: taskQueue.length,
      tasks: taskQueue.slice(-10),
      recentResults: Array.from(taskResults.values()).slice(-5)
    }, null, 2));
    return;
  }

  // 6. Live Dashboard (HTML)
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
    const isWorkerOnline = lastWorkerHeartbeat && (Date.now() - new Date(lastWorkerHeartbeat).getTime() < 10000);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Antigravity Dual-Node Bridge</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; }
    header { border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8; }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .online { background: #065f46; color: #34d399; }
    .offline { background: #7f1d1d; color: #f87171; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border-radius: 8px; padding: 18px; border: 1px solid #334155; }
    .card h3 { margin-top: 0; font-size: 14px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .metric { font-size: 20px; font-weight: 700; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; font-size: 13px; }
    th { color: #94a3b8; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
  <meta http-equiv="refresh" content="3">
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>⚡ Antigravity Dual-Node Bridge</h1>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Direct LAN Link: Mac ↔ HP OMEN</div>
      </div>
      <div>
        <span class="badge ${isWorkerOnline ? 'online' : 'offline'}">
          ${isWorkerOnline ? '● OMEN Worker Connected' : '○ Waiting for Worker'}
        </span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h3>🍎 Mac Commander</h3>
        <div class="metric">192.168.100.203:8080</div>
        <div style="font-size: 13px; color: #94a3b8;">Status: Active Hub</div>
      </div>
      <div class="card">
        <h3>🪟 HP OMEN (Worker)</h3>
        <div class="metric">${workerInfo.gpu || 'GeForce GTX 1660 Ti'}</div>
        <div style="font-size: 13px; color: #94a3b8;">Host: ${workerInfo.host} | Last Seen: ${lastWorkerHeartbeat ? new Date(lastWorkerHeartbeat).toLocaleTimeString() : 'Never'}</div>
      </div>
    </div>

    <div class="card">
      <h3>Active Task Queue (${taskQueue.length} total)</h3>
      ${taskQueue.length === 0 ? '<p style="color:#64748b; font-size:14px;">No tasks queued yet.</p>' : `
      <table>
        <thead>
          <tr><th>ID</th><th>Type</th><th>Command</th><th>Status</th><th>Duration</th></tr>
        </thead>
        <tbody>
          ${taskQueue.map(t => `
            <tr>
              <td><code>${t.id}</code></td>
              <td>${t.type}</td>
              <td><code>${t.command}</code></td>
              <td><span style="color:${t.status === 'completed' ? '#34d399' : t.status === 'in_progress' ? '#38bdf8' : '#fbbf24'}">${t.status}</span></td>
              <td>${t.durationSec ? t.durationSec + 's' : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`========================================================`);
  console.log(`⚡ Antigravity Direct LAN Bridge Server Running!`);
  console.log(`🌐 Local URL:     http://localhost:${PORT}`);
  console.log(`📡 Network URL:   http://192.168.100.203:${PORT}`);
  console.log(`========================================================`);
});
