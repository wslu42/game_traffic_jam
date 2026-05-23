(function () {
const { changeSpeed, moveLane, resetGame, setMuted, state } = window.TrafficDash;
const heldActions = new Set();

function setupControls(elements) {
  const { restartButton, overlayRestartButton, muteButton, touchButtons } = elements;

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      moveLane(-1);
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      moveLane(1);
    }
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      changeSpeed(1);
    }
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      changeSpeed(-1);
    }
    if (event.key === "Enter" && state.mode !== "playing") {
      resetGame();
    }
  });

  restartButton.addEventListener("click", resetGame);
  restartButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    resetGame();
    restartButton.blur();
  });
  overlayRestartButton.addEventListener("click", resetGame);
  overlayRestartButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    resetGame();
    overlayRestartButton.blur();
  });

  muteButton.addEventListener("click", () => {
    setMuted(!state.muted);
    updateMuteButton(muteButton);
  });

  for (const button of touchButtons) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      const action = button.dataset.action;
      heldActions.add(action);
      button.classList.add("is-active");
      performTouchAction(action);
    });

    button.addEventListener("pointerup", (event) => {
      releaseTouchAction(button, event.pointerId);
    });

    button.addEventListener("pointercancel", (event) => {
      releaseTouchAction(button, event.pointerId);
    });

    button.addEventListener("lostpointercapture", () => {
      heldActions.delete(button.dataset.action);
      button.classList.remove("is-active");
    });
  }

  updateMuteButton(muteButton);
}

function updateHeldControls(deltaSeconds) {
  if (state.mode !== "playing") return;

  state.touchRepeatTimer = (state.touchRepeatTimer || 0) - deltaSeconds;
  if (state.touchRepeatTimer > 0) return;

  if (heldActions.has("fast")) {
    changeSpeed(1);
    state.touchRepeatTimer = 0.28;
  }
  if (heldActions.has("slow")) {
    changeSpeed(-1);
    state.touchRepeatTimer = 0.28;
  }
}

function performTouchAction(action) {
  if (action === "left") moveLane(-1);
  if (action === "right") moveLane(1);
  if (action === "fast") changeSpeed(1);
  if (action === "slow") changeSpeed(-1);
}

function releaseTouchAction(button, pointerId) {
  if (button.hasPointerCapture(pointerId)) {
    button.releasePointerCapture(pointerId);
  }
  heldActions.delete(button.dataset.action);
  button.classList.remove("is-active");
}

function updateMuteButton(button) {
  button.textContent = state.muted ? "🔇" : "🔊";
  button.setAttribute("aria-pressed", String(state.muted));
  button.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
}

window.TrafficDashControls = {
  setupControls,
  updateHeldControls
};
}());
