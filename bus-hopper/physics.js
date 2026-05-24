(function () {
const GRAVITY = 1750;
const JUMP_SPEED = 760;
const DOUBLE_JUMP_SPEED = 690;
const TERMINAL_VELOCITY = 1400;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function resolvePlatformLanding(player, platform, previousBottom) {
  const playerRect = player.getRect();
  const platformRect = getPlatformRect(platform);
  const falling = player.velocityY >= 0;
  const crossedTop = previousBottom <= platformRect.y + 10 && playerRect.y + playerRect.height >= platformRect.y;

  if (falling && crossedTop && rectsOverlap(playerRect, platformRect)) {
    player.y = platformRect.y - player.height;
    player.velocityY = 0;
    player.landOn(platform);
    return true;
  }

  return false;
}

function getPlatformRect(platform) {
  if (typeof platform.getTopRect === "function") {
    return platform.getTopRect();
  }

  return {
    x: platform.x,
    y: platform.y,
    width: platform.width,
    height: Math.max(12, platform.height || 12)
  };
}

window.BusHopperPhysics = {
  GRAVITY,
  JUMP_SPEED,
  DOUBLE_JUMP_SPEED,
  TERMINAL_VELOCITY,
  clamp,
  lerp,
  rectsOverlap,
  resolvePlatformLanding
};
}());
