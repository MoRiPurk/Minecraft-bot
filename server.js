const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cfg = require('./config');
const botManager = require('./botManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- REST API ----

app.get('/api/bots', (req, res) => {
  res.json(botManager.getAllStatus());
});

app.get('/api/bots/:username', (req, res) => {
  const status = botManager.getStatus(req.params.username);
  if (!status) return res.status(404).json({ error: 'ไม่พบบอทนี้' });
  res.json(status);
});

app.post('/api/bots/:username/disconnect', (req, res) => {
  const ok = botManager.disconnectBot(req.params.username);
  res.json({ ok });
});

app.post('/api/bots/:username/reconnect', (req, res) => {
  const ok = botManager.reconnectBot(req.params.username);
  res.json({ ok });
});

app.post('/api/bots', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'ต้องระบุ username' });
  const ok = botManager.addBot(username);
  res.json({ ok });
});

// ---- WebSocket broadcast ----

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

botManager.on('update', (username, state) => {
  broadcast({ type: 'update', username, state });
});

botManager.on('log', (username, line) => {
  broadcast({ type: 'log', username, line });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', bots: botManager.getAllStatus() }));
});

// ---- เริ่มบอททั้งหมดตาม config ----
cfg.bots.forEach((b) => botManager.connectBot(b.username));

const PORT = cfg.webPort || 3000;
server.listen(PORT, () => {
  console.log(`Bot dashboard พร้อมใช้งานที่ http://localhost:${PORT}`);
});
