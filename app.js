/* ============================================================
   Discovering & Sharing Cultures — Game Engine
   ============================================================ */

// ── Helpers ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const AVATAR_COLORS = [
  '#6c5ce7','#00b894','#e17055','#0984e3',
  '#fdcb6e','#e84393','#00cec9','#d63031',
  '#a29bfe','#55efc4'
];

const FLAG_URL = (code) => `https://flagcdn.com/w80/${code}.png`;

// ── Game State ───────────────────────────────────────────────
const game = {
  players: [],           // { id, name, color, score, roundScore, streak, answers:{} }
  currentPlayerIdx: 0,
  currentRound: 0,       // 0-based
  currentQIdx: 0,        // 0-based within round
  roundQuestions: [],     // 10 questions for current round
  allShuffled: [],        // all 40 shuffled
  questionAnswers: [],    // answers for current question from all players
  timerInterval: null,
  timerStart: 0,
  QUESTION_TIME: 20,     // seconds
  TOTAL_ROUNDS: 4,
  QUESTIONS_PER_ROUND: 10
};

// ── Initialization ───────────────────────────────────────────
function init() {
  // Event listeners
  $('btn-add-player').addEventListener('click', onAddPlayer);
  $('player-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAddPlayer();
  });
  $('btn-start-game').addEventListener('click', onStartGame);
  $('btn-ready').addEventListener('click', onPlayerReady);
  $('btn-next-question').addEventListener('click', onNextQuestion);
  $('btn-next-round').addEventListener('click', onNextRound);
  $('btn-play-again').addEventListener('click', onPlayAgain);

  // Option buttons
  document.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => onAnswer(parseInt(btn.dataset.index)));
  });
}

// ── Player Management ────────────────────────────────────────
function onAddPlayer() {
  const input = $('player-name-input');
  const name = input.value.trim();
  if (!name) return;
  if (game.players.length >= 10) return;
  if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    input.value = '';
    return;
  }

  const player = {
    id: Date.now(),
    name,
    color: AVATAR_COLORS[game.players.length % AVATAR_COLORS.length],
    score: 0,
    roundScore: 0,
    streak: 0,
    answers: {}
  };

  game.players.push(player);
  input.value = '';
  input.focus();
  renderPlayerList();
  $('btn-start-game').disabled = false;
}

function renderPlayerList() {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  $('player-list').innerHTML = sorted.map((p, i) => `
    <div class="player-card" id="pc-${p.id}">
      <div class="player-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <div class="player-info">
        <div class="player-name">${esc(p.name)}</div>
        <div class="player-score">${p.score.toLocaleString()} pts</div>
      </div>
      <div class="player-rank">#${i + 1}</div>
    </div>
  `).join('');
}

function highlightActivePlayer(playerId) {
  document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active-player'));
  const el = $(`pc-${playerId}`);
  if (el) el.classList.add('active-player');
}

// ── Game Flow ────────────────────────────────────────────────
function onStartGame() {
  game.allShuffled = shuffle(ALL_QUESTIONS);
  game.currentRound = 0;
  game.players.forEach(p => { p.score = 0; p.roundScore = 0; p.streak = 0; p.answers = {}; });
  startRound();
}

function startRound() {
  const start = game.currentRound * game.QUESTIONS_PER_ROUND;
  game.roundQuestions = game.allShuffled.slice(start, start + game.QUESTIONS_PER_ROUND);
  game.currentQIdx = 0;
  game.players.forEach(p => p.roundScore = 0);

  $('current-round').textContent = game.currentRound + 1;
  renderPlayerList();

  if (game.players.length > 1) {
    game.currentPlayerIdx = 0;
    game.questionAnswers = [];
    showTurnOverlay();
  } else {
    game.currentPlayerIdx = 0;
    showScreen('screen-game');
    presentQuestion();
  }
}

// ── Turn Overlay (multiplayer) ───────────────────────────────
function showTurnOverlay() {
  const p = game.players[game.currentPlayerIdx];
  $('turn-avatar').style.background = p.color;
  $('turn-avatar').textContent = p.name[0].toUpperCase();
  $('turn-name').textContent = p.name;
  highlightActivePlayer(p.id);

  showScreen('screen-game');
  $('overlay-turn').style.display = 'flex';

  // Hide question content while turn overlay is up
  $('question-section').style.visibility = 'hidden';
  $('options-grid').style.visibility = 'hidden';
}

function onPlayerReady() {
  $('overlay-turn').style.display = 'none';
  $('question-section').style.visibility = 'visible';
  $('options-grid').style.visibility = 'visible';
  presentQuestion();
}

// ── Present Question ─────────────────────────────────────────
function presentQuestion() {
  const q = game.roundQuestions[game.currentQIdx];
  const p = game.players[game.currentPlayerIdx];

  // Update header
  $('current-question').textContent = game.currentQIdx + 1;
  $('question-flag').src = FLAG_URL(q.flag);
  $('question-flag').alt = q.country;
  $('question-text').textContent = q.question;

  // Shuffle options but track correct index
  const indices = [0, 1, 2, 3];
  const shuffledIndices = shuffle(indices);
  const optBtns = document.querySelectorAll('.option-btn');

  optBtns.forEach((btn, i) => {
    const origIdx = shuffledIndices[i];
    btn.querySelector('.option-text').textContent = q.options[origIdx];
    btn.dataset.origIndex = origIdx;
    btn.disabled = false;
    btn.classList.remove('correct-reveal', 'wrong-reveal');
    btn.style.transform = '';
    btn.style.opacity = '';
  });

  // Store shuffled mapping for this question
  game._currentShuffledIndices = shuffledIndices;

  // Show player banner (multiplayer)
  if (game.players.length > 1) {
    $('current-player-banner').style.display = 'flex';
    $('banner-avatar').style.background = p.color;
    $('banner-avatar').textContent = p.name[0].toUpperCase();
    $('banner-name').textContent = p.name;
  } else {
    $('current-player-banner').style.display = 'none';
  }

  // Animate in
  $('question-section').style.animation = 'none';
  void $('question-section').offsetHeight;
  $('question-section').style.animation = 'fadeInUp 0.4s ease';

  // Start timer
  startTimer();
}

// ── Handle Answer ────────────────────────────────────────────
function onAnswer(displayIdx) {
  stopTimer();

  const q = game.roundQuestions[game.currentQIdx];
  const p = game.players[game.currentPlayerIdx];
  const origIdx = parseInt(document.querySelectorAll('.option-btn')[displayIdx].dataset.origIndex);
  const isCorrect = origIdx === q.correct;

  // Calculate points
  const elapsed = (Date.now() - game.timerStart) / 1000;
  const remaining = Math.max(0, game.QUESTION_TIME - elapsed);
  let points = 0;
  if (isCorrect) {
    points = Math.max(100, Math.round(1000 * (remaining / game.QUESTION_TIME)));
    p.streak++;
    // Streak bonus
    if (p.streak >= 3) points += 200;
    if (p.streak >= 5) points += 300;
  } else {
    p.streak = 0;
  }

  p.score += points;
  p.roundScore += points;

  // Record answer
  const record = { questionId: q.id, origIdx, isCorrect, points, timeMs: elapsed * 1000 };
  p.answers[q.id] = record;

  // Disable buttons
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  if (game.players.length === 1) {
    // Solo: show correct/wrong on buttons directly
    showSoloFeedback(displayIdx, isCorrect, points, q);
  } else {
    // Multiplayer: record + show brief "Answer recorded"
    game.questionAnswers.push({ playerId: p.id, ...record });
    showMultiplayerFeedback(isCorrect, points);
  }

  renderPlayerList();
}

function onTimeout() {
  stopTimer();
  const p = game.players[game.currentPlayerIdx];
  const q = game.roundQuestions[game.currentQIdx];
  p.streak = 0;
  p.answers[q.id] = { questionId: q.id, origIdx: -1, isCorrect: false, points: 0, timeMs: game.QUESTION_TIME * 1000 };

  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  if (game.players.length === 1) {
    showSoloFeedback(-1, false, 0, q);
  } else {
    game.questionAnswers.push({ playerId: p.id, questionId: q.id, origIdx: -1, isCorrect: false, points: 0 });
    showMultiplayerFeedback(false, 0);
  }
  renderPlayerList();
}

// ── Solo Feedback ────────────────────────────────────────────
function showSoloFeedback(displayIdx, isCorrect, points, q) {
  // Highlight correct/wrong on buttons
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    const origIdx = parseInt(btn.dataset.origIndex);
    if (origIdx === q.correct) {
      btn.classList.add('correct-reveal');
    } else if (i === displayIdx) {
      btn.classList.add('wrong-reveal');
      btn.style.animation = 'shake 0.4s';
    } else {
      btn.classList.add('wrong-reveal');
    }
  });

  // Show feedback overlay
  $('feedback-icon').textContent = isCorrect ? '✓' : '✗';
  $('feedback-icon').className = 'feedback-icon ' + (isCorrect ? 'correct' : 'wrong');
  $('feedback-text').textContent = isCorrect ? 'Correct!' : (displayIdx === -1 ? "Time's up!" : 'Wrong!');
  $('feedback-points').innerHTML = points > 0
    ? `<span class="points-earned">+${points}</span>`
    : `<span class="no-points">No points</span>`;
  $('overlay-feedback').style.display = 'flex';

  setTimeout(() => {
    $('overlay-feedback').style.display = 'none';
    advanceAfterQuestion();
  }, 1800);
}

// ── Multiplayer Feedback ─────────────────────────────────────
function showMultiplayerFeedback(isCorrect, points) {
  $('feedback-icon').textContent = isCorrect ? '✓' : '✗';
  $('feedback-icon').className = 'feedback-icon ' + (isCorrect ? 'correct' : 'wrong');
  $('feedback-text').textContent = 'Answer recorded!';
  $('feedback-points').innerHTML = points > 0
    ? `<span class="points-earned">+${points}</span>`
    : `<span class="no-points">0 points</span>`;
  $('overlay-feedback').style.display = 'flex';

  setTimeout(() => {
    $('overlay-feedback').style.display = 'none';

    // Next player or reveal
    if (game.currentPlayerIdx < game.players.length - 1) {
      game.currentPlayerIdx++;
      showTurnOverlay();
    } else {
      showAnswerReveal();
    }
  }, 1200);
}

// ── Answer Reveal (multiplayer) ──────────────────────────────
function showAnswerReveal() {
  const q = game.roundQuestions[game.currentQIdx];
  $('correct-answer-text').textContent = q.options[q.correct];

  // Show each player's result
  let html = '';
  game.players.forEach(p => {
    const ans = game.questionAnswers.find(a => a.playerId === p.id);
    const correct = ans && ans.isCorrect;
    const pts = ans ? ans.points : 0;
    html += `
      <div class="player-result-row ${correct ? 'result-correct' : 'result-wrong'}">
        <span style="display:flex;align-items:center;gap:8px">
          <span class="result-icon">${correct ? '✅' : '❌'}</span>
          <strong>${esc(p.name)}</strong>
        </span>
        <span class="result-points">${pts > 0 ? '+' + pts : '0'}</span>
      </div>`;
  });
  $('player-results').innerHTML = html;
  $('overlay-reveal').style.display = 'flex';
}

function onNextQuestion() {
  $('overlay-reveal').style.display = 'none';
  advanceAfterQuestion();
}

// ── Advance Logic ────────────────────────────────────────────
function advanceAfterQuestion() {
  game.currentQIdx++;
  if (game.currentQIdx >= game.QUESTIONS_PER_ROUND) {
    endRound();
    return;
  }

  game.currentPlayerIdx = 0;
  game.questionAnswers = [];

  if (game.players.length > 1) {
    showTurnOverlay();
  } else {
    presentQuestion();
  }
}

// ── Round End ────────────────────────────────────────────────
function endRound() {
  const roundNum = game.currentRound + 1;
  $('round-end-title').textContent = `Round ${roundNum} Complete! 🎉`;

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  $('round-leaderboard').innerHTML = sorted.map((p, i) => `
    <div class="leaderboard-row">
      <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-score">${p.score.toLocaleString()}<span class="lb-round-score">(+${p.roundScore.toLocaleString()})</span></span>
    </div>
  `).join('');

  if (game.currentRound >= game.TOTAL_ROUNDS - 1) {
    $('btn-next-round').textContent = 'See Final Results 🏆';
  } else {
    $('btn-next-round').textContent = 'Next Round →';
  }

  showScreen('screen-round-end');
}

function onNextRound() {
  game.currentRound++;
  if (game.currentRound >= game.TOTAL_ROUNDS) {
    endGame();
  } else {
    startRound();
  }
}

// ── Game End ─────────────────────────────────────────────────
function endGame() {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);

  // Build podium (top 3)
  let podiumHTML = '';
  const podiumOrder = sorted.length >= 3 ? [sorted[1], sorted[0], sorted[2]] : [...sorted];
  const placeLabels = sorted.length >= 3 ? [2, 1, 3] : sorted.map((_, i) => i + 1);
  const placeClasses = ['second', 'first', 'third'];

  if (sorted.length < 3) {
    // Simple podium for 1-2 players
    sorted.forEach((p, i) => {
      const cls = i === 0 ? 'first' : 'second';
      podiumHTML += `
        <div class="podium-place">
          <div class="podium-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
          <div class="podium-name">${esc(p.name)}</div>
          <div class="podium-score-text">${p.score.toLocaleString()} pts</div>
          <div class="podium-bar ${cls}">${i + 1}</div>
        </div>`;
    });
  } else {
    podiumOrder.forEach((p, i) => {
      podiumHTML += `
        <div class="podium-place">
          <div class="podium-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
          <div class="podium-name">${esc(p.name)}</div>
          <div class="podium-score-text">${p.score.toLocaleString()} pts</div>
          <div class="podium-bar ${placeClasses[i]}">${placeLabels[i]}</div>
        </div>`;
    });
  }
  $('podium').innerHTML = podiumHTML;

  // Full leaderboard
  $('final-leaderboard').innerHTML = sorted.map((p, i) => `
    <div class="leaderboard-row">
      <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <div class="lb-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-score">${p.score.toLocaleString()}</span>
    </div>
  `).join('');

  showScreen('screen-game-end');
  launchConfetti();
}

function onPlayAgain() {
  game.players = [];
  game.currentRound = 0;
  game.currentQIdx = 0;
  $('btn-start-game').disabled = true;
  renderPlayerList();
  showScreen('screen-welcome');
  $('player-name-input').focus();
}

// ── Timer ────────────────────────────────────────────────────
function startTimer() {
  game.timerStart = Date.now();
  const bar = $('timer-bar');
  const text = $('timer-text');
  bar.style.width = '100%';
  bar.className = 'timer-bar';

  clearInterval(game.timerInterval);
  game.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - game.timerStart) / 1000;
    const remaining = Math.max(0, game.QUESTION_TIME - elapsed);
    const pct = (remaining / game.QUESTION_TIME) * 100;

    bar.style.width = pct + '%';
    text.textContent = Math.ceil(remaining);

    if (pct < 25) {
      bar.className = 'timer-bar danger';
    } else if (pct < 50) {
      bar.className = 'timer-bar warning';
    }

    if (remaining <= 0) {
      onTimeout();
    }
  }, 100);
}

function stopTimer() {
  clearInterval(game.timerInterval);
}

// ── Screen Management ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ── Confetti 🎊 ─────────────────────────────────────────────
function launchConfetti() {
  const canvas = $('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#e74c3c', '#3498db', '#f39c12', '#27ae60', '#9b59b6', '#e84393', '#00cec9', '#ffd700'];

  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  let frame = 0;
  const maxFrames = 300;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      if (frame > maxFrames - 60) p.opacity = Math.max(0, p.opacity - 0.02);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();
}

// ── Utility ──────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
