/* ================================================================
   Discovering & Sharing Cultures — Multiplayer Engine
   Single global room via GunJS (peer-to-peer, zero setup)
   ================================================================ */

const ROOM          = 'dsc-etwinning-2024-v3';
const QUESTION_TIME = 20;
const TOTAL_ROUNDS  = 4;
const QPR           = 10;   // questions per round
const MIN_PLAYERS   = 4;
const COLORS        = ['#d4af37','#4a9eff','#a78bfa','#34d399','#fb923c','#f472b6','#38bdf8','#e879f9','#a3e635','#f87171'];

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
  let id = localStorage.getItem('dsc_uid2');
  if (!id) { id = Math.random().toString(36).slice(2,10) + Date.now().toString(36); localStorage.setItem('dsc_uid2', id); }
  return id;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function showErr(msg) {
  const e = $('error-msg');
  if (e) { e.textContent = msg; e.style.display = 'block'; setTimeout(() => e.style.display = 'none', 3000); }
}

// ── State ──────────────────────────────────────────────────────
const G = {
  myId:          getMyId(),
  players:       {},   // { [id]: {name,color,score,roundScore,streak,ready,joinOrder} }
  gameState:     { status: 'lobby' },
  answers:       {},   // { [id]: {origIdx,isCorrect,pts,name,color} }
  isHost:        false,
  hasAnswered:   false,
  questionOrder: [],
  timerInterval: null,
  _prevStatus:   null,
  _prevQId:      null,
  _revealPending: false
};

// ── GunJS Nodes ────────────────────────────────────────────────
let gun, stateNode, playersNode, answersNode;

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  gun         = Gun(['https://peer.gun.eco/gun', 'https://gun-relay.glitch.me/gun']);
  stateNode   = gun.get(ROOM).get('state');
  playersNode = gun.get(ROOM).get('players');
  answersNode = gun.get(ROOM).get('answers');

  // ── Listeners ──────────────────────────────────────────────
  stateNode.on(onStateUpdate);

  playersNode.map().on((data, key) => {
    if (!data || !data.name) return;
    G.players[key] = { ...G.players[key], ...data, id: key };
    renderSidebar();
    if ($('screen-lobby').classList.contains('active')) updateLobby();
    maybeAutoReveal();
  });

  answersNode.map().on((data, key) => {
    if (!data || data.name === undefined) return;
    G.answers[key] = data;
    updateAnswerCount();
    maybeAutoReveal();
  });

  // ── UI Events ──────────────────────────────────────────────
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
function doJoin() {
  const name = $('player-name-input').value.trim();
  if (!name) { showErr('Please enter your name!'); return; }

  // Check if game already running
  if (G.gameState.status && G.gameState.status !== 'lobby') {
    showErr('A game is in progress. Wait for it to finish.'); return;
  }

  const joinOrder = Object.keys(G.players).length;
  const color     = COLORS[joinOrder % COLORS.length];

  playersNode.get(G.myId).put({ name, color, score: 0, roundScore: 0, streak: 0, ready: false, joinOrder, ts: Date.now() });

  // First person becomes host
  stateNode.get('hostId').once(hid => {
    if (!hid) {
      stateNode.get('hostId').put(G.myId);
      G.isHost = true;
    } else {
      G.isHost = hid === G.myId;
    }
  });

  showScreen('screen-lobby');
}

// ── Lobby ──────────────────────────────────────────────────────
function updateLobby() {
  const players  = Object.values(G.players).filter(p => p && p.name);
  const total    = players.length;
  const ready    = players.filter(p => p.ready).length;
  const allReady = total >= MIN_PLAYERS && players.every(p => p.ready);

  // Player cards
  $('lobby-players').innerHTML = players
    .sort((a, b) => (a.joinOrder || 0) - (b.joinOrder || 0))
    .map(p => `
      <div class="lobby-player-card ${p.ready ? 'is-ready' : ''}">
        <div class="lp-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
        <div class="lp-name">${esc(p.name)}</div>
        <div class="lp-status ${p.ready ? 'ready' : ''}">${p.ready ? '✓ Ready' : 'Not ready'}</div>
      </div>`).join('');

  // Status text
  $('lobby-status').textContent = total < MIN_PLAYERS
    ? `Waiting for players… (${total}/${MIN_PLAYERS} minimum)`
    : allReady ? '🎉 Everyone is ready!'
    : `${ready} / ${total} players ready`;

  // My ready button
  const me      = G.players[G.myId];
  const iReady  = me && me.ready;
  const btn     = $('btn-toggle-ready');
  btn.textContent  = iReady ? '✕ Cancel Ready' : "✓ I'm Ready!";
  btn.className    = 'btn ' + (iReady ? 'btn-ghost' : 'btn-gold');

  // Start button (everyone sees it, enabled only when all ready)
  const startBtn        = $('btn-start-game');
  startBtn.disabled     = !allReady;
  startBtn.style.display = 'block';
  startBtn.title        = !allReady ? 'All players must be ready (min 4)' : '';
}

function toggleReady() {
  const me = G.players[G.myId];
  if (!me) return;
  playersNode.get(G.myId).get('ready').put(!me.ready);
}

// ── Start Game ─────────────────────────────────────────────────
function hostStartGame() {
  const players  = Object.values(G.players).filter(p => p && p.name);
  const allReady = players.length >= MIN_PLAYERS && players.every(p => p.ready);
  if (!allReady) return;

  const order = shuffle(ALL_QUESTIONS.map(q => q.id));

  // Reset all scores
  players.forEach(p => {
    playersNode.get(p.id).put({ score: 0, roundScore: 0, streak: 0 });
  });
  clearAnswers();

  stateNode.put({
    status:            'question',
    questionOrder:     order.join(','),
    questionId:        order[0],
    currentRound:      0,
    currentQuestion:   0,
    questionStartTime: Date.now()
  });
}

function clearAnswers() {
  // GunJS null-put to clear answers
  Object.keys(G.answers).forEach(k => answersNode.get(k).put(null));
  G.answers = {};
}

// ── State Updates ──────────────────────────────────────────────
function onStateUpdate(data) {
  if (!data) return;
  Object.assign(G.gameState, data);
  G.isHost = G.myId === G.gameState.hostId;

  if (data.questionOrder) {
    G.questionOrder = data.questionOrder.split(',').map(Number);
  }

  const status = G.gameState.status;
  const qId    = G.gameState.questionId;

  if (status === 'lobby') {
    if ($('screen-lobby').classList.contains('active')) updateLobby();
  } else if (status === 'question' && (G._prevStatus !== 'question' || G._prevQId !== qId)) {
    G._prevStatus     = 'question';
    G._prevQId        = qId;
    G.hasAnswered     = false;
    G.answers         = {};
    G._revealPending  = false;
    renderQuestion(ALL_QUESTIONS.find(q => q.id === qId));
  } else if (status === 'reveal' && G._prevStatus !== 'reveal') {
    G._prevStatus = 'reveal';
    renderReveal();
  } else if (status === 'roundEnd' && G._prevStatus !== 'roundEnd') {
    G._prevStatus = 'roundEnd';
    renderRoundEnd();
  } else if (status === 'gameEnd' && G._prevStatus !== 'gameEnd') {
    G._prevStatus = 'gameEnd';
    renderGameEnd();
  }
}

// ── Question ───────────────────────────────────────────────────
function renderQuestion(q) {
  if (!q) return;
  showScreen('screen-game');
  $('overlay-reveal').style.display = 'none';

  $('question-flag').src         = FLAG(q.flag);
  $('question-country').textContent = q.country;
  $('question-text').textContent = q.question;
  $('current-round').textContent    = (G.gameState.currentRound || 0) + 1;
  $('current-question').textContent = (G.gameState.currentQuestion || 0) + 1;
  $('answered-count').textContent   = '0';
  $('total-count').textContent      = Object.values(G.players).filter(p => p && p.name).length;
  $('answered-indicator').textContent = '';

  // Shuffle options per device (only affects display order)
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

  const q       = ALL_QUESTIONS.find(q => q.id === G.gameState.questionId);
  const btn     = document.querySelectorAll('.option-btn')[displayIdx];
  const origIdx = parseInt(btn.dataset.origIndex);
  const correct = origIdx === q.correct;
  const elapsed = Math.max(0, (Date.now() - G.gameState.questionStartTime) / 1000);
  const left    = Math.max(0, QUESTION_TIME - elapsed);
  const pts     = correct ? Math.max(100, Math.round(1000 * left / QUESTION_TIME)) : 0;

  // Visual on this device
  document.querySelectorAll('.option-btn').forEach((b, i) => {
    b.disabled = true;
    if (i !== displayIdx) b.style.opacity = '0.35';
  });
  btn.classList.add(correct ? 'answered-correct' : 'answered-wrong');
  $('answered-indicator').innerHTML = correct
    ? '<span style="color:#34d399;font-weight:700">✓ Correct! Locked in.</span>'
    : '<span style="color:#f87171;font-weight:700">✗ Wrong. Locked in.</span>';

  // Push to GunJS
  const me = G.players[G.myId];
  answersNode.get(G.myId).put({
    origIdx, isCorrect: correct, pts,
    name:      me?.name  || '?',
    color:     me?.color || COLORS[0],
    questionId: G.gameState.questionId
  });
}

function onTimeout() {
  if (G.hasAnswered) return;
  G.hasAnswered = true;
  document.querySelectorAll('.option-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.35'; });
  $('answered-indicator').innerHTML = '<span style="color:#f87171;font-weight:700">⏰ Time\'s up!</span>';
  const me = G.players[G.myId];
  answersNode.get(G.myId).put({
    origIdx: -1, isCorrect: false, pts: 0,
    name:      me?.name  || '?',
    color:     me?.color || COLORS[0],
    questionId: G.gameState.questionId
  });
}

// ── Auto-advance when all answered (host only) ─────────────────
function maybeAutoReveal() {
  if (!G.isHost || G.gameState.status !== 'question' || G._revealPending) return;
  const total   = Object.values(G.players).filter(p => p && p.name).length;
  const current = G.gameState.questionId;
  const valid   = Object.values(G.answers).filter(a => a && a.questionId === current).length;
  if (total > 0 && valid >= total) {
    G._revealPending = true;
    clearInterval(G.timerInterval);
    setTimeout(doReveal, 600);
  }
}

function updateAnswerCount() {
  const el = $('answered-count');
  if (el) el.textContent = Object.keys(G.answers).length;
}

// ── Reveal (host pushes) ───────────────────────────────────────
function doReveal() {
  if (G.gameState.status === 'reveal') return;
  // Commit scores
  Object.values(G.players).filter(p => p && p.name).forEach(p => {
    const ans      = G.answers[p.id] || { isCorrect: false, pts: 0 };
    const streak   = ans.isCorrect ? (p.streak || 0) + 1 : 0;
    const bonus    = streak >= 5 ? 300 : streak >= 3 ? 150 : 0;
    const earned   = (ans.pts || 0) + bonus;
    playersNode.get(p.id).put({
      score:      (p.score      || 0) + earned,
      roundScore: (p.roundScore || 0) + earned,
      streak
    });
  });
  stateNode.get('status').put('reveal');
}

function renderReveal() {
  clearInterval(G.timerInterval);
  const q = ALL_QUESTIONS.find(q => q.id === G.gameState.questionId);
  if (!q) return;

  $('correct-answer-text').textContent = q.options[q.correct];

  const rows = Object.values(G.answers)
    .sort((a, b) => (b.pts || 0) - (a.pts || 0))
    .map(a => `
      <div class="pr-row ${a.isCorrect ? 'pr-correct' : 'pr-wrong'}">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="width:26px;height:26px;border-radius:50%;background:${a.color};display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;color:#0d1117">${(a.name || '?')[0].toUpperCase()}</span>
          <strong>${esc(a.name || '?')}</strong>
        </span>
        <span class="pr-pts">${a.isCorrect ? '+' + a.pts : '–'}</span>
      </div>`).join('');

  $('player-results').innerHTML = rows;
  $('btn-next-question').style.display = G.isHost ? 'block' : 'none';
  $('reveal-waiting').style.display    = G.isHost ? 'none'  : 'block';
  $('overlay-reveal').style.display = 'flex';
}

// ── Host: Next Question / Round ────────────────────────────────
function hostNext() {
  if (!G.isHost) return;
  $('overlay-reveal').style.display = 'none';

  const nextQ = (G.gameState.currentQuestion || 0) + 1;
  const round = G.gameState.currentRound || 0;

  clearAnswers();

  if (nextQ >= QPR) {
    stateNode.put({ status: 'roundEnd', currentRound: round });
    return;
  }

  const qId = G.questionOrder[round * QPR + nextQ];
  stateNode.put({ status: 'question', questionId: qId, currentQuestion: nextQ, questionStartTime: Date.now() });
}

function hostNextRound() {
  if (!G.isHost) return;
  const nextRound = (G.gameState.currentRound || 0) + 1;
  clearAnswers();

  if (nextRound >= TOTAL_ROUNDS) {
    stateNode.get('status').put('gameEnd');
    return;
  }

  // Reset round scores
  Object.values(G.players).filter(p => p && p.name).forEach(p => {
    playersNode.get(p.id).get('roundScore').put(0);
  });

  const qId = G.questionOrder[nextRound * QPR];
  stateNode.put({ status: 'question', currentRound: nextRound, currentQuestion: 0, questionId: qId, questionStartTime: Date.now() });
}

function hostPlayAgain() {
  if (!G.isHost) return;
  Object.values(G.players).filter(p => p && p.name).forEach(p => {
    playersNode.get(p.id).put({ score: 0, roundScore: 0, streak: 0, ready: false });
  });
  clearAnswers();
  G._prevStatus = null; G._prevQId = null;
  stateNode.put({ status: 'lobby' });
  showScreen('screen-lobby');
}

// ── Round End ──────────────────────────────────────────────────
function renderRoundEnd() {
  $('overlay-reveal').style.display = 'none';
  clearInterval(G.timerInterval);

  const round = (G.gameState.currentRound || 0) + 1;
  $('round-end-title').textContent = `Round ${round} Complete`;
  $('round-end-sub').textContent   = round < TOTAL_ROUNDS
    ? `${TOTAL_ROUNDS - round} round${TOTAL_ROUNDS - round > 1 ? 's' : ''} remaining`
    : 'Final round complete!';

  const sorted = Object.values(G.players).filter(p => p && p.name)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  $('round-leaderboard').innerHTML = sorted.map((p, i) => `
    <div class="lb-row">
      <span class="lb-rank-num">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-total">${(p.score||0).toLocaleString()} <span class="lb-round-pts">(+${(p.roundScore||0).toLocaleString()})</span></span>
    </div>`).join('');

  $('btn-next-round').textContent    = round >= TOTAL_ROUNDS ? 'See Final Results →' : 'Next Round →';
  $('btn-next-round').style.display  = G.isHost ? 'block' : 'none';
  $('waiting-host-msg').style.display = G.isHost ? 'none' : 'block';
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
      <span class="lb-rank-num">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-total">${(p.score||0).toLocaleString()}</span>
    </div>`).join('');

  $('btn-play-again').style.display   = G.isHost ? 'block' : 'none';
  $('waiting-again-msg').style.display = G.isHost ? 'none' : 'block';
  showScreen('screen-game-end');
  launchConfetti();
}

function buildPodium(sorted) {
  const n = sorted.length;
  if (!n) { $('podium').innerHTML = ''; return; }
  const slots = n >= 3
    ? [{p:sorted[1],cls:'podium-2',lbl:'2'},{p:sorted[0],cls:'podium-1',lbl:'1'},{p:sorted[2],cls:'podium-3',lbl:'3'}]
    : n === 2
    ? [{p:sorted[1],cls:'podium-2',lbl:'2'},{p:sorted[0],cls:'podium-1',lbl:'1'}]
    : [{p:sorted[0],cls:'podium-1',lbl:'1'}];

  $('podium').innerHTML = slots.map(s => `
    <div class="podium-place">
      <div class="podium-avatar" style="background:${s.p.color}">${s.p.name[0].toUpperCase()}</div>
      <div class="podium-pname">${esc(s.p.name)}</div>
      <div class="podium-pts">${(s.p.score||0).toLocaleString()} pts</div>
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
        <div class="player-name">${esc(p.name)}${p.id === G.myId ? ' <span style="color:var(--gold);font-size:.65rem">(you)</span>' : ''}</div>
        <div class="player-score">${(p.score||0).toLocaleString()} pts</div>
      </div>
      <div class="player-rank">#${i+1}</div>
    </div>`).join('');
}

// ── Timer ──────────────────────────────────────────────────────
function startTimer(serverStart) {
  clearInterval(G.timerInterval);
  $('timer-bar').style.width = '100%';
  $('timer-bar').className   = 'timer-bar';

  G.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - serverStart) / 1000;
    const left    = Math.max(0, QUESTION_TIME - elapsed);
    const pct     = (left / QUESTION_TIME) * 100;

    $('timer-bar').style.width = pct + '%';
    $('timer-bar').className   = 'timer-bar' + (pct < 25 ? ' danger' : pct < 50 ? ' warn' : '');
    $('timer-text').textContent = Math.ceil(left);

    if (left <= 0) {
      clearInterval(G.timerInterval);
      if (!G.hasAnswered) onTimeout();
      if (G.isHost && !G._revealPending) {
        G._revealPending = true;
        setTimeout(doReveal, 1000);
      }
    }
  }, 100);
}

// ── Confetti ───────────────────────────────────────────────────
function launchConfetti() {
  const cvs = $('confetti-canvas');
  const ctx = cvs.getContext('2d');
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;

  const palette = ['#d4af37','#4a9eff','#a78bfa','#34d399','#fb923c','#f472b6'];
  const pieces  = Array.from({ length: 130 }, () => ({
    x:     Math.random() * cvs.width,
    y:     Math.random() * cvs.height - cvs.height,
    w:     Math.random() * 10 + 4,
    h:     Math.random() * 6 + 3,
    color: palette[Math.floor(Math.random() * palette.length)],
    vx:    (Math.random() - 0.5) * 3,
    vy:    Math.random() * 3 + 1.5,
    rot:   Math.random() * 360,
    rv:    (Math.random() - 0.5) * 7,
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
      ctx.fillStyle   = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (frame < 290) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cvs.width, cvs.height);
  })();
}
