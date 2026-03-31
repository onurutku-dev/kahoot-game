/* ================================================================
   Discovering & Sharing Cultures — Multiplayer via Ably
   
   KURULUM:
   1. https://ably.com → Ücretsiz hesap aç
   2. "Create App" butonuna bas
   3. API Key'i kopyala → aşağıya yapıştır
   ================================================================ */

// ══════════════════════════════════════════════════════════════
//  ABLY API KEY — https://ably.com adresinden ücretsiz al
const ABLY_KEY = 'RiMEkA.eQl5oQ:-g_k-RlE8hkCNNjTJZmE3OO61RZLvex4vONEXxbLIUo';
// ══════════════════════════════════════════════════════════════

const CHANNEL_NAME = 'etwinning-quiz-2024';
const QUESTION_TIME = 20;
const TOTAL_ROUNDS = 4;
const QPR = 10;
const MIN_PLAYERS = 4;
const COLORS = [
  '#d4af37', '#4a9eff', '#a78bfa', '#34d399',
  '#fb923c', '#f472b6', '#38bdf8', '#e879f9',
  '#a3e635', '#f87171'
];

// ── Helpers ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const FLAG = c => `https://flagcdn.com/w80/${c}.png`;
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function getMyId() {
  let id = localStorage.getItem('dsc_uid4');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('dsc_uid4', id);
  }
  return id;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function showErr(msg) {
  const e = $('error-msg');
  if (!e) return;
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(() => e.style.display = 'none', 4000);
}

// ── State ──────────────────────────────────────────────────────
const G = {
  myId: getMyId(),
  myName: '',
  myColor: '',
  myJoinedAt: 0,
  players: {},
  gameState: { status: 'lobby' },
  answers: {},
  isHost: false,
  hasAnswered: false,
  questionOrder: [],
  timerInterval: null,
  _prevStatus: null,
  _prevQId: null,
  _revealDone: false
};

let ably, channel;

// ── Mute toggle (called from HTML button) ─────────────────────
function toggleMute() {
  const muted = SFX.toggleMute();
  const btn   = document.getElementById('btn-mute');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('btn-join').addEventListener('click', doJoin);
  $('player-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
  $('btn-toggle-ready').addEventListener('click', toggleReady);
  $('btn-start-game').addEventListener('click', hostStartGame);
  $('btn-next-question').addEventListener('click', hostNext);
  $('btn-next-round').addEventListener('click', hostNextRound);
  $('btn-play-again').addEventListener('click', hostPlayAgain);
  document.querySelectorAll('.option-btn').forEach(btn =>
    btn.addEventListener('click', () => onAnswer(parseInt(btn.dataset.index)))
  );
});

// ── Join ───────────────────────────────────────────────────────
async function doJoin() {
  const name = $('player-name-input').value.trim();
  if (!name) { showErr('Please enter your name!'); return; }

  if (ABLY_KEY === 'YOUR_ABLY_KEY_HERE') {
    showErr('⚠️ Add your Ably API key in app.js first!');
    return;
  }

  const joinBtn = $('btn-join');
  joinBtn.disabled = true;
  joinBtn.textContent = 'Connecting…';

  G.myName = name;
  G.myJoinedAt = Date.now();

  try {
    ably = new Ably.Realtime({ key: ABLY_KEY, clientId: G.myId });
    channel = ably.channels.get(CHANNEL_NAME);

    await new Promise((resolve, reject) => {
      ably.connection.once('connected', resolve);
      ably.connection.once('failed', () => reject(new Error('Connection failed')));
      setTimeout(() => reject(new Error('Timeout after 8s')), 8000);
    });

    // Subscribe to events
    await channel.subscribe('game', msg => onGameEvent(msg.data));
    await channel.subscribe('answer', msg => onAnswerEvent(msg.data));

    // Presence: track players
    channel.presence.subscribe(() => refreshPlayers());

    // Assign color based on how many players are already in
    const existingMembers = await new Promise(res =>
      channel.presence.get((err, m) => res(m || []))
    );
    const joinOrder = existingMembers.length;
    G.myColor = COLORS[joinOrder % COLORS.length];

    // Enter presence
    await channel.presence.enter({
      name: G.myName,
      color: G.myColor,
      ready: false,
      score: 0,
      roundScore: 0,
      streak: 0,
      joinedAt: G.myJoinedAt
    });

    // Catch up: read recent game history for late joiners
    channel.history({ limit: 20 }, (err, page) => {
      if (!page) return;
      const gameEvents = page.items.filter(m => m.name === 'game');
      if (gameEvents.length > 0) {
        // Most recent is first
        onGameEvent(gameEvents[0].data);
      }
    });

    showScreen('screen-lobby');
    refreshPlayers();
    SFX.playerJoined();

  } catch (err) {
    showErr('Connection failed. Check your Ably API key.');
    console.error(err);
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Game →';
  }
}

// ── Presence / Players ─────────────────────────────────────────
function refreshPlayers() {
  channel.presence.get((err, members) => {
    if (!members) return;

    G.players = {};
    let hostId = null;
    let minTime = Infinity;

    members.forEach(m => {
      if (!m.data || !m.data.name) return;
      G.players[m.clientId] = { ...m.data, id: m.clientId };
      const t = m.data.joinedAt || 0;
      if (t < minTime || (t === minTime && (!hostId || m.clientId < hostId))) {
        minTime = t;
        hostId = m.clientId;
      }
    });

    G.isHost = hostId === G.myId;
    renderSidebar();

    if ($('screen-lobby').classList.contains('active')) updateLobby();
    if (G.gameState.status === 'question') checkAllAnswered();
  });
}

// ── Lobby ──────────────────────────────────────────────────────
function updateLobby() {
  const players = Object.values(G.players).filter(p => p && p.name);
  const total = players.length;
  const ready = players.filter(p => p.ready).length;
  const allReady = total >= MIN_PLAYERS && players.every(p => p.ready);

  $('lobby-players').innerHTML = players
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map(p => `
      <div class="lobby-player-card ${p.ready ? 'is-ready' : ''}">
        <div class="lp-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
        <div class="lp-name">${esc(p.name)}</div>
        <div class="lp-status ${p.ready ? 'ready' : ''}">${p.ready ? '✓ Ready' : 'Not ready'}</div>
      </div>`).join('');

  $('lobby-status').textContent = total < MIN_PLAYERS
    ? `Waiting for players… (${total} / ${MIN_PLAYERS} minimum)`
    : allReady ? '🎉 Everyone is ready!'
      : `${ready} / ${total} players ready`;

  const me = G.players[G.myId];
  const iReady = me && me.ready;
  const rb = $('btn-toggle-ready');
  rb.textContent = iReady ? '✕ Cancel' : "✓ I'm Ready!";
  rb.className = 'btn ' + (iReady ? 'btn-ghost' : 'btn-gold');

  const sb = $('btn-start-game');
  sb.style.display = 'block';
  sb.disabled = !allReady;
}

async function toggleReady() {
  const me = G.players[G.myId];
  if (!me) return;
  SFX.readyUp();
  await channel.presence.update({ ...me, ready: !me.ready });
}

// ── Start Game ─────────────────────────────────────────────────
function hostStartGame() {
  const players = Object.values(G.players).filter(p => p && p.name);
  const allReady = players.length >= MIN_PLAYERS && players.every(p => p.ready);
  if (!allReady) return;

  const order = shuffle(ALL_QUESTIONS.map(q => q.id));

  channel.publish('game', {
    status: 'question',
    questionOrder: order,
    questionId: order[0],
    currentRound: 0,
    currentQuestion: 0,
    questionStartTime: Date.now(),
    resetScores: true
  });
}

// ── Game Events ────────────────────────────────────────────────
function onGameEvent(data) {
  if (!data) return;
  Object.assign(G.gameState, data);
  if (Array.isArray(data.questionOrder)) G.questionOrder = data.questionOrder;

  // Each player resets their own scores when a new game starts
  if (data.resetScores) {
    G.answers = {};
    const me = G.players[G.myId] || {};
    channel.presence.update({
      name: G.myName, color: G.myColor,
      ready: false, score: 0, roundScore: 0, streak: 0, joinedAt: G.myJoinedAt
    });
  }

  if (data.resetRound) {
    const me = G.players[G.myId] || {};
    channel.presence.update({ ...me, roundScore: 0 });
  }

  const { status, questionId } = data;

  if (status === 'question' && (G._prevStatus !== 'question' || G._prevQId !== questionId)) {
    G._prevStatus = 'question';
    G._prevQId = questionId;
    G.hasAnswered = false;
    G.answers = {};
    G._revealDone = false;
    const q = ALL_QUESTIONS.find(q => q.id === questionId);
    renderQuestion(q);
    SFX.questionStart();

  } else if (status === 'reveal' && G._prevStatus !== 'reveal') {
    G._prevStatus = 'reveal';
    renderReveal(data.answers || {});

  } else if (status === 'roundEnd' && G._prevStatus !== 'roundEnd') {
    G._prevStatus = 'roundEnd';
    renderRoundEnd();

  } else if (status === 'gameEnd' && G._prevStatus !== 'gameEnd') {
    G._prevStatus = 'gameEnd';
    renderGameEnd();

  } else if (status === 'lobby' && G._prevStatus !== 'lobby') {
    G._prevStatus = 'lobby';
    G.answers = {};
    G._prevQId = null;
    showScreen('screen-lobby');
    updateLobby();
  }
}

// ── Answer Events ──────────────────────────────────────────────
function onAnswerEvent(data) {
  if (!data || data.questionId !== G.gameState.questionId) return;
  G.answers[data.playerId] = data;
  updateAnswerCount();
  checkAllAnswered();
}

function checkAllAnswered() {
  if (!G.isHost || G.gameState.status !== 'question' || G._revealDone) return;
  const total = Object.values(G.players).filter(p => p && p.name).length;
  const valid = Object.values(G.answers)
    .filter(a => a && a.questionId === G.gameState.questionId).length;
  if (total > 0 && valid >= total) {
    G._revealDone = true;
    clearInterval(G.timerInterval);
    setTimeout(hostAdvanceReveal, 600);
  }
}

function updateAnswerCount() {
  const el = $('answered-count');
  if (el) el.textContent = Object.keys(G.answers).length;
}

// ── Question ───────────────────────────────────────────────────
function renderQuestion(q) {
  if (!q) return;
  showScreen('screen-game');
  $('overlay-reveal').style.display = 'none';

  $('question-flag').src = FLAG(q.flag);
  $('question-country').textContent = q.country;
  $('question-text').textContent = q.question;
  $('current-round').textContent = (G.gameState.currentRound || 0) + 1;
  $('current-question').textContent = (G.gameState.currentQuestion || 0) + 1;
  $('answered-count').textContent = '0';
  $('total-count').textContent = Object.values(G.players).filter(p => p && p.name).length;
  $('answered-indicator').textContent = '';

  // Shuffle options per device (display only)
  const order = shuffle([0, 1, 2, 3]);
  G._optOrder = order;
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.querySelector('.opt-text').textContent = q.options[order[i]];
    btn.dataset.origIndex = order[i];
    btn.disabled = false;
    btn.classList.remove('correct-reveal', 'wrong-reveal', 'answered-correct', 'answered-wrong');
    btn.style.opacity = '';
    btn.style.outline = '';
  });

  const card = $('question-section');
  card.style.animation = 'none';
  void card.offsetHeight;
  card.style.animation = 'cardIn 0.4s ease';

  startTimer(G.gameState.questionStartTime);
}

// ── Answer ─────────────────────────────────────────────────────
function onAnswer(displayIdx) {
  if (G.hasAnswered) return;
  G.hasAnswered = true;
  clearInterval(G.timerInterval);

  const q = ALL_QUESTIONS.find(q => q.id === G.gameState.questionId);
  const btn = document.querySelectorAll('.option-btn')[displayIdx];
  const origIdx = parseInt(btn.dataset.origIndex);
  const correct = origIdx === q.correct;
  const elapsed = Math.max(0, (Date.now() - G.gameState.questionStartTime) / 1000);
  const left = Math.max(0, QUESTION_TIME - elapsed);
  const pts = correct ? Math.max(100, Math.round(1000 * left / QUESTION_TIME)) : 0;

  // Visual feedback
  document.querySelectorAll('.option-btn').forEach((b, i) => {
    b.disabled = true;
    if (i !== displayIdx) b.style.opacity = '0.35';
  });
  btn.classList.add(correct ? 'answered-correct' : 'answered-wrong');
  $('answered-indicator').innerHTML = correct
    ? '<span style="color:#34d399;font-weight:700">✓ Correct! Locked in.</span>'
    : '<span style="color:#f87171;font-weight:700">✗ Wrong. Locked in.</span>';
  if (correct) SFX.correct(); else SFX.wrong();

  // Publish answer to all
  channel.publish('answer', {
    playerId: G.myId,
    questionId: G.gameState.questionId,
    origIdx, isCorrect: correct, pts,
    name: G.myName,
    color: G.myColor
  });

  // Update own score via presence
  const me = G.players[G.myId] || {};
  const streak = correct ? (me.streak || 0) + 1 : 0;
  const bonus = streak >= 5 ? 300 : streak >= 3 ? 150 : 0;
  const earned = pts + bonus;
  channel.presence.update({
    name: G.myName, color: G.myColor, ready: true,
    joinedAt: G.myJoinedAt,
    score: (me.score || 0) + earned,
    roundScore: (me.roundScore || 0) + earned,
    streak
  });
}

function onTimeout() {
  if (G.hasAnswered) return;
  G.hasAnswered = true;
  document.querySelectorAll('.option-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.35'; });
  $('answered-indicator').innerHTML = '<span style="color:#f87171;font-weight:700">⏰ Time\'s up!</span>';
  SFX.timeout();
  channel.publish('answer', {
    playerId: G.myId,
    questionId: G.gameState.questionId,
    origIdx: -1, isCorrect: false, pts: 0,
    name: G.myName,
    color: G.myColor
  });
}

// ── Host: Advance to Reveal ────────────────────────────────────
function hostAdvanceReveal() {
  if (!G.isHost || G.gameState.status === 'reveal') return;
  SFX.reveal();
  channel.publish('game', {
    status: 'reveal',
    questionId: G.gameState.questionId,
    answers: G.answers
  });
}

// ── Reveal ─────────────────────────────────────────────────────
function renderReveal(answers) {
  clearInterval(G.timerInterval);
  const q = ALL_QUESTIONS.find(q => q.id === G.gameState.questionId);
  if (!q) return;

  $('correct-answer-text').textContent = q.options[q.correct];

  $('player-results').innerHTML = Object.values(answers)
    .sort((a, b) => (b.pts || 0) - (a.pts || 0))
    .map(a => `
      <div class="pr-row ${a.isCorrect ? 'pr-correct' : 'pr-wrong'}">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="width:26px;height:26px;border-radius:50%;background:${a.color};display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;color:#0d1117">${(a.name || '?')[0].toUpperCase()}</span>
          <strong>${esc(a.name || '?')}</strong>
        </span>
        <span class="pr-pts">${a.isCorrect ? '+' + a.pts : '–'}</span>
      </div>`).join('');

  $('btn-next-question').style.display = G.isHost ? 'block' : 'none';
  $('reveal-waiting').style.display = G.isHost ? 'none' : 'block';
  $('overlay-reveal').style.display = 'flex';
}

// ── Host: Next Question / Round ────────────────────────────────
function hostNext() {
  if (!G.isHost) return;
  $('overlay-reveal').style.display = 'none';

  const nextQ = (G.gameState.currentQuestion || 0) + 1;
  const round = G.gameState.currentRound || 0;

  if (nextQ >= QPR) {
    channel.publish('game', { status: 'roundEnd', currentRound: round });
    return;
  }

  const qId = G.questionOrder[round * QPR + nextQ];
  channel.publish('game', {
    status: 'question', questionId: qId,
    currentQuestion: nextQ, questionStartTime: Date.now()
  });
}

function hostNextRound() {
  if (!G.isHost) return;
  const nextRound = (G.gameState.currentRound || 0) + 1;

  if (nextRound >= TOTAL_ROUNDS) {
    channel.publish('game', { status: 'gameEnd' });
    return;
  }

  const qId = G.questionOrder[nextRound * QPR];
  channel.publish('game', {
    status: 'question', currentRound: nextRound,
    currentQuestion: 0, questionId: qId,
    questionStartTime: Date.now(), resetRound: true
  });
}

function hostPlayAgain() {
  if (!G.isHost) return;
  channel.publish('game', { status: 'lobby', resetScores: true });
}

// ── Round End ──────────────────────────────────────────────────
function renderRoundEnd() {
  $('overlay-reveal').style.display = 'none';
  clearInterval(G.timerInterval);

  const round = (G.gameState.currentRound || 0) + 1;
  $('round-end-title').textContent = `Round ${round} Complete`;
  $('round-end-sub').textContent = round < TOTAL_ROUNDS
    ? `${TOTAL_ROUNDS - round} round${TOTAL_ROUNDS - round > 1 ? 's' : ''} remaining`
    : 'Final round!';

  const sorted = Object.values(G.players).filter(p => p && p.name)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  $('round-leaderboard').innerHTML = sorted.map((p, i) => `
    <div class="lb-row">
      <span class="lb-rank-num">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-total">${(p.score || 0).toLocaleString()} <span class="lb-round-pts">(+${(p.roundScore || 0).toLocaleString()})</span></span>
    </div>`).join('');

  $('btn-next-round').textContent = round >= TOTAL_ROUNDS ? 'See Final Results →' : 'Next Round →';
  $('btn-next-round').style.display = G.isHost ? 'block' : 'none';
  $('waiting-host-msg').style.display = G.isHost ? 'none' : 'block';
  SFX.roundEnd();
  showScreen('screen-round-end');
}

// ── Game End ───────────────────────────────────────────────────
function renderGameEnd() {
  $('overlay-reveal').style.display = 'none';
  clearInterval(G.timerInterval);

  const sorted = Object.values(G.players).filter(p => p && p.name)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  buildPodium(sorted);

  $('final-leaderboard').innerHTML = sorted.map((p, i) => `
    <div class="lb-row">
      <span class="lb-rank-num">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-total">${(p.score || 0).toLocaleString()}</span>
    </div>`).join('');

  $('btn-play-again').style.display = G.isHost ? 'block' : 'none';
  $('waiting-again-msg').style.display = G.isHost ? 'none' : 'block';
  showScreen('screen-game-end');
  SFX.gameEnd();
  launchConfetti();
}

function buildPodium(sorted) {
  const n = sorted.length;
  if (!n) { $('podium').innerHTML = ''; return; }
  const slots = n >= 3
    ? [{ p: sorted[1], cls: 'podium-2', lbl: '2' },
    { p: sorted[0], cls: 'podium-1', lbl: '1' },
    { p: sorted[2], cls: 'podium-3', lbl: '3' }]
    : n === 2
      ? [{ p: sorted[1], cls: 'podium-2', lbl: '2' },
      { p: sorted[0], cls: 'podium-1', lbl: '1' }]
      : [{ p: sorted[0], cls: 'podium-1', lbl: '1' }];

  $('podium').innerHTML = slots.map(s => `
    <div class="podium-place">
      <div class="podium-avatar" style="background:${s.p.color}">${s.p.name[0].toUpperCase()}</div>
      <div class="podium-pname">${esc(s.p.name)}</div>
      <div class="podium-pts">${(s.p.score || 0).toLocaleString()} pts</div>
      <div class="podium-block ${s.cls}">${s.lbl}</div>
    </div>`).join('');
}

// ── Sidebar ────────────────────────────────────────────────────
function renderSidebar() {
  const sorted = Object.values(G.players).filter(p => p && p.name)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  $('player-list').innerHTML = sorted.map((p, i) => `
    <div class="player-card ${p.id === G.myId ? 'active-player' : ''}">
      <div class="player-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <div class="player-info">
        <div class="player-name">
          ${esc(p.name)}
          ${p.id === G.myId ? '<span style="color:var(--gold);font-size:.65rem"> (you)</span>' : ''}
        </div>
        <div class="player-score">${(p.score || 0).toLocaleString()} pts</div>
      </div>
      <div class="player-rank">#${i + 1}</div>
    </div>`).join('');
}

// ── Timer ──────────────────────────────────────────────────────
function startTimer(serverStart) {
  clearInterval(G.timerInterval);
  $('timer-bar').style.width = '100%';
  $('timer-bar').className = 'timer-bar';

  G.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - serverStart) / 1000;
    const left = Math.max(0, QUESTION_TIME - elapsed);
    const pct = (left / QUESTION_TIME) * 100;
    const secsLeft = Math.ceil(left);

    $('timer-bar').style.width = pct + '%';
    $('timer-bar').className = 'timer-bar' + (pct < 25 ? ' danger' : pct < 50 ? ' warn' : '');
    $('timer-text').textContent = secsLeft;

    // Timer tick — last 5 seconds, on each whole second
    if (secsLeft <= 5 && !G.hasAnswered) {
      const key = `tick_${secsLeft}`;
      if (!G._lastTick || G._lastTick !== secsLeft) {
        G._lastTick = secsLeft;
        SFX.timerTick(secsLeft);
      }
    }

    if (left <= 0) {
      clearInterval(G.timerInterval);
      if (!G.hasAnswered) onTimeout();
      if (G.isHost && !G._revealDone) {
        G._revealDone = true;
        setTimeout(hostAdvanceReveal, 1000);
      }
    }
  }, 100);
}

// ── Confetti ───────────────────────────────────────────────────
function launchConfetti() {
  const cvs = $('confetti-canvas');
  const ctx = cvs.getContext('2d');
  cvs.width = window.innerWidth;
  cvs.height = window.innerHeight;

  const palette = ['#d4af37', '#4a9eff', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * cvs.width,
    y: Math.random() * cvs.height - cvs.height,
    w: Math.random() * 10 + 4,
    h: Math.random() * 6 + 3,
    color: palette[Math.floor(Math.random() * palette.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 1.5,
    rot: Math.random() * 360,
    rv: (Math.random() - 0.5) * 7,
    alpha: 1
  }));

  let frame = 0;
  (function draw() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    frame++;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rv;
      if (frame > 230) p.alpha = Math.max(0, p.alpha - 0.022);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (frame < 290) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cvs.width, cvs.height);
  })();
}
