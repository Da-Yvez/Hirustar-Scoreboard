const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { contestants: fallbackContestants, judges: fallbackJudges } = require('./data');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  allowEIO3: true // Support older clients if any
});

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

const STATE_FILE = path.join(baseDir, 'state.json');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function clampScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function loadStateFromDisk() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contestants) || !Array.isArray(parsed.judges)) return null;
    return parsed;
  } catch (e) {
    console.warn('[STATE] Failed to load state.json, falling back to data.js');
    return null;
  }
}

function saveStateToDisk() {
  try {
    const payload = {
      contestants: contestants.map(c => ({ ...c, score: clampScore(c.score) })),
      judges: judges.map(j => ({ ...j })),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.warn('[STATE] Failed to save state.json:', e.message);
  }
}

// ── Live state (source of truth: state.json via Admin Content tab) ──────────
const disk = loadStateFromDisk();
let contestants = deepClone(disk?.contestants || fallbackContestants).map(c => ({
  id: Number(c.id),
  name: String(c.name || '').trim() || `Contestant ${c.id}`,
  image: String(c.image || '').trim() || `contestant_${c.id}.png`,
  score: clampScore(c.score),
}));

let judges = deepClone(disk?.judges || fallbackJudges).map(j => ({
  id: Number(j.id),
  name: String(j.name || '').trim() || `Judge ${j.id}`,
  image: String(j.image || '').trim() || `judge_${j.id}.png`,
}));

// Track which judge has already voted for which contestant this round
// Structure: { judgeId: Set<contestantId> }
const judgeVotes = {};
function ensureVoteMaps() {
  // ensure all judges have sets
  judges.forEach(j => {
    if (!judgeVotes[j.id]) judgeVotes[j.id] = new Set();
  });
  // remove votes for deleted judges
  Object.keys(judgeVotes).forEach(jid => {
    if (!judges.some(j => String(j.id) === String(jid))) delete judgeVotes[jid];
  });
  // prune contestant ids that no longer exist
  const validContestantIds = new Set(contestants.map(c => c.id));
  Object.values(judgeVotes).forEach(set => {
    [...set].forEach(cid => { if (!validContestantIds.has(cid)) set.delete(cid); });
  });
}
ensureVoteMaps();
saveStateToDisk();

// ── Multer: image upload storage ────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.type === 'judge' ? 'judges' : 'contestants';
    const dest = path.join(baseDir, 'public', 'images', folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Save as e.g. contestant_3.png, preserving the extension of the uploaded file
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const base = req.body.filename; // e.g. "contestant_3" or "judge_1"
    cb(null, base + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
// Also serve external uploads if they exist (next to the .exe)
if (isPkg) {
  // Map /images to baseDir/public/images
  app.use(express.static(path.join(baseDir, 'public')));
}

// ── API: get full state ─────────────────────────────────────────────────────
app.get('/api/state', (req, res) => {
  res.json({
    contestants: getSortedContestants(),
    judges,
    judgeVotes: serializeVotes(),
  });
});

// ── Serve named pages ────────────────────────────────────────────────────────
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/judge/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'judge.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Image upload API ─────────────────────────────────────────────────────────
app.post('/api/upload-image', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const isJudge = req.body.type === 'judge';
  const folder = isJudge ? 'judges' : 'contestants';
  const ext = path.extname(req.file.filename).toLowerCase();
  const base = req.body.filename;
  // If the data.js uses .png but user uploaded .jpg, update the served path
  const webPath = `/images/${folder}/${base}${ext}`;
  res.json({ ok: true, path: webPath, filename: `${base}${ext}` });
});

// ── API: get image list (what's already uploaded) ────────────────────────────
app.get('/api/images', (req, res) => {
  const result = { contestants: {}, judges: {} };
  ['contestants', 'judges'].forEach(folder => {
    const dir = path.join(__dirname, 'public', 'images', folder);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => {
        const base = path.basename(f, path.extname(f));
        result[folder][base] = `/images/${folder}/${f}?t=${Date.now()}`;
      });
    }
  });
  res.json(result);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSortedContestants() {
  return [...contestants].sort((a, b) => b.score - a.score);
}

function serializeVotes() {
  const out = {};
  Object.entries(judgeVotes).forEach(([jid, set]) => {
    out[jid] = [...set];
  });
  return out;
}

function broadcastState(triggerEvent = null) {
  ensureVoteMaps();
  const payload = {
    contestants: getSortedContestants(),
    judges,
    judgeVotes: serializeVotes(),
    trigger: triggerEvent, // { contestantId, judgeId, delta }
  };
  io.emit('state_update', payload);
}

function nextId(items) {
  return (items.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) || 0) + 1;
}

// ── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);

  // Send full state on connect
  socket.emit('state_update', {
    contestants: getSortedContestants(),
    judges,
    judgeVotes: serializeVotes(),
    trigger: null,
  });

  // Judge or admin adds +7
  socket.on('add_score', ({ contestantId, judgeId, force }) => {
    const judge = judges.find(j => j.id === judgeId);
    const contestant = contestants.find(c => c.id === contestantId);

    if (!judge || !contestant) return;

    // Check if judge already voted (skip check if forced by admin)
    if (!force && judgeVotes[judgeId] && judgeVotes[judgeId].has(contestantId)) {
      socket.emit('vote_rejected', { reason: 'already_voted', contestantId, judgeId });
      return;
    }

    // Apply score
    const before = clampScore(contestant.score);
    const after = clampScore(before + 7);
    const delta = after - before;
    contestant.score = after;
    if (judgeVotes[judgeId]) judgeVotes[judgeId].add(contestantId);

    saveStateToDisk();
    console.log(`[SCORE] ${judge.name} → ${contestant.name} +${delta} (total: ${contestant.score})`);
    broadcastState({ contestantId, judgeId, delta });
  });

  // Admin: set score directly
  socket.on('set_score', ({ contestantId, score }) => {
    const contestant = contestants.find(c => c.id === contestantId);
    if (!contestant) return;
    contestant.score = clampScore(score);
    saveStateToDisk();
    broadcastState(null);
  });

  // Admin: create/update contestant
  socket.on('upsert_contestant', (payload) => {
    const id = payload?.id ? Number(payload.id) : null;
    const name = String(payload?.name || '').trim();
    const image = String(payload?.image || '').trim();
    const score = clampScore(payload?.score);

    if (!name) return;

    if (id && contestants.some(c => c.id === id)) {
      contestants = contestants.map(c => c.id === id ? { ...c, name, image: image || c.image, score } : c);
    } else {
      const newId = nextId(contestants);
      contestants.push({
        id: newId,
        name,
        image: image || `contestant_${newId}.png`,
        score,
      });
    }
    ensureVoteMaps();
    saveStateToDisk();
    broadcastState(null);
  });

  socket.on('delete_contestant', ({ id }) => {
    const cid = Number(id);
    if (!cid) return;
    contestants = contestants.filter(c => c.id !== cid);
    ensureVoteMaps();
    saveStateToDisk();
    broadcastState(null);
  });

  // Admin: create/update judge
  socket.on('upsert_judge', (payload) => {
    const id = payload?.id ? Number(payload.id) : null;
    const name = String(payload?.name || '').trim();
    const image = String(payload?.image || '').trim();
    if (!name) return;

    if (id && judges.some(j => j.id === id)) {
      judges = judges.map(j => j.id === id ? { ...j, name, image: image || j.image } : j);
    } else {
      const newId = nextId(judges);
      judges.push({
        id: newId,
        name,
        image: image || `judge_${newId}.png`,
      });
    }
    ensureVoteMaps();
    saveStateToDisk();
    broadcastState(null);
  });

  socket.on('delete_judge', ({ id }) => {
    const jid = Number(id);
    if (!jid) return;
    judges = judges.filter(j => j.id !== jid);
    ensureVoteMaps();
    saveStateToDisk();
    broadcastState(null);
  });

  // Admin: reset all votes for a new round
  socket.on('reset_votes', () => {
    judges.forEach(j => { judgeVotes[j.id] = new Set(); });
    console.log('[RESET] All judge votes cleared for new round');
    broadcastState(null);
  });

  // Admin: reset all scores to 0
  socket.on('reset_scores', () => {
    contestants.forEach(c => { c.score = 0; });
    judges.forEach(j => { judgeVotes[j.id] = new Set(); });
    console.log('[RESET] All scores and votes cleared');
    saveStateToDisk();
    broadcastState(null);
  });

  // Admin: remove all contestants (content reset)
  socket.on('clear_contestants', () => {
    contestants = [];
    judges.forEach(j => { judgeVotes[j.id] = new Set(); });
    console.log('[CONTENT] All contestants removed');
    saveStateToDisk();
    broadcastState(null);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Client disconnected: ${socket.id}`);
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   HIRUSTAR SCOREBOARD — Server Running       ║');
  console.log(`║   Local:   http://localhost:${PORT}             ║`);
  console.log(`║   Network: http://<YOUR_IP>:${PORT}             ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   Display:  http://localhost:${PORT}/display     ║`);
  console.log(`║   Judge 1:  http://localhost:${PORT}/judge/1     ║`);
  console.log(`║   Judge 2:  http://localhost:${PORT}/judge/2     ║`);
  console.log(`║   Judge 3:  http://localhost:${PORT}/judge/3     ║`);
  console.log(`║   Admin:    http://localhost:${PORT}/admin        ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
