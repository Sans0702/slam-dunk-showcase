/* ==========================================================================
   2D BASKETBALL PHYSICS & HOOP COLLISION ENGINE
   ========================================================================== */

class PhysicsEngine {
  constructor() {
    this.gravity = 0.42;
    this.airResistance = 0.994;
    this.bounceDamping = 0.72;
    
    // Hoop Geometry Specs (Default relative dimensions)
    this.hoop = {
      x: 0,
      y: 0,
      rimRadius: 8,
      rimWidth: 70, // Width between left and right rim pins
      backboardWidth: 12,
      backboardHeight: 110,
      leftPin: { x: 0, y: 0 },
      rightPin: { x: 0, y: 0 },
      backboardX: 0,
      backboardY: 0,
      targetY: 0
    };

    // Wind vector
    this.wind = { x: 0, y: 0 };
  }

  // Update Hoop Position based on Screen Size
  updateHoopPosition(canvasWidth, canvasHeight, offsetX = 0, offsetY = 0) {
    const isMobile = canvasWidth < 600;
    const hoopX = canvasWidth * 0.75 + offsetX;
    const hoopY = canvasHeight * 0.32 + offsetY;
    const rimW = isMobile ? 58 : 72;

    this.hoop.x = hoopX;
    this.hoop.y = hoopY;
    this.hoop.rimWidth = rimW;
    this.hoop.leftPin = { x: hoopX - rimW / 2, y: hoopY };
    this.hoop.rightPin = { x: hoopX + rimW / 2, y: hoopY };
    
    // Backboard is to the right of the right rim pin
    this.hoop.backboardX = hoopX + rimW / 2 + 10;
    this.hoop.backboardY = hoopY - 80;
    this.hoop.backboardHeight = 130;
    this.hoop.backboardWidth = 14;
    this.hoop.targetY = hoopY + 15;
  }

  // Predict parabolic trajectory dots for drag aiming guide
  calculateTrajectory(startPos, velocity, pointsCount = 30) {
    const dots = [];
    let px = startPos.x;
    let py = startPos.y;
    let vx = velocity.x;
    let vy = velocity.y;

    for (let i = 0; i < pointsCount; i++) {
      dots.push({ x: px, y: py });
      vx += this.wind.x * 0.05;
      vy += this.gravity;
      vx *= this.airResistance;
      vy *= this.airResistance;
      px += vx;
      py += vy;

      // Stop trajectory if below screen
      if (py > startPos.y + 300) break;
    }
    return dots;
  }

  // Update Basketball Position & Collisions for 1 Frame
  stepBall(ball, soundEngine) {
    if (!ball.isShot) return;

    // Apply Physics Forces
    ball.vy += this.gravity;
    ball.vx += this.wind.x * 0.02;

    ball.vx *= this.airResistance;
    ball.vy *= this.airResistance;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Rotate ball based on velocity
    ball.rotation += ball.vx * 0.04;

    // --- 1. BACKBOARD COLLISION ---
    const bbLeft = this.hoop.backboardX;
    const bbRight = this.hoop.backboardX + this.hoop.backboardWidth;
    const bbTop = this.hoop.backboardY;
    const bbBottom = this.hoop.backboardY + this.hoop.backboardHeight;

    if (
      ball.x + ball.radius >= bbLeft &&
      ball.x - ball.radius <= bbRight &&
      ball.y >= bbTop &&
      ball.y <= bbBottom
    ) {
      if (ball.vx > 0) {
        ball.x = bbLeft - ball.radius;
        ball.vx = -ball.vx * this.bounceDamping;
        ball.hitRim = true;
        soundEngine.playRim();
      }
    }

    // --- 2. RIM PIN COLLISION (Left & Right Metallic Rim Tips) ---
    this.checkPinCollision(ball, this.hoop.leftPin, soundEngine);
    this.checkPinCollision(ball, this.hoop.rightPin, soundEngine);

    // --- 3. FLOOR & WALL BOUNDS COLLISION ---
    if (ball.y + ball.radius >= ball.canvasHeight - 20) {
      if (Math.abs(ball.vy) > 1.5) {
        soundEngine.playBounce(Math.min(Math.abs(ball.vy) / 10, 1));
      }
      ball.y = ball.canvasHeight - 20 - ball.radius;
      ball.vy = -ball.vy * 0.55;
      ball.vx *= 0.8;

      if (Math.abs(ball.vy) < 0.5) {
        ball.isShot = false; // Ball came to rest
      }
    }

    // --- 4. HOOP SCORE DETECTION ---
    this.checkHoopScore(ball, soundEngine);
  }

  // Circle vs Circle Collision with Rim Pins
  checkPinCollision(ball, pin, soundEngine) {
    const dx = ball.x - pin.x;
    const dy = ball.y - pin.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.radius + this.hoop.rimRadius;

    if (dist < minDist) {
      // Collision normal vector
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      // Reposition ball outside pin overlap
      ball.x = pin.x + nx * minDist;
      ball.y = pin.y + ny * minDist;

      // Dot product for velocity reflection
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
        ball.hitRim = true;
        soundEngine.playRim();
      }
    }
  }

  // Check if ball passes cleanly down through the rim net plane
  checkHoopScore(ball, soundEngine) {
    if (ball.hasScored) return;

    const rimY = this.hoop.y;
    const leftX = this.hoop.leftPin.x + 5;
    const rightX = this.hoop.rightPin.x - 5;

    // Check if ball center crossed the rim height going downwards
    if (
      ball.vy > 0 &&
      ball.y >= rimY - 5 &&
      ball.y <= rimY + 25 &&
      ball.x >= leftX &&
      ball.x <= rightX
    ) {
      ball.hasScored = true;
      ball.isSwish = !ball.hitRim;

      if (ball.isSwish) {
        soundEngine.playSwish();
      } else {
        soundEngine.playSwish();
      }
    }
  }
}
