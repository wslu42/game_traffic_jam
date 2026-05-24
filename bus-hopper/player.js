(function () {
const { GRAVITY, JUMP_SPEED, DOUBLE_JUMP_SPEED, TERMINAL_VELOCITY, clamp } = window.BusHopperPhysics;

function createPlayer() {
  return {
    x: 148,
    y: 250,
    width: 42,
    height: 58,
    velocityX: 204,
    velocityY: 0,
    jumpsUsed: 0,
    grounded: false,
    platformId: null,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    idleTimer: 0,
    blinkTimer: 0,

    getRect() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height
      };
    },

    jump() {
      const canGroundJump = this.grounded || this.coyoteTimer > 0;
      const canAirJump = !canGroundJump && this.jumpsUsed < 2;
      if (!canGroundJump && !canAirJump) return false;

      this.velocityY = canGroundJump ? -JUMP_SPEED : -DOUBLE_JUMP_SPEED;
      this.jumpsUsed = canGroundJump ? 1 : this.jumpsUsed + 1;
      this.grounded = false;
      this.platformId = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      return true;
    },

    requestJump() {
      this.jumpBufferTimer = 0.14;
      return this.jump();
    },

    consumeBufferedJump() {
      if (this.jumpBufferTimer <= 0) return false;
      return this.jump();
    },

    landOn(platform) {
      this.grounded = true;
      this.jumpsUsed = 0;
      this.platformId = platform.id;
      this.coyoteTimer = 0.14;
      this.velocityX = clamp(this.velocityX + 10, 180, 378);
    },

    leaveGround() {
      this.grounded = false;
      this.platformId = null;
      this.coyoteTimer = 0.14;
      if (this.jumpsUsed === 0) this.jumpsUsed = 1;
    }
  };
}

function updatePlayer(player, deltaSeconds, currentPlatform, difficulty) {
  const previousX = player.x;

  if (currentPlatform && player.grounded) {
    player.x += (player.velocityX + currentPlatform.velocityX * 0.55) * deltaSeconds;
    player.y = currentPlatform.y - player.height;
  } else {
    player.velocityY = Math.min(TERMINAL_VELOCITY, player.velocityY + GRAVITY * deltaSeconds);
    player.x += player.velocityX * deltaSeconds;
    player.y += player.velocityY * deltaSeconds;
  }

  player.velocityX = clamp(player.velocityX + deltaSeconds * (4.2 + difficulty * 0.54), 180, 408 + difficulty * 12);
  player.coyoteTimer = player.grounded ? 0.14 : Math.max(0, player.coyoteTimer - deltaSeconds);
  player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - deltaSeconds);
  player.idleTimer = Math.abs(player.x - previousX) < 8 * deltaSeconds ? player.idleTimer + deltaSeconds : 0;
  player.blinkTimer += deltaSeconds;
}

function drawPlayer(context, player, cameraX) {
  const x = player.x - cameraX;
  const y = player.y;

  context.save();
  context.translate(x, y);

  context.fillStyle = "rgba(23, 48, 75, 0.18)";
  context.beginPath();
  context.ellipse(22, 63, 24, 8, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffb15c";
  roundRect(context, 7, 19, 28, 35, 9);
  context.fill();

  context.fillStyle = "#3478f6";
  roundRect(context, 5, 36, 32, 22, 7);
  context.fill();

  context.fillStyle = "#3f2b22";
  roundRect(context, 8, 2, 28, 18, 8);
  context.fill();

  context.fillStyle = "#ffd8a8";
  context.beginPath();
  context.arc(22, 23, 16, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#17304b";
  const blink = Math.sin(player.blinkTimer * 4) > 0.95;
  if (blink) {
    context.fillRect(16, 22, 4, 2);
    context.fillRect(27, 22, 4, 2);
  } else {
    context.beginPath();
    context.arc(18, 22, 2.4, 0, Math.PI * 2);
    context.arc(29, 22, 2.4, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "#17304b";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(24, 29, 6, 0.15, Math.PI - 0.15);
  context.stroke();

  context.strokeStyle = "#ffd8a8";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(8, 41);
  context.lineTo(-3, 31);
  context.moveTo(36, 41);
  context.lineTo(48, 33);
  context.stroke();

  context.strokeStyle = "#17304b";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(14, 57);
  context.lineTo(11, 67);
  context.moveTo(30, 57);
  context.lineTo(34, 67);
  context.stroke();

  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

window.BusHopperPlayer = {
  createPlayer,
  updatePlayer,
  drawPlayer
};
}());
