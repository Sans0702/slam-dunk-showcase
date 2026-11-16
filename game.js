/* ==========================================================================
   SLAM DUNK SHOWCASE - MAIN GAME CONTROLLER & RENDERER
   ========================================================================== */

class GameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.physics = new PhysicsEngine();

    // Game States
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.mode = 'arcade'; // 'arcade', 'suddenDeath', 'movingHoop', 'trickShot'

    // Score & Stats
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.shotsTaken = 0;
    this.shotsMade = 0;
    this.swishes = 0;
    this.coins = parseInt(localStorage.getItem('dunk_coins')) || 0;
    this.timer = 60;
    this.lives = 3;
    this.timerInterval = null;

    // Moving Hoop Animation offset
    this.hoopMoveAngle = 0;
    this.hoopOffsetX = 0;
    this.hoopOffsetY = 0;

    // Player Ball State
    this.ball = {
      x: 0,
      y: 0,
      radius: 24,
      vx: 0,
      vy: 0,
      rotation: 0,
      isShot: false,
      hasScored: false,
      hitRim: false,
      isSwish: false,
      canvasHeight: 0
    };

    // Drag Aiming Controls
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.launchVelocity = { x: 0, y: 0 };

    // Particles & Toasts
    this.particles = [];

    // Customization & Unlocks
    this.equippedBall = localStorage.getItem('dunk_ball_skin') || 'classic';
    this.equippedCourt = localStorage.getItem('dunk_court_theme') || 'streetball';
    this.unlockedBalls = JSON.parse(localStorage.getItem('dunk_unlocked_balls')) || ['classic'];
    this.unlockedCourts = JSON.parse(localStorage.getItem('dunk_unlocked_courts')) || ['streetball'];

    // High Scores per Mode
    this.highScores = JSON.parse(localStorage.getItem('dunk_high_scores')) || {
      arcade: 0,
      suddenDeath: 0,
      movingHoop: 0,
      trickShot: 0
    };

    // Achievements Data
    this.achievements = [
      { id: 'first_basket', title: 'First Bucket', desc: 'Score your very first shot', icon: '🏀', unlocked: false },
      { id: 'swish_master', title: 'Swish Master', desc: 'Get 5 clean swishes in a single game', icon: '🎯', unlocked: false },
      { id: 'on_fire', title: 'On Fire!', desc: 'Reach a 5x shot streak', icon: '🔥', unlocked: false },
      { id: 'century', title: 'Century Club', desc: 'Accumulate 100 total score points', icon: '💯', unlocked: false },
      { id: 'rich', title: 'Baller', desc: 'Collect 100 total coins', icon: '🪙', unlocked: false }
    ];
    this.loadAchievements();

    // Definitions for Shop Items
    this.ballSkins = [
      { id: 'classic', name: 'Classic Leather', price: 0, color: '#ff6b00', seam: '#111' },
      { id: 'neon', name: 'Cyber Neon', price: 50, color: '#00f2fe', seam: '#ff0844' },
      { id: 'gold', name: 'Golden Champ', price: 150, color: '#ffb700', seam: '#ffffff' },
      { id: 'fire', name: 'Fireball', price: 250, color: '#ff2a00', seam: '#ffea00' },
      { id: 'plasma', name: 'Plasma Electric', price: 400, color: '#a855f7', seam: '#06b6d4' }
    ];

    this.courtThemes = [
      { id: 'streetball', name: 'Urban Streetball', price: 0, bg1: '#171d30', bg2: '#080b13' },
      { id: 'cyber', name: 'Cyberpunk Night', price: 100, bg1: '#2a0845', bg2: '#0b001a' },
      { id: 'arena', name: 'Pro Stadium', price: 200, bg1: '#1e3a8a', bg2: '#0f172a' },
      { id: 'sunset', name: 'Sunset Beach', price: 300, bg1: '#7c2d12', bg2: '#18181b' }
    ];

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindEvents();
    this.updateHUD();
    this.renderShop();
    this.renderAchievements();

    // Position ball at starting position
    this.resetBallPosition();

    // Start Animation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);

    this.ball.canvasHeight = window.innerHeight;
    this.physics.updateHoopPosition(window.innerWidth, window.innerHeight, this.hoopOffsetX, this.hoopOffsetY);

    if (!this.ball.isShot) {
      this.resetBallPosition();
    }
  }

  resetBallPosition() {
    const isMobile = window.innerWidth < 600;
    this.ball.x = isMobile ? window.innerWidth * 0.22 : window.innerWidth * 0.25;
    this.ball.y = window.innerHeight * 0.65;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.isShot = false;
    this.ball.hasScored = false;
    this.ball.hitRim = false;
    this.ball.isSwish = false;
  }

  // Bind Event Listeners
  bindEvents() {
    // Canvas Drag & Touch Listeners
    const startDrag = (e) => {
      if (this.state !== 'PLAYING' || this.ball.isShot) return;
      const pos = this.getPointerPos(e);
      const dist = Math.hypot(pos.x - this.ball.x, pos.y - this.ball.y);
      
      // Allow dragging if clicked within ball area or bottom left zone
      if (dist < 100 || (pos.x < window.innerWidth * 0.4 && pos.y > window.innerHeight * 0.4)) {
        this.isDragging = true;
        this.dragStart = { x: pos.x, y: pos.y };
        this.dragCurrent = { x: pos.x, y: pos.y };
        document.getElementById('shotGuide').classList.add('hidden');
      }
    };

    const moveDrag = (e) => {
      if (!this.isDragging) return;
      const pos = this.getPointerPos(e);
      this.dragCurrent = { x: pos.x, y: pos.y };

      // Calculate launch vector from drag back (slingshot mechanics)
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const maxPower = 28;
      
      this.launchVelocity.x = Math.min(Math.max(dx * 0.18, 2), maxPower);
      this.launchVelocity.y = Math.min(Math.max(dy * 0.18, -maxPower), -3);
    };

    const endDrag = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // Shoot ball if launch velocity is valid
      if (Math.hypot(this.launchVelocity.x, this.launchVelocity.y) > 3) {
        this.ball.vx = this.launchVelocity.x;
        this.ball.vy = this.launchVelocity.y;
        this.ball.isShot = true;
        this.shotsTaken++;
        soundEngine.playClick();
      }
    };

    this.canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);

    this.canvas.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', moveDrag, { passive: true });
    window.addEventListener('touchend', endDrag);

    // UI Buttons
    document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
    document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
    document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
    document.getElementById('restartPauseBtn').addEventListener('click', () => {
      this.resumeGame();
      this.startGame();
    });
    document.getElementById('quitPauseBtn').addEventListener('click', () => {
      this.resumeGame();
      this.showModal('mainMenuModal');
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
    document.getElementById('menuGameoverBtn').addEventListener('click', () => this.showModal('mainMenuModal'));

    // Audio Toggle
    document.getElementById('audioToggleBtn').addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      document.getElementById('audioIconOn').classList.toggle('hidden', isMuted);
      document.getElementById('audioIconOff').classList.toggle('hidden', !isMuted);
    });

    // Modals buttons
    document.getElementById('shopBtn').addEventListener('click', () => this.showModal('shopModal'));
    document.getElementById('closeShopBtn').addEventListener('click', () => this.showModal('mainMenuModal'));

    document.getElementById('achievementsBtn').addEventListener('click', () => this.showModal('achievementsModal'));
    document.getElementById('closeAchievementsBtn').addEventListener('click', () => this.showModal('mainMenuModal'));

    document.getElementById('howToPlayBtn').addEventListener('click', () => this.showModal('howToPlayModal'));
    document.getElementById('closeHowToPlayBtn').addEventListener('click', () => this.showModal('mainMenuModal'));

    // Mode Selector Cards
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.mode = card.dataset.mode;
        document.getElementById('hudModeBadge').textContent = this.mode.toUpperCase();
        soundEngine.playClick();
      });
    });

    // Shop Tabs
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isBalls = tab.dataset.tab === 'balls';
        document.getElementById('ballSkinsGrid').classList.toggle('hidden', !isBalls);
        document.getElementById('courtThemesGrid').classList.toggle('hidden', isBalls);
        soundEngine.playClick();
      });
    });
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  showModal(modalId) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    if (modalId) {
      document.getElementById(modalId).classList.remove('hidden');
    }
  }

  // --- GAME START & LOOP ---
  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.shotsTaken = 0;
    this.shotsMade = 0;
    this.swishes = 0;
    this.timer = 60;
    this.lives = 3;

    this.showModal(null);
    this.resetBallPosition();
    this.updateHUD();

    // Mode Specific Configurations
    document.getElementById('windGauge').classList.toggle('hidden', this.mode !== 'trickShot');
    document.getElementById('shotGuide').classList.remove('hidden');

    if (this.mode === 'trickShot') {
      this.generateWind();
    } else {
      this.physics.wind = { x: 0, y: 0 };
    }

    if (this.mode === 'arcade') {
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.state === 'PLAYING') {
          this.timer--;
          this.updateHUD();
          if (this.timer <= 0) {
            this.endGame();
          }
        }
      }, 1000);
    }
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.showModal('pauseModal');
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.showModal(null);
  }

  generateWind() {
    const speed = (Math.random() * 8 - 4).toFixed(1);
    this.physics.wind = { x: parseFloat(speed), y: 0 };
    document.getElementById('windText').textContent = `WIND: ${speed > 0 ? '➡️' : '⬅️'} ${Math.abs(speed)} MPH`;
  }

  // --- SCORE & RESULT PROCESSING ---
  onShotScored() {
    this.shotsMade++;
    this.streak++;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;

    // Base Points
    let pts = 2;
    let toastMsg = "+2 POINTS";

    if (this.ball.isSwish) {
      this.swishes++;
      pts = 3;
      toastMsg = "PERFECT SWISH! +3";
      this.spawnParticles(this.physics.hoop.x, this.physics.hoop.y, '#ffb700', 30);
    }

    // Streak Multiplier
    const multiplier = Math.min(Math.floor(this.streak / 2) + 1, 4);
    pts *= multiplier;

    if (multiplier > 1) {
      toastMsg += ` (x${multiplier} 🔥)`;
    }

    this.score += pts;
    this.coins += multiplier;
    localStorage.setItem('dunk_coins', this.coins);

    // Arcade bonus time
    if (this.mode === 'arcade' && this.ball.isSwish) {
      this.timer += 3;
      toastMsg += " [+3s]";
    }

    // Audio Feedback
    if (this.streak >= 3) {
      soundEngine.playCheer();
    }

    this.createToast(this.physics.hoop.x, this.physics.hoop.y - 40, toastMsg, '#00e676');
    this.updateHUD();
    this.checkAchievements();

    // Reset for next shot after short delay
    setTimeout(() => {
      if (this.mode === 'movingHoop') {
        this.hoopOffsetX = (Math.random() * 120 - 60);
        this.hoopOffsetY = (Math.random() * 60 - 30);
        this.physics.updateHoopPosition(window.innerWidth, window.innerHeight, this.hoopOffsetX, this.hoopOffsetY);
      }
      if (this.mode === 'trickShot') {
        this.generateWind();
      }
      this.resetBallPosition();
    }, 1200);
  }

  onShotMissed() {
    this.streak = 0;
    this.createToast(this.ball.x, this.ball.y - 30, "MISSED!", "#ff0844");
    this.updateHUD();

    if (this.mode === 'suddenDeath') {
      this.lives--;
      this.updateHUD();
      if (this.lives <= 0) {
        setTimeout(() => this.endGame(), 800);
        return;
      }
    }

    setTimeout(() => this.resetBallPosition(), 1000);
  }

  endGame() {
    this.state = 'GAMEOVER';
    clearInterval(this.timerInterval);
    soundEngine.playBuzzer();

    const isNewHigh = this.score > (this.highScores[this.mode] || 0);
    if (isNewHigh) {
      this.highScores[this.mode] = this.score;
      localStorage.setItem('dunk_high_scores', JSON.stringify(this.highScores));
    }

    document.getElementById('highScoreBanner').classList.toggle('hidden', !isNewHigh);
    document.getElementById('finalScoreVal').textContent = this.score;
    document.getElementById('statShotsMade').textContent = `${this.shotsMade} / ${this.shotsTaken}`;
    document.getElementById('statSwishes').textContent = this.swishes;

    const acc = this.shotsTaken > 0 ? Math.round((this.shotsMade / this.shotsTaken) * 100) : 0;
    document.getElementById('statAccuracy').textContent = `${acc}%`;
    document.getElementById('statMaxStreak').textContent = `${this.maxStreak}🔥`;

    const earnedCoins = Math.floor(this.score / 2);
    document.getElementById('earnedCoinsVal').textContent = earnedCoins;

    this.updateHUD();
    this.showModal('gameOverModal');
  }

  updateHUD() {
    document.getElementById('hudScore').textContent = this.score;
    document.getElementById('hudCoins').textContent = this.coins;
    document.getElementById('shopCoinsVal').textContent = this.coins;

    // Time vs Lives HUD
    const timeBox = document.getElementById('hudTimeBox');
    if (this.mode === 'suddenDeath') {
      timeBox.innerHTML = `❤️ <span id="hudTime">${this.lives} LIVES</span>`;
    } else {
      timeBox.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span id="hudTime">${this.timer}s</span>`;
    }

    // Combo Streak Badge
    const comboHud = document.getElementById('hudCombo');
    if (this.streak >= 2) {
      comboHud.classList.remove('hidden');
      const mult = Math.min(Math.floor(this.streak / 2) + 1, 4);
      document.getElementById('hudComboText').textContent = `x${mult} STREAK (${this.streak}🔥)`;
    } else {
      comboHud.classList.add('hidden');
    }

    // Update Mode High Scores on Menu
    document.getElementById('bestArcade').textContent = this.highScores.arcade || 0;
    document.getElementById('bestSudden').textContent = this.highScores.suddenDeath || 0;
    document.getElementById('bestMoving').textContent = this.highScores.movingHoop || 0;
    document.getElementById('bestTrick').textContent = this.highScores.trickShot || 0;
  }

  // --- PARTICLES & TOAST SYSTEM ---
  createToast(x, y, text, color = '#fff') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'score-toast';
    toast.style.left = `${x}px`;
    toast.style.top = `${y}px`;
    toast.style.color = color;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
  }

  spawnParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        life: 1.0
      });
    }
  }

  // --- RENDER LOOP ---
  loop(timestamp) {
    this.updatePhysics();
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  updatePhysics() {
    if (this.state === 'PLAYING') {
      if (this.ball.isShot) {
        this.physics.stepBall(this.ball, soundEngine);

        // Check if shot finished (ball fell off screen)
        if (this.ball.y > window.innerHeight + 50 && !this.ball.hasScored) {
          this.ball.isShot = false;
          this.onShotMissed();
        } else if (this.ball.hasScored && !this.ball.processedScore) {
          this.ball.processedScore = true;
          this.onShotScored();
        }
      }

      // Moving hoop animation
      if (this.mode === 'movingHoop') {
        this.hoopMoveAngle += 0.03;
        const autoY = Math.sin(this.hoopMoveAngle) * 35;
        this.physics.updateHoopPosition(window.innerWidth, window.innerHeight, this.hoopOffsetX, this.hoopOffsetY + autoY);
      }
    }

    // Particle update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);

    // 1. Draw Court Background
    this.drawCourtBackground(w, h);

    // 2. Draw Hoop (Backboard & Rim back)
    this.drawHoop(w, h);

    // 3. Draw Trajectory Line when Dragging
    if (this.isDragging) {
      this.drawTrajectory();
    }

    // 4. Draw Basketball
    this.drawBall();

    // 5. Draw Net Front & Particles
    this.drawNetFront();
    this.drawParticles();
  }

  drawCourtBackground(w, h) {
    const theme = this.courtThemes.find(t => t.id === this.equippedCourt) || this.courtThemes[0];
    const grad = this.ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, theme.bg1);
    grad.addColorStop(1, theme.bg2);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Court Floor Line & Stadium Lights Accent
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, h - 20);
    this.ctx.lineTo(w, h - 20);
    this.ctx.stroke();

    // Key Area Circle
    this.ctx.beginPath();
    this.ctx.arc(w * 0.75, h - 20, 180, Math.PI, 0);
    this.ctx.stroke();
  }

  drawHoop(w, h) {
    const hoop = this.physics.hoop;

    // Backboard Glass
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = 4;
    this.ctx.fillRect(hoop.backboardX, hoop.backboardY, hoop.backboardWidth, hoop.backboardHeight);
    this.ctx.strokeRect(hoop.backboardX, hoop.backboardY, hoop.backboardWidth, hoop.backboardHeight);

    // Inner Backboard Square
    this.ctx.strokeStyle = '#ff6b00';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(hoop.backboardX, hoop.backboardY + 35, hoop.backboardWidth, 50);

    // Rim Metallic Structure
    this.ctx.strokeStyle = '#ff3d00';
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(hoop.leftPin.x, hoop.y);
    this.ctx.lineTo(hoop.rightPin.x, hoop.y);
    this.ctx.stroke();

    // Rim Pins
    this.ctx.fillStyle = '#ff6b00';
    this.ctx.beginPath();
    this.ctx.arc(hoop.leftPin.x, hoop.leftPin.y, 5, 0, Math.PI * 2);
    this.ctx.arc(hoop.rightPin.x, hoop.rightPin.y, 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawNetFront() {
    const hoop = this.physics.hoop;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 1.5;

    const topL = hoop.leftPin.x;
    const topR = hoop.rightPin.x;
    const botL = hoop.leftPin.x + 12;
    const botR = hoop.rightPin.x - 12;
    const netY = hoop.y + 45;

    // Net Criss-Cross Threads
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const xTop = topL + (topR - topL) * t;
      const xBot = botL + (botR - botL) * t;

      this.ctx.beginPath();
      this.ctx.moveTo(xTop, hoop.y);
      this.ctx.lineTo(xBot, netY);
      this.ctx.stroke();
    }
  }

  drawTrajectory() {
    const dots = this.physics.calculateTrajectory(this.ball, this.launchVelocity, 25);
    this.ctx.fillStyle = '#00f2fe';
    dots.forEach((dot, index) => {
      this.ctx.beginPath();
      this.ctx.arc(dot.x, dot.y, Math.max(5 - index * 0.15, 1.5), 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawBall() {
    this.ctx.save();
    this.ctx.translate(this.ball.x, this.ball.y);
    this.ctx.rotate(this.ball.rotation);

    const skin = this.ballSkins.find(s => s.id === this.equippedBall) || this.ballSkins[0];
    const r = this.ball.radius;

    // Ball Base Shadow / Glow
    if (skin.id === 'fire' || skin.id === 'plasma') {
      this.ctx.shadowColor = skin.color;
      this.ctx.shadowBlur = 20;
    }

    // Ball Circle
    const grad = this.ctx.createRadialGradient(-r / 3, -r / 3, 2, 0, 0, r);
    grad.addColorStop(0, skin.color);
    grad.addColorStop(1, '#000');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fill();

    // Seams
    this.ctx.strokeStyle = skin.seam;
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(-r, 0);
    this.ctx.lineTo(r, 0);
    this.ctx.moveTo(0, -r);
    this.ctx.lineTo(0, r);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;
  }

  // --- SHOP & UNLOCKS SYSTEM ---
  renderShop() {
    const ballsGrid = document.getElementById('ballSkinsGrid');
    const courtsGrid = document.getElementById('courtThemesGrid');
    ballsGrid.innerHTML = '';
    courtsGrid.innerHTML = '';

    // Render Ball Skins
    this.ballSkins.forEach(skin => {
      const isUnlocked = this.unlockedBalls.includes(skin.id);
      const isEquipped = this.equippedBall === skin.id;

      const card = document.createElement('div');
      card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
      card.innerHTML = `
        <div class="item-preview" style="background:${skin.color}; border: 3px solid ${skin.seam}">🏀</div>
        <div class="item-name">${skin.name}</div>
        <div class="item-price">${isUnlocked ? (isEquipped ? 'EQUIPPED' : 'OWNED') : `🪙 ${skin.price}`}</div>
        <button class="btn btn-secondary btn-sm">${isUnlocked ? (isEquipped ? 'USE' : 'EQUIP') : 'BUY'}</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        if (isUnlocked) {
          this.equippedBall = skin.id;
          localStorage.setItem('dunk_ball_skin', skin.id);
        } else if (this.coins >= skin.price) {
          this.coins -= skin.price;
          this.unlockedBalls.push(skin.id);
          this.equippedBall = skin.id;
          localStorage.setItem('dunk_coins', this.coins);
          localStorage.setItem('dunk_unlocked_balls', JSON.stringify(this.unlockedBalls));
          localStorage.setItem('dunk_ball_skin', skin.id);
        } else {
          alert('Not enough coins!');
        }
        this.updateHUD();
        this.renderShop();
      });
      ballsGrid.appendChild(card);
    });

    // Render Court Themes
    this.courtThemes.forEach(court => {
      const isUnlocked = this.unlockedCourts.includes(court.id);
      const isEquipped = this.equippedCourt === court.id;

      const card = document.createElement('div');
      card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
      card.innerHTML = `
        <div class="item-preview" style="background:linear-gradient(135deg, ${court.bg1}, ${court.bg2})">🏟️</div>
        <div class="item-name">${court.name}</div>
        <div class="item-price">${isUnlocked ? (isEquipped ? 'EQUIPPED' : 'OWNED') : `🪙 ${court.price}`}</div>
        <button class="btn btn-secondary btn-sm">${isUnlocked ? (isEquipped ? 'USE' : 'EQUIP') : 'BUY'}</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        if (isUnlocked) {
          this.equippedCourt = court.id;
          localStorage.setItem('dunk_court_theme', court.id);
        } else if (this.coins >= court.price) {
          this.coins -= court.price;
          this.unlockedCourts.push(court.id);
          this.equippedCourt = court.id;
          localStorage.setItem('dunk_coins', this.coins);
          localStorage.setItem('dunk_unlocked_courts', JSON.stringify(this.unlockedCourts));
          localStorage.setItem('dunk_court_theme', court.id);
        } else {
          alert('Not enough coins!');
        }
        this.updateHUD();
        this.renderShop();
      });
      courtsGrid.appendChild(card);
    });
  }

  // --- ACHIEVEMENTS SYSTEM ---
  loadAchievements() {
    const saved = JSON.parse(localStorage.getItem('dunk_achievements')) || [];
    this.achievements.forEach(a => {
      if (saved.includes(a.id)) a.unlocked = true;
    });
  }

  checkAchievements() {
    let changed = false;
    this.achievements.forEach(a => {
      if (!a.unlocked) {
        if (a.id === 'first_basket' && this.shotsMade >= 1) a.unlocked = true;
        if (a.id === 'swish_master' && this.swishes >= 5) a.unlocked = true;
        if (a.id === 'on_fire' && this.maxStreak >= 5) a.unlocked = true;
        if (a.id === 'century' && this.score >= 100) a.unlocked = true;
        if (a.id === 'rich' && this.coins >= 100) a.unlocked = true;

        if (a.unlocked) {
          changed = true;
          this.createToast(window.innerWidth / 2, 100, `🏆 UNLOCKED: ${a.title}!`, '#ffb700');
        }
      }
    });

    if (changed) {
      const unlockedIds = this.achievements.filter(a => a.unlocked).map(a => a.id);
      localStorage.setItem('dunk_achievements', JSON.stringify(unlockedIds));
      this.renderAchievements();
    }
  }

  renderAchievements() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';
    this.achievements.forEach(a => {
      const card = document.createElement('div');
      card.className = `achievement-card ${a.unlocked ? 'unlocked' : ''}`;
      card.innerHTML = `
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-info">
          <h4>${a.title} ${a.unlocked ? '✅' : ''}</h4>
          <p>${a.desc}</p>
        </div>
      `;
      list.appendChild(card);
    });
  }
}

// Instantiate Game on Page Load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
