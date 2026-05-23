(function () {
const { setupControls, updateHeldControls } = window.TrafficDashControls;
const { createRenderer, updateHud } = window.TrafficDashRender;
const { state, updateGame } = window.TrafficDash;
const elements = {
  canvas: document.querySelector("#gameCanvas"),
  distanceValue: document.querySelector("#distanceValue"),
  speedValue: document.querySelector("#speedValue"),
  patienceValue: document.querySelector("#patienceValue"),
  statusValue: document.querySelector("#statusValue"),
  restartButton: document.querySelector("#restartButton"),
  overlayRestartButton: document.querySelector("#overlayRestartButton"),
  muteButton: document.querySelector("#muteButton"),
  overlay: document.querySelector("#gameOverlay"),
  overlayBadge: document.querySelector("#overlayBadge"),
  overlayTitle: document.querySelector("#overlayTitle"),
  overlayText: document.querySelector("#overlayText"),
  touchButtons: document.querySelectorAll(".touch-button")
};

const renderer = createRenderer(elements.canvas);
const audio = createAudio();
let lastFrameTime = performance.now();

setupControls(elements);
requestAnimationFrame(gameLoop);

function gameLoop(now) {
  const deltaSeconds = Math.min(0.033, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  updateHeldControls(deltaSeconds);
  updateGame(deltaSeconds);
  renderer.draw();
  updateHud(elements);
  playQueuedSounds();

  requestAnimationFrame(gameLoop);
}

function createAudio() {
  let context = null;

  function ensureContext() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === "suspended") {
      context.resume();
    }
    return context;
  }

  window.addEventListener("pointerdown", ensureContext, { once: true });
  window.addEventListener("keydown", ensureContext, { once: true });

  return {
    play(name) {
      const ctx = ensureContext();
      if (!ctx || state.muted) return;

      const sounds = {
        lane: [440, 0.045, "triangle", 0.035],
        fast: [660, 0.06, "square", 0.025],
        slow: [260, 0.07, "sine", 0.035],
        bump: [120, 0.1, "sawtooth", 0.04],
        coffee: [760, 0.12, "triangle", 0.04],
        win: [880, 0.16, "triangle", 0.05],
        lose: [180, 0.18, "sine", 0.045]
      };
      const sound = sounds[name];
      if (!sound) return;

      const [frequency, duration, type, gainValue] = sound;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    }
  };
}

function playQueuedSounds() {
  while (state.soundQueue.length > 0) {
    audio.play(state.soundQueue.shift());
  }
}
}());
