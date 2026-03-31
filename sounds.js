/* ================================================================
   Sound Engine — Web Audio API (no external files needed)
   All sounds synthesized in the browser
   ================================================================ */

const SFX = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function resume() {
    if (muted) return false;
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
    return true;
  }

  // Core tone helper
  function tone(freq, startDelay, dur, type = 'sine', gain = 0.25, rampDown = true) {
    if (muted) return;
    const c = getCtx();
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.connect(vol);
    vol.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + startDelay);
    vol.gain.setValueAtTime(gain, c.currentTime + startDelay);
    if (rampDown) {
      vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + dur);
    }
    osc.start(c.currentTime + startDelay);
    osc.stop(c.currentTime + startDelay + dur + 0.01);
  }

  // White noise helper (for snare / roll effects)
  function noise(startDelay, dur, gain = 0.15) {
    if (muted) return;
    const c = getCtx();
    const bufSize = Math.ceil(c.sampleRate * dur);
    const buf  = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const vol = c.createGain();
    vol.gain.setValueAtTime(gain, c.currentTime + startDelay);
    vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + dur);
    src.connect(vol);
    vol.connect(c.destination);
    src.start(c.currentTime + startDelay);
  }

  // ── PUBLIC SOUNDS ──────────────────────────────────────────

  // Player joined lobby
  function playerJoined() {
    if (!resume()) return;
    tone(880,  0,    0.08, 'sine', 0.14);
    tone(1100, 0.09, 0.12, 'sine', 0.12);
  }

  // Ready button clicked
  function readyUp() {
    if (!resume()) return;
    tone(659, 0,    0.07, 'sine', 0.15);
    tone(880, 0.08, 0.10, 'sine', 0.18);
  }

  // Game is starting countdown
  function countdownBeep(isLast = false) {
    if (!resume()) return;
    tone(isLast ? 1047 : 784, 0, isLast ? 0.35 : 0.18, 'sine', isLast ? 0.28 : 0.2);
  }

  // Question appears on screen
  function questionStart() {
    if (!resume()) return;
    tone(440, 0,    0.05, 'sine', 0.14);
    tone(554, 0.07, 0.05, 'sine', 0.14);
    tone(659, 0.14, 0.09, 'sine', 0.16);
  }

  // Timer tick — last 5 seconds
  function timerTick(secsLeft) {
    if (!resume()) return;
    const freq = secsLeft <= 3 ? 1100 : 880;
    const gain = secsLeft <= 3 ? 0.2  : 0.14;
    tone(freq, 0, 0.06, 'square', gain);
  }

  // Correct answer — ascending happy arpeggio
  function correct() {
    if (!resume()) return;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => tone(f, i * 0.08, 0.28, 'sine', 0.22));
    // sparkle overtone
    notes.forEach((f, i) => tone(f * 2, i * 0.08 + 0.02, 0.12, 'sine', 0.06));
  }

  // Wrong answer — descending buzzer
  function wrong() {
    if (!resume()) return;
    tone(320, 0,    0.10, 'sawtooth', 0.18);
    tone(250, 0.11, 0.10, 'sawtooth', 0.14);
    tone(190, 0.22, 0.14, 'sawtooth', 0.10);
  }

  // Timeout — subtle descending
  function timeout() {
    if (!resume()) return;
    tone(400, 0,    0.12, 'sine', 0.15);
    tone(300, 0.13, 0.15, 'sine', 0.12);
  }

  // Reveal — short drum roll then hit
  function reveal() {
    if (!resume()) return;
    const rollCount = 7;
    for (let i = 0; i < rollCount; i++) {
      noise(i * 0.055, 0.05, 0.10 + i * 0.008);
      tone(180, i * 0.055, 0.05, 'sine', 0.08); // kick undertone
    }
    // Reveal hit chord
    const t = rollCount * 0.055 + 0.06;
    tone(523, t,        0.25, 'sine',     0.22);
    tone(659, t + 0.01, 0.22, 'sine',     0.18);
    tone(784, t + 0.02, 0.20, 'sine',     0.15);
    tone(1047, t + 0.03, 0.18, 'triangle', 0.10);
  }

  // Round end leaderboard
  function roundEnd() {
    if (!resume()) return;
    const melody = [523, 659, 784, 880, 1047, 1319];
    melody.forEach((f, i) => {
      tone(f,     i * 0.10, 0.24, 'sine',     0.20);
      tone(f * 2, i * 0.10, 0.12, 'triangle', 0.06);
    });
  }

  // Game end — triumphant fanfare (Kahoot-style)
  function gameEnd() {
    if (!resume()) return;

    // Bass rhythm
    [0, 0.4, 0.75].forEach(t => {
      tone(130, t, 0.18, 'sine', 0.22);
      noise(t, 0.08, 0.18);
    });

    // Main fanfare melody
    const fanfare = [
      [523, 0.1],  [523, 0.22], [523, 0.32],
      [415, 0.44], [622, 0.54],
      [523, 0.70], [415, 0.82], [622, 0.94],
      [1047, 1.10]
    ];
    fanfare.forEach(([f, t]) => tone(f, t, 0.28, 'sine', 0.22));
    // Harmony
    fanfare.forEach(([f, t]) => tone(f * 1.25, t + 0.03, 0.22, 'triangle', 0.10));
    // High sparkle
    fanfare.forEach(([f, t]) => tone(f * 2, t + 0.01, 0.12, 'sine', 0.06));

    // Final chord hit
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, 1.45 + i * 0.02, 0.6, 'sine', 0.20);
    });
  }

  // Mute toggle
  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  return {
    playerJoined, readyUp, countdownBeep,
    questionStart, timerTick,
    correct, wrong, timeout,
    reveal, roundEnd, gameEnd,
    toggleMute, isMuted
  };
})();
