/**
 * SANDERVERSE UNITE — Vanilla HTML5 Canvas
 */
(function () {
  "use strict";

  const WORLD_WIDTH = 2800;
  const WORLD_HEIGHT = 1600;
  const JOY_RADIUS = 45;
  const MATCH_SECONDS = 300;
  const TILE = 80;

  const SANDER_STATES = {
    IDLE: [0, 3, 15],
    WALK: [1, 2, 4, 7],
    ATTACK: [6],
    CHANNEL: [5, 12],
    DASH: [8, 9, 11],
    FRENZY: [10]
  };
  const LUPE_STATES = {
    IDLE: [0, 1],
    WALK: [1, 2, 4, 5],
    ATTACK: [6, 7],
    CHANNEL: [8, 10],
    DASH: [9, 11],
    FRENZY: [12, 14]
  };

  const HEROES = {
    sander: {
      id: "sander",
      name: "SANDER",
      sheet: "sheet_sander",
      portrait: "sander",
      color: "#00f2fe",
      states: SANDER_STATES,
      skills: { q: "Tornados", w: "Diamante", e: "Resplandor" }
    },
    cristian: {
      id: "cristian",
      name: "CRISTIAN",
      sheet: "sheet_cristian",
      portrait: "cristian",
      color: "#3b82f6",
      states: LUPE_STATES,
      skills: { q: "Lança", w: "Asas", e: "Impacto" }
    }
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const minimapCanvas = document.getElementById("minimapCanvas");
  const minimapCtx = minimapCanvas.getContext("2d");

  const el = {
    overlay: document.getElementById("start-overlay"),
    select: document.getElementById("select-overlay"),
    endOverlay: document.getElementById("end-overlay"),
    endTitle: document.getElementById("end-title"),
    endResult: document.getElementById("end-result"),
    endHeroImg: document.getElementById("end-hero-img"),
    endHeroName: document.getElementById("end-hero-name"),
    endScoreP: document.getElementById("end-score-player"),
    endScoreE: document.getElementById("end-score-enemy"),
    endDiff: document.getElementById("end-diff"),
    barP: document.getElementById("bar-player"),
    barE: document.getElementById("bar-enemy"),
    btnStart: document.getElementById("btn-start"),
    btnConfirm: document.getElementById("btn-confirm-hero"),
    btnRestart: document.getElementById("btn-restart"),
    scorePlayer: document.getElementById("score-player"),
    scoreEnemy: document.getElementById("score-enemy"),
    timer: document.getElementById("match-timer"),
    auraMul: document.getElementById("aura-multiplier"),
    announcement: document.getElementById("announcement"),
    countdown: document.getElementById("countdown-3d"),
    scoreFx: document.getElementById("score-fx"),
    joyBase: document.getElementById("joystick-base"),
    joyStick: document.getElementById("joystick-stick"),
    btnAttack: document.getElementById("btn-attack"),
    btnFlash: document.getElementById("btn-action-flash"),
    btnScore: document.getElementById("btn-score"),
    btnQ: document.getElementById("btn-skill-q"),
    btnW: document.getElementById("btn-skill-w"),
    btnE: document.getElementById("btn-skill-e"),
    hudFace: document.getElementById("hud-face"),
    hudLabel: document.getElementById("hud-hero-label")
  };

  const walkableLanes = [
    { x1: 220, y1: WORLD_HEIGHT / 2, x2: WORLD_WIDTH - 240, y2: WORLD_HEIGHT / 2 },
    { x1: 300, y1: 280, x2: WORLD_WIDTH - 300, y2: 300 },
    { x1: 300, y1: WORLD_HEIGHT - 280, x2: WORLD_WIDTH - 300, y2: WORLD_HEIGHT - 280 },
    { x1: 820, y1: 280, x2: 820, y2: WORLD_HEIGHT - 280 },
    { x1: WORLD_WIDTH - 820, y1: 280, x2: WORLD_WIDTH - 820, y2: WORLD_HEIGHT - 280 }
  ];

  const scorePath = [
    { x: 260, y: 800 },
    { x: 700, y: 800 },
    { x: 1100, y: 760 },
    { x: 1500, y: 620 },
    { x: 1900, y: 480 },
    { x: 2300, y: 380 },
    { x: 2540, y: 360 }
  ];

  const goals = {
    player: { x: 220, y: WORLD_HEIGHT / 2, r: 110 },
    enemy: { x: WORLD_WIDTH - 260, y: 360, r: 130 }
  };

  const props = [
    { x: 640, y: 430, r: 48, solid: true, kind: "tree" },
    { x: 980, y: 520, r: 42, solid: true, kind: "tree" },
    { x: 1260, y: 390, r: 50, solid: true, kind: "tree" },
    { x: 1580, y: 980, r: 46, solid: true, kind: "tree" },
    { x: 1880, y: 1100, r: 52, solid: true, kind: "tree" },
    { x: 720, y: 1180, r: 44, solid: true, kind: "tree" },
    { x: 1120, y: 1280, r: 40, solid: true, kind: "tree" },
    { x: 2100, y: 700, r: 48, solid: true, kind: "tree" },
    { x: 980, y: 220, r: 90, solid: true, kind: "building" },
    { x: 1680, y: 200, r: 80, solid: true, kind: "building" },
    { x: 1480, y: 860, r: 70, solid: false, kind: "pond" }
  ];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.lastBeat = -1;
    }
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    playTone(freq, type, duration, vol, when) {
      if (!this.ctx) return;
      const t = (when || 0) + this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol || 0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    }
    auraEnergy() {
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i++) {
        this.playTone(notes[i], "sine", 0.28, 0.16, i * 0.11);
        this.playTone(notes[i] * 2, "triangle", 0.18, 0.06, i * 0.11);
      }
      this.playTone(196, "sawtooth", 0.45, 0.05, 0);
    }
    attack() { this.playTone(420, "triangle", 0.12, 0.18); }
    hit() { this.playTone(180, "sawtooth", 0.08, 0.12); }
    collect() { this.playTone(880, "sine", 0.14, 0.16); this.playTone(1320, "sine", 0.1, 0.08); }
    skill(freq) { this.playTone(freq, "square", 0.16, 0.14); }
    dash() { this.playTone(240, "sawtooth", 0.1, 0.12); }
    heartbeat() {
      this.playTone(80, "sine", 0.1, 0.28);
      const self = this;
      setTimeout(function () { self.playTone(58, "sine", 0.16, 0.22); }, 140);
    }
  }

  class AssetLoader {
    constructor() {
      this.images = {};
      this.manifest = [
        ["logo_banner", "assets/logo_banner.png"],
        ["map_arena", "assets/map_arena.png"],
        ["sander", "assets/sander.png"],
        ["sheet_sander", "assets/sheet_sander.png"],
        ["polo", "assets/calopsita_polo.png"],
        ["sheet_polo", "assets/sheet_sanderai.png"],
        ["lupe", "assets/calopsita_lupe.png"],
        ["cristian", "assets/cristian.png"],
        ["sheet_cristian", "assets/sheet_cristian.png"],
        ["sheet_lupe", "assets/sheet_lupe.png"],
        ["topete", "assets/calopsita_topete.png"],
        ["sheet_topete", "assets/sheet_topete.png"],
        ["aura", "assets/aura_energy.png"],
        ["mini_logo", "assets/mini_logo.png"]
      ];
    }
    loadAll() {
      const self = this;
      this.manifest.forEach(function (item) {
        const img = new Image();
        img.onload = function () { self.images[item[0]] = img; };
        img.onerror = function () { self.images[item[0]] = null; };
        img.src = item[1];
      });
    }
    get(id) { return this.images[id] || null; }
  }

  class MapBuffer {
    constructor() {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.ready = false;
      this.sourceId = null;
    }
    rebuild(img) {
      const cols = Math.ceil(WORLD_WIDTH / TILE);
      const rows = Math.ceil(WORLD_HEIGHT / TILE);
      this.canvas.width = WORLD_WIDTH;
      this.canvas.height = WORLD_HEIGHT;
      const g = this.ctx;
      g.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      if (img) {
        g.drawImage(img, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      } else {
        g.fillStyle = "#070814";
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if ((x + y) % 2 === 0) {
              g.fillStyle = "rgba(0,242,254,0.03)";
              g.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
          }
        }
        g.strokeStyle = "rgba(0,242,254,0.2)";
        g.lineWidth = 46;
        g.lineCap = "round";
        walkableLanes.forEach(function (l) {
          g.beginPath();
          g.moveTo(l.x1, l.y1);
          g.lineTo(l.x2, l.y2);
          g.stroke();
        });
      }
      g.strokeStyle = "rgba(255,215,0,0.35)";
      g.lineWidth = 18;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(scorePath[0].x, scorePath[0].y);
      for (let i = 1; i < scorePath.length; i++) g.lineTo(scorePath[i].x, scorePath[i].y);
      g.stroke();
      this.ready = true;
    }
    draw(target, camX, camY, vw, vh) {
      if (!this.ready) return;
      target.drawImage(this.canvas, camX, camY, vw, vh, 0, 0, vw, vh);
    }
  }

  function drawSheetFrame(context, img, frameNum, cols, rows, dx, dy, dw, dh, flipX) {
    if (!img) return false;
    const fw = img.width / cols;
    const fh = img.height / rows;
    const col = frameNum % cols;
    const row = Math.floor(frameNum / cols);
    context.save();
    context.translate(dx + dw / 2, dy + dh / 2);
    if (flipX) context.scale(-1, 1);
    context.drawImage(img, col * fw, row * fh, fw, fh, -dw / 2, -dh / 2, dw, dh);
    context.restore();
    return true;
  }

  function distPointSeg(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  }

  function onScorePath(x, y, thresh) {
    for (let i = 0; i < scorePath.length - 1; i++) {
      const a = scorePath[i], b = scorePath[i + 1];
      if (distPointSeg(x, y, a.x, a.y, b.x, b.y) <= thresh) return true;
    }
    return false;
  }

  function inGoal(x, y) {
    return Math.hypot(x - goals.enemy.x, y - goals.enemy.y) < goals.enemy.r + 16;
  }

  function resolveSolids(ent) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (!p.solid) continue;
      const dx = ent.x - p.x, dy = ent.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = ent.radius + p.r * 0.72;
      if (d < min) {
        ent.x = p.x + dx / d * min;
        ent.y = p.y + dy / d * min;
      }
    }
  }

  class Particle {
    constructor() { this.alive = false; }
    spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay) {
      this.alive = true;
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life;
      this.size = size; this.color = color;
      this.shape = shape || "circle";
      this.gravity = gravity || 0;
      this.drag = drag == null ? 0.985 : drag;
      this.decay = decay == null ? 1 : decay;
      this.rot = Math.random() * Math.PI * 2;
      this.spin = (Math.random() - 0.5) * 8;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      this.vx *= this.drag;
      this.vy = this.vy * this.drag + this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
      this.size *= this.decay;
    }
    render(context, camX, camY) {
      const t = this.life / this.maxLife;
      const sx = this.x - camX, sy = this.y - camY;
      const r = Math.max(0.4, this.size * (0.45 + t * 0.55));
      context.globalAlpha = Math.max(0, t);
      context.fillStyle = this.color;
      context.strokeStyle = this.color;
      if (this.shape === "spark") {
        context.lineWidth = Math.max(1, r * 0.35);
        context.beginPath();
        context.moveTo(sx - Math.cos(this.rot) * r * 2, sy - Math.sin(this.rot) * r * 2);
        context.lineTo(sx + Math.cos(this.rot) * r * 2, sy + Math.sin(this.rot) * r * 2);
        context.stroke();
      } else if (this.shape === "star") {
        context.beginPath();
        context.moveTo(sx, sy - r);
        context.lineTo(sx + r * 0.35, sy - r * 0.2);
        context.lineTo(sx + r, sy);
        context.lineTo(sx + r * 0.35, sy + r * 0.2);
        context.lineTo(sx, sy + r);
        context.lineTo(sx - r * 0.35, sy + r * 0.2);
        context.lineTo(sx - r, sy);
        context.lineTo(sx - r * 0.35, sy - r * 0.2);
        context.closePath();
        context.fill();
      } else if (this.shape === "ring") {
        context.lineWidth = 2;
        context.beginPath();
        context.arc(sx, sy, r, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(sx, sy, r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  class ParticleSystem {
    constructor(limit) {
      this.limit = limit || 460;
      this.pool = [];
      for (let i = 0; i < this.limit; i++) this.pool.push(new Particle());
      this.emitAcc = 0;
    }
    clear() { for (let i = 0; i < this.pool.length; i++) this.pool[i].alive = false; }
    spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay) {
      for (let i = 0; i < this.pool.length; i++) {
        if (!this.pool[i].alive) {
          this.pool[i].spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay);
          return;
        }
      }
      this.pool[0].spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay);
    }
    burst(x, y, opts) {
      const n = opts.count || 12;
      const colors = opts.colors || ["#00f2fe"];
      const spread = opts.spread == null ? Math.PI * 2 : opts.spread;
      const angle = opts.angle || 0;
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const s = (opts.speed || 180) * (0.35 + Math.random() * 0.75);
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
          (opts.life || 0.45) * (0.6 + Math.random() * 0.6),
          (opts.size || 3.5) * (0.6 + Math.random() * 0.8),
          colors[i % colors.length], opts.shape || "circle",
          opts.gravity || 0, opts.drag, opts.decay);
      }
    }
    ring(x, y, color, radius) {
      for (let i = 0; i < 18; i++) {
        const a = (Math.PI * 2 * i) / 18;
        this.spawn(x, y, Math.cos(a) * 220, Math.sin(a) * 220, 0.4, 4, color, "spark", 0, 0.96, 0.98);
      }
      this.spawn(x, y, 0, 0, 0.35, radius || 28, color, "ring", 0, 1, 1.08);
    }
    trail(x, y, vx, vy, color) {
      this.spawn(x, y, -vx * 0.15, -vy * 0.15, 0.26, 3, color, "circle", 0, 0.9, 0.94);
    }
    update(dt) { for (let i = 0; i < this.pool.length; i++) if (this.pool[i].alive) this.pool[i].update(dt); }
    render(context, camX, camY) {
      context.save();
      context.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.pool.length; i++) if (this.pool[i].alive) this.pool[i].render(context, camX, camY);
      context.restore();
    }
  }

  class Projectile {
    constructor(x, y, vx, vy, kind, dmg, life) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind; this.dmg = dmg; this.life = life; this.dead = false;
      this.r = kind === "tornado" ? 22 : 10;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const color = this.kind === "tornado" ? "#7af6ff" : this.kind === "diamond" ? "#ffe566" : "#00f2fe";
      fx.trail(this.x, this.y, this.vx, this.vy, color);
    }
    render(context, camX, camY) {
      const sx = this.x - camX, sy = this.y - camY;
      context.save();
      if (this.kind === "bolt") {
        context.strokeStyle = "#00f2fe";
        context.shadowColor = "#00f2fe";
        context.shadowBlur = 12;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(sx - this.vx * 0.04, sy - this.vy * 0.04);
        context.stroke();
      } else if (this.kind === "tornado") {
        context.strokeStyle = "rgba(0,242,254,0.85)";
        context.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          context.beginPath();
          context.ellipse(sx, sy, 10 + i * 7, 16 + i * 4, performance.now() / 180 + i, 0, Math.PI * 2);
          context.stroke();
        }
      } else {
        context.fillStyle = "rgba(0,242,254,0.35)";
        context.strokeStyle = "#00f2fe";
        context.beginPath();
        context.moveTo(sx, sy - 16);
        context.lineTo(sx + 12, sy);
        context.lineTo(sx, sy + 16);
        context.lineTo(sx - 12, sy);
        context.closePath();
        context.fill();
        context.stroke();
      }
      context.restore();
    }
  }

  class EnergyItem {
    constructor(x, y, kind) {
      this.x = x; this.y = y; this.kind = kind || "aura";
      this.radius = 18; this.floatTimer = Math.random() * 8;
    }
    update(dt) { this.floatTimer += dt * 3; }
    render(context, camX, camY) {
      const sx = this.x - camX;
      const sy = this.y - camY + Math.sin(this.floatTimer) * 6;
      const img = assets.get(this.kind === "aura" ? "aura" : "mini_logo");
      if (img) context.drawImage(img, sx - 18, sy - 18, 36, 36);
      else {
        context.beginPath();
        context.arc(sx, sy, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.kind === "aura" ? "#ffd700" : "#00f2fe";
        context.fill();
      }
    }
  }

  class SanderPlayer {
    constructor(x, y, hero) {
      this.hero = hero || HEROES.sander;
      this.x = x; this.y = y; this.radius = 28;
      this.baseSpeed = 240; this.speed = 240;
      this.hp = 1200; this.maxHp = 1200;
      this.auraCount = 0; this.vx = 0; this.vy = 0;
      this.state = "IDLE"; this.facingLeft = false;
      this.frameIndex = 0; this.timer = 0; this.frameInterval = 0.12;
      this.isAttacking = false; this.attackTimer = 0;
      this.isChanneling = false; this.channelTimer = 0;
      this.isDashing = false; this.dashTimer = 0;
      this.invuln = 0;
    }
    buff() { return 1 + this.auraCount * 0.03; }
    update(dt) {
      this.speed = this.baseSpeed * this.buff();
      if (this.invuln > 0) this.invuln -= dt;
      if (this.attackTimer > 0) { this.attackTimer -= dt; if (this.attackTimer <= 0) this.isAttacking = false; }
      if (this.dashTimer > 0) { this.dashTimer -= dt; if (this.dashTimer <= 0) this.isDashing = false; }
      if (this.channelTimer > 0) { this.channelTimer -= dt; if (this.channelTimer <= 0) this.isChanneling = false; }
      if (this.vx < -0.08) this.facingLeft = true;
      if (this.vx > 0.08) this.facingLeft = false;
      if (this.isDashing) this.state = "DASH";
      else if (this.isAttacking) this.state = "ATTACK";
      else if (this.isChanneling) this.state = "CHANNEL";
      else if (state.climax && Math.hypot(this.vx, this.vy) < 0.1) this.state = "FRENZY";
      else if (Math.hypot(this.vx, this.vy) > 0.1) this.state = "WALK";
      else this.state = "IDLE";
      if (!this.isChanneling) {
        const dashMul = this.isDashing ? 2.4 : 1;
        this.x += this.vx * this.speed * dashMul * dt;
        this.y += this.vy * this.speed * dashMul * dt;
        this.x = Math.max(this.radius, Math.min(WORLD_WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(WORLD_HEIGHT - this.radius, this.y));
        resolveSolids(this);
      }
      const frames = this.hero.states[this.state] || [0];
      this.timer += dt;
      if (this.timer >= this.frameInterval) {
        this.timer = 0;
        this.frameIndex = (this.frameIndex + 1) % frames.length;
      }
    }
    render(context, camX, camY) {
      const sx = this.x - camX, sy = this.y - camY;
      const frames = this.hero.states[this.state] || [0];
      const frameNum = frames[this.frameIndex % frames.length];
      const img = assets.get(this.hero.sheet);
      const drawn = drawSheetFrame(context, img, frameNum, 4, 4, sx - 40, sy - 58, 80, 112, this.facingLeft);
      if (!drawn) {
        const port = assets.get(this.hero.portrait);
        if (port) context.drawImage(port, sx - 28, sy - 54, 56, 88);
        else {
          context.beginPath();
          context.arc(sx, sy, this.radius, 0, Math.PI * 2);
          context.fillStyle = this.hero.color;
          context.fill();
        }
      }
      context.fillStyle = "rgba(0,0,0,0.55)";
      context.fillRect(sx - 28, sy - 72, 56, 6);
      context.fillStyle = this.hp > 400 ? "#2ecc71" : "#ff0055";
      context.fillRect(sx - 28, sy - 72, Math.max(0, this.hp / this.maxHp) * 56, 6);
      if (this.auraCount > 0) {
        context.fillStyle = "#ffd700";
        context.font = "bold 12px sans-serif";
        context.textAlign = "center";
        context.fillText("⚡" + this.auraCount, sx, sy + 46);
      }
    }
  }

  const AI_WP = [];
  walkableLanes.forEach(function (l) {
    AI_WP.push({ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }, { x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 });
  });

  class EnemyBird {
    constructor(x, y, name, sheetKey, portraitKey, color) {
      this.x = x; this.y = y; this.name = name;
      this.sheetKey = sheetKey; this.portraitKey = portraitKey; this.color = color;
      this.radius = 28; this.hp = 700; this.maxHp = 700;
      this.speed = 118; this.vx = 0; this.vy = 0;
      this.timer = 0; this.frame = 0; this.atkCd = 1 + Math.random();
      this.alive = true; this.respawn = 0; this.homeX = x; this.homeY = y;
      this.facingLeft = false;
      this.mode = "explore";
      this.think = 0.2 + Math.random() * 0.4;
      this.wp = AI_WP[Math.floor(Math.random() * AI_WP.length)];
    }
    pickWp() { this.wp = AI_WP[Math.floor(Math.random() * AI_WP.length)]; }
    decide(player) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      const hpR = this.hp / this.maxHp;
      if (hpR < 0.28) this.mode = "flee";
      else if (dist < 92) this.mode = "attack";
      else if (dist < 430 && hpR > 0.38) this.mode = "chase";
      else this.mode = "explore";
    }
    steerTo(tx, ty, scale) {
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = dx / d * scale;
      this.vy = dy / d * scale;
    }
    update(dt, player) {
      if (!this.alive) {
        this.respawn -= dt;
        if (this.respawn <= 0) {
          this.alive = true; this.hp = this.maxHp;
          this.x = this.homeX; this.y = this.homeY; this.mode = "explore";
        }
        return;
      }
      this.think -= dt;
      if (this.think <= 0) {
        this.think = 0.28 + Math.random() * 0.35;
        this.decide(player);
      }
      const dist = Math.hypot(player.x - this.x, player.y - this.y) || 1;
      if (this.mode === "flee") {
        this.steerTo(this.x - (player.x - this.x), this.y - (player.y - this.y), 1.15);
        if (dist > 520) this.mode = "explore";
      } else if (this.mode === "chase") {
        this.steerTo(player.x, player.y, 1);
        if (dist < 90) { this.vx = 0; this.vy = 0; this.mode = "attack"; }
      } else if (this.mode === "attack") {
        this.vx = 0; this.vy = 0;
        if (dist > 130) this.mode = "chase";
      } else {
        if (!this.wp || Math.hypot(this.wp.x - this.x, this.wp.y - this.y) < 40) this.pickWp();
        this.steerTo(this.wp.x, this.wp.y, 0.55);
      }
      if (this.vx < -0.05) this.facingLeft = true;
      if (this.vx > 0.05) this.facingLeft = false;
      const spd = this.mode === "flee" ? this.speed * 1.25 : this.speed;
      this.x += this.vx * spd * dt;
      this.y += this.vy * spd * dt;
      this.x = Math.max(40, Math.min(WORLD_WIDTH - 40, this.x));
      this.y = Math.max(40, Math.min(WORLD_HEIGHT - 40, this.y));
      resolveSolids(this);
      this.timer += dt;
      if (this.timer >= 0.14) { this.timer = 0; this.frame = (this.frame + 1) % 16; }
      this.atkCd -= dt;
      if (this.mode === "attack" && this.atkCd <= 0 && dist < 100 && player.invuln <= 0) {
        player.hp -= 28;
        player.invuln = 0.35;
        sound.hit();
        this.atkCd = 1.05;
        if (player.hp < 0) player.hp = 0;
        fx.burst(player.x, player.y, { count: 10, speed: 220, life: 0.32, size: 3, colors: ["#ff0055", this.color], shape: "spark" });
      }
    }
    takeHit(dmg) {
      if (!this.alive) return false;
      this.hp -= dmg;
      if (this.hp / this.maxHp < 0.28) this.mode = "flee";
      if (this.hp <= 0) { this.alive = false; this.respawn = 6; return true; }
      return false;
    }
    render(context, camX, camY) {
      if (!this.alive) return;
      const sx = this.x - camX, sy = this.y - camY;
      const sheet = assets.get(this.sheetKey);
      const portrait = assets.get(this.portraitKey);
      let drawn = drawSheetFrame(context, sheet, this.frame, 4, 4, sx - 36, sy - 52, 72, 96, this.facingLeft);
      if (!drawn && portrait) { context.drawImage(portrait, sx - 28, sy - 50, 56, 84); drawn = true; }
      if (!drawn) {
        context.beginPath();
        context.arc(sx, sy, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
      }
      context.fillStyle = "rgba(0,0,0,0.5)";
      context.fillRect(sx - 24, sy - 62, 48, 5);
      context.fillStyle = "#ff3366";
      context.fillRect(sx - 24, sy - 62, Math.max(0, this.hp / this.maxHp) * 48, 5);
      context.fillStyle = "#fff";
      context.font = "10px sans-serif";
      context.textAlign = "center";
      context.fillText(this.name + " · " + this.mode, sx, sy - 68);
    }
  }

  const sound = new SoundEngine();
  const assets = new AssetLoader();
  const mapBuf = new MapBuffer();
  const fx = new ParticleSystem(460);
  assets.loadAll();

  const state = {
    running: false,
    climax: false,
    climaxTriggered: false,
    remainingTime: MATCH_SECONDS,
    playerScore: 0,
    enemyScore: 0,
    lastFrameTime: performance.now(),
    lastHudSecond: MATCH_SECONDS,
    enemyScoreAcc: 0,
    selectedHero: "sander",
    canScore: false
  };

  let player = new SanderPlayer(380, WORLD_HEIGHT / 2, HEROES.sander);
  let enemies = [];
  let droppedEnergies = [];
  let projectiles = [];
  let camera = { x: 0, y: 0 };
  let pointerId = null;
  let joyCenter = { x: 0, y: 0 };
  const keys = Object.create(null);
  const cds = { q: 0, w: 0, e: 0, flash: 0, atk: 0 };
  const cdMax = { q: 6, w: 8, e: 10, flash: 3.6, atk: 0.32 };

  function applyHeroUI(hero) {
    el.hudFace.src = hero.id === "cristian" ? "assets/cristian.png" : "assets/sander.png";
    el.hudLabel.textContent = hero.name;
    el.btnQ.querySelector(".skill-name").textContent = hero.skills.q;
    el.btnW.querySelector(".skill-name").textContent = hero.skills.w;
    el.btnE.querySelector(".skill-name").textContent = hero.skills.e;
  }

  function resetMatch() {
    const hero = HEROES[state.selectedHero] || HEROES.sander;
    state.running = true;
    state.climax = false;
    state.climaxTriggered = false;
    state.remainingTime = MATCH_SECONDS;
    state.playerScore = 0;
    state.enemyScore = 0;
    state.enemyScoreAcc = 0;
    state.lastHudSecond = MATCH_SECONDS;
    state.canScore = false;
    player = new SanderPlayer(380, WORLD_HEIGHT / 2, hero);
    enemies = [
      new EnemyBird(1680, 420, "Polo", "sheet_polo", "polo", "#8fd3ff"),
      new EnemyBird(1980, 820, "Lupe", "sheet_lupe", "lupe", "#f0e6c8"),
      new EnemyBird(1540, 1180, "Topete", "sheet_topete", "topete", "#ff7ad9")
    ];
    
    droppedEnergies = [];
    projectiles = [];
    fx.clear();
    cds.q = cds.w = cds.e = cds.flash = cds.atk = 0;
    el.announcement.classList.add("hidden");
    el.countdown.classList.add("hidden");
    el.endOverlay.classList.add("hidden");
    el.scoreFx.classList.add("hidden");
    el.timer.classList.remove("danger");
    applyHeroUI(hero);
    const mapImg = assets.get("map_arena");
    mapBuf.rebuild(mapImg);
    updateHud(true);
    sound.auraEnergy();
    fx.burst(player.x, player.y, {
      count: 36, speed: 280, life: 0.7, size: 4.2,
      colors: ["#ffd700", "#00f2fe", "#ffffff"], shape: "star", gravity: -40
    });
  }

  function updateHud(force) {
    const sec = Math.max(0, Math.ceil(state.remainingTime));
    if (force || sec !== state.lastHudSecond) {
      state.lastHudSecond = sec;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      el.timer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    }
    el.scorePlayer.textContent = String(state.playerScore);
    el.scoreEnemy.textContent = String(state.enemyScore);
    el.auraMul.textContent = "x" + player.buff().toFixed(2);
    const ready = state.canScore && player.auraCount > 0;
    el.btnScore.disabled = !ready;
    el.btnScore.classList.toggle("ready", ready);
  }

  function setCooldownOverlay(btn, remain, max) {
    const overlay = btn.querySelector(".cooldown-overlay");
    if (!overlay) return;
    overlay.style.height = ((remain <= 0 ? 0 : Math.min(1, remain / max)) * 100) + "%";
  }

  function spawnDrops(x, y) {
    const n = state.climax ? 2 : 1;
    for (let i = 0; i < n; i++) {
      droppedEnergies.push(new EnergyItem(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, Math.random() > 0.45 ? "aura" : "logo"));
    }
    fx.burst(x, y, { count: 20, speed: 250, life: 0.5, size: 4, colors: ["#ffd700", "#e056fd", "#00f2fe"], shape: "star", gravity: 40 });
  }

  function damageEnemiesAt(x, y, radius, dmg) {
    enemies.forEach(function (en) {
      if (!en.alive) return;
      if (Math.hypot(en.x - x, en.y - y) <= radius + en.radius) {
        sound.hit();
        fx.burst(en.x, en.y, { count: 8, speed: 200, life: 0.28, size: 2.8, colors: ["#fff", "#00f2fe"], shape: "spark" });
        if (en.takeHit(dmg)) spawnDrops(en.x, en.y);
      }
    });
  }

  function fireAttack() {
    if (cds.atk > 0 || player.isChanneling) return;
    cds.atk = cdMax.atk;
    player.isAttacking = true;
    player.attackTimer = 0.28;
    sound.attack();
    const dir = player.facingLeft ? -1 : 1;
    projectiles.push(new Projectile(player.x + dir * 30, player.y - 8, dir * 720, 0, "bolt", 210, 0.55));
    fx.burst(player.x + dir * 28, player.y - 8, { count: 10, speed: 260, life: 0.26, size: 3, colors: ["#00f2fe", "#fff"], shape: "spark", angle: dir > 0 ? 0 : Math.PI, spread: 1.1 });
    damageEnemiesAt(player.x + dir * 70, player.y, 70, 160);
  }

  function castQ() {
    if (cds.q > 0 || player.isChanneling) return;
    cds.q = cdMax.q;
    sound.skill(300);
    const dir = player.facingLeft ? -1 : 1;
    for (let i = -1; i <= 1; i++) projectiles.push(new Projectile(player.x, player.y, dir * 380, i * 140, "tornado", 260, 1.4));
    fx.ring(player.x, player.y, "#00f2fe", 36);
  }

  function castW() {
    if (cds.w > 0 || player.isChanneling) return;
    cds.w = cdMax.w;
    sound.skill(620);
    player.invuln = 0.8;
    for (let a = 0; a < 8; a++) {
      const ang = (Math.PI * 2 * a) / 8;
      projectiles.push(new Projectile(player.x, player.y, Math.cos(ang) * 280, Math.sin(ang) * 280, "diamond", 180, 0.7));
    }
    fx.ring(player.x, player.y, "#ffd700", 48);
    damageEnemiesAt(player.x, player.y, 150, 220);
  }

  function castE() {
    if (cds.e > 0 || player.isChanneling) return;
    cds.e = cdMax.e;
    sound.skill(200);
    fx.burst(player.x, player.y, { count: 32, speed: 360, life: 0.65, size: 5, colors: ["#ffd700", "#ff9a3c", "#00f2fe"], shape: "star", gravity: -20 });
    fx.ring(player.x, player.y, "#ffd700", 70);
    damageEnemiesAt(player.x, player.y, 210, 340);
  }

  function doFlash() {
    if (cds.flash > 0) return;
    cds.flash = cdMax.flash;
    player.isDashing = true;
    player.dashTimer = 0.22;
    const hasDir = Math.hypot(player.vx, player.vy) > 0.1;
    const dash = hasDir ? Math.atan2(player.vy, player.vx) : (player.facingLeft ? Math.PI : 0);
    player.x += Math.cos(dash) * 140;
    player.y += Math.sin(dash) * 140;
    player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y));
    sound.dash();
    fx.burst(player.x, player.y, { count: 14, speed: 220, life: 0.3, size: 3, colors: ["#ffd700", "#00f2fe"], shape: "spark", angle: dash + Math.PI, spread: 1.2 });
  }

  function doScore() {
    if (!state.running || player.auraCount <= 0 || !state.canScore) return;
    player.isChanneling = true;
    player.channelTimer = 0.75;
    const pts = player.auraCount * (state.climax ? 2 : 1);
    state.playerScore += pts;
    player.auraCount = 0;
    sound.auraEnergy();
    el.scoreFx.textContent = "+" + pts + " AURA ENERGY";
    el.scoreFx.classList.remove("hidden");
    setTimeout(function () { el.scoreFx.classList.add("hidden"); }, 900);
    fx.burst(player.x, player.y, { count: 48, speed: 320, life: 1.0, size: 5, colors: ["#ffd700", "#c084fc", "#00f2fe", "#fff"], shape: "star", gravity: -90 });
    fx.ring(player.x, player.y, "#ffd700", 90);
    fx.ring(goals.enemy.x, goals.enemy.y, "#c084fc", 110);
    updateHud(true);
  }

  function applyKeyboardMove() {
    if (pointerId !== null) return;
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
    if (keys.ArrowRight || keys.d || keys.D) x += 1;
    if (keys.ArrowUp || keys.w || keys.W) y -= 1;
    if (keys.ArrowDown || keys.s || keys.S) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { player.vx = x / len; player.vy = y / len; }
    else { player.vx = 0; player.vy = 0; }
  }

  function handleJoy(clientX, clientY) {
    const dx = clientX - joyCenter.x, dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const cap = Math.min(dist, JOY_RADIUS);
    el.joyStick.style.transform = "translate(" + (Math.cos(ang) * cap) + "px," + (Math.sin(ang) * cap) + "px)";
    if (cap > 6) { player.vx = Math.cos(ang); player.vy = Math.sin(ang); }
    else { player.vx = 0; player.vy = 0; }
  }

  function resetJoy() {
    pointerId = null;
    player.vx = 0; player.vy = 0;
    el.joyStick.style.transform = "translate(0px,0px)";
  }

  function bindPointer(target, fn) {
    target.addEventListener("pointerdown", function (e) { e.preventDefault(); fn(e); });
  }

  el.joyBase.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    pointerId = e.pointerId;
    try { el.joyBase.setPointerCapture(e.pointerId); } catch (err) {}
    const rect = el.joyBase.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    handleJoy(e.clientX, e.clientY);
  });
  el.joyBase.addEventListener("pointermove", function (e) {
    if (pointerId === e.pointerId) handleJoy(e.clientX, e.clientY);
  });
  function joyUp(e) { if (pointerId === e.pointerId) resetJoy(); }
  el.joyBase.addEventListener("pointerup", joyUp);
  el.joyBase.addEventListener("pointercancel", joyUp);

  bindPointer(el.btnAttack, fireAttack);
  bindPointer(el.btnFlash, doFlash);
  bindPointer(el.btnScore, doScore);
  bindPointer(el.btnQ, castQ);
  bindPointer(el.btnW, castW);
  bindPointer(el.btnE, castE);

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (!state.running) return;
    if (e.key === "q" || e.key === "Q") castQ();
    if (e.key === "e" || e.key === "E") castE();
    if (e.key === " " || e.key === "j" || e.key === "J") { e.preventDefault(); fireAttack(); }
    if (e.key === "f" || e.key === "F" || e.key === "Shift") doFlash();
    if (e.key === "r" || e.key === "R") castW();
    if (e.key === "Enter" || e.key === "p" || e.key === "P") doScore();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });

  document.querySelectorAll(".hero-card").forEach(function (card) {
    card.addEventListener("click", function () {
      document.querySelectorAll(".hero-card").forEach(function (c) { c.classList.remove("selected"); });
      card.classList.add("selected");
      state.selectedHero = card.getAttribute("data-hero");
    });
  });

  function lockScreen() {
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (req) req.call(root).catch(function () {});
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {});
  }

  el.btnStart.addEventListener("click", function () {
    sound.init();
    lockScreen();
    el.overlay.classList.add("hidden");
    el.select.classList.remove("hidden");
  });
  el.btnConfirm.addEventListener("click", function () {
    sound.init();
    el.select.classList.add("hidden");
    resetMatch();
  });
  el.btnRestart.addEventListener("click", function () {
    sound.init();
    el.endOverlay.classList.add("hidden");
    el.select.classList.remove("hidden");
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  ["gesturestart", "gesturechange", "gestureend"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });

  function updateCamera() {
    const vw = window.innerWidth, vh = window.innerHeight;
    camera.x += (player.x - vw / 2 - camera.x) * 0.12;
    camera.y += (player.y - vh / 2 - camera.y) * 0.12;
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - vw, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - vh, camera.y));
    if (WORLD_WIDTH < vw) camera.x = (WORLD_WIDTH - vw) / 2;
    if (WORLD_HEIGHT < vh) camera.y = (WORLD_HEIGHT - vh) / 2;
  }

  function drawWorld() {
    const vw = window.innerWidth, vh = window.innerHeight;
    ctx.clearRect(0, 0, vw, vh);
    if (!mapBuf.ready) {
      const mapImg = assets.get("map_arena");
      if (mapImg) mapBuf.rebuild(mapImg);
    }
    if (mapBuf.ready) mapBuf.draw(ctx, camera.x, camera.y, vw, vh);
    else {
      ctx.fillStyle = "#070814";
      ctx.fillRect(0, 0, vw, vh);
    }
    function portal(goal, colorA, colorB, label) {
      const sx = goal.x - camera.x, sy = goal.y - camera.y;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, goal.r);
      g.addColorStop(0, colorA);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, goal.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colorB;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, sx, sy + goal.r + 16);
    }
    portal(goals.player, "rgba(255,140,0,0.35)", "#ff8c00", "BASE");
    portal(goals.enemy, "rgba(160,80,255,0.45)", "#c084fc", "PONTUAR");
  }

  function drawProp(p, camX, camY) {
    const sx = p.x - camX, sy = p.y - camY;
    if (p.kind === "pond") {
      ctx.fillStyle = "rgba(60,140,200,0.28)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.r * 1.2, p.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (p.kind === "building") {
      ctx.fillStyle = "rgba(20,30,50,0.55)";
      ctx.fillRect(sx - p.r, sy - p.r * 1.2, p.r * 2, p.r * 1.6);
      return;
    }
    ctx.fillStyle = "rgba(16,70,28,0.55)";
    ctx.beginPath();
    ctx.moveTo(sx, sy - p.r * 1.4);
    ctx.lineTo(sx + p.r, sy + p.r * 0.3);
    ctx.lineTo(sx - p.r, sy + p.r * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function renderSorted() {
    const list = [];
    props.forEach(function (p) { list.push({ y: p.y, z: 0, draw: function () { drawProp(p, camera.x, camera.y); } }); });
    droppedEnergies.forEach(function (orb) { list.push({ y: orb.y, z: 1, draw: function () { orb.render(ctx, camera.x, camera.y); } }); });
    projectiles.forEach(function (p) { list.push({ y: p.y, z: 2, draw: function () { p.render(ctx, camera.x, camera.y); } }); });
    enemies.forEach(function (en) { if (en.alive) list.push({ y: en.y, z: 3, draw: function () { en.render(ctx, camera.x, camera.y); } }); });
    list.push({ y: player.y, z: 3, draw: function () { player.render(ctx, camera.x, camera.y); } });
    list.sort(function (a, b) { return a.y === b.y ? a.z - b.z : a.y - b.y; });
    for (let i = 0; i < list.length; i++) list[i].draw();
  }

  function renderMinimap() {
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    const sx = mw / WORLD_WIDTH, sy = mh / WORLD_HEIGHT;
    minimapCtx.clearRect(0, 0, mw, mh);
    minimapCtx.fillStyle = "rgba(6,10,22,0.35)";
    minimapCtx.fillRect(0, 0, mw, mh);
    minimapCtx.strokeStyle = "rgba(255,255,255,0.2)";
    minimapCtx.lineWidth = 3;
    walkableLanes.forEach(function (l) {
      minimapCtx.beginPath();
      minimapCtx.moveTo(l.x1 * sx, l.y1 * sy);
      minimapCtx.lineTo(l.x2 * sx, l.y2 * sy);
      minimapCtx.stroke();
    });
    minimapCtx.strokeStyle = "rgba(255,215,0,0.7)";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(scorePath[0].x * sx, scorePath[0].y * sy);
    for (let i = 1; i < scorePath.length; i++) minimapCtx.lineTo(scorePath[i].x * sx, scorePath[i].y * sy);
    minimapCtx.stroke();
    minimapCtx.strokeStyle = "#c084fc";
    minimapCtx.beginPath();
    minimapCtx.arc(goals.enemy.x * sx, goals.enemy.y * sy, 6, 0, Math.PI * 2);
    minimapCtx.stroke();
    const pulse = 0.45 + Math.sin(performance.now() / 180) * 0.45;
    droppedEnergies.forEach(function (orb) {
      minimapCtx.fillStyle = "rgba(224,86,253," + pulse.toFixed(2) + ")";
      minimapCtx.fillRect(orb.x * sx - 1.5, orb.y * sy - 1.5, 3, 3);
    });
    enemies.forEach(function (en) {
      if (!en.alive) return;
      minimapCtx.beginPath();
      minimapCtx.arc(en.x * sx, en.y * sy, 3, 0, Math.PI * 2);
      minimapCtx.fillStyle = "#ff3366";
      minimapCtx.fill();
    });
    minimapCtx.beginPath();
    minimapCtx.arc(player.x * sx, player.y * sy, 4, 0, Math.PI * 2);
    minimapCtx.fillStyle = "#00f2fe";
    minimapCtx.fill();
  }

  function endMatch() {
    state.running = false;
    const ps = state.playerScore, es = state.enemyScore;
    const hero = player.hero;
    let result = "EMPATE", cls = "draw";
    if (ps > es) { result = "VITÓRIA"; cls = "win"; }
    else if (ps < es) { result = "DERROTA"; cls = "lose"; }
    el.endTitle.textContent = "FIM DE PARTIDA";
    el.endResult.textContent = result;
    el.endResult.className = "end-result " + cls;
    el.endHeroName.textContent = hero.name;
    el.endHeroImg.src = hero.id === "cristian" ? "assets/cristian.png" : "assets/sander.png";
    el.endScoreP.textContent = String(ps);
    el.endScoreE.textContent = String(es);
    const max = Math.max(ps, es, 1);
    el.barP.style.width = Math.round(ps / max * 100) + "%";
    el.barE.style.width = Math.round(es / max * 100) + "%";
    const diff = ps - es;
    el.endDiff.textContent = diff === 0 ? "Empate técnico" : (diff > 0 ? "Vantagem +" + diff : "Desvantagem " + diff);
    el.endOverlay.classList.remove("hidden");
    el.announcement.classList.add("hidden");
    el.countdown.classList.add("hidden");
  }

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - state.lastFrameTime) / 1000);
    state.lastFrameTime = now;

    if (state.running) {
      state.remainingTime -= dt;
      applyKeyboardMove();

      if (state.remainingTime <= 120 && !state.climaxTriggered) {
        state.climax = true;
        state.climaxTriggered = true;
        el.announcement.textContent = "FRENESÍ DE ENERGIA";
        el.announcement.classList.remove("hidden");
        sound.skill(150);
        fx.burst(player.x, player.y, { count: 40, speed: 400, life: 0.75, size: 5, colors: ["#ffd700", "#ff0055", "#00f2fe"], shape: "star" });
      }
      if (state.remainingTime <= 10 && state.remainingTime > 0) {
        const n = Math.ceil(state.remainingTime);
        el.countdown.textContent = String(n);
        el.countdown.classList.remove("hidden");
        el.timer.classList.add("danger");
        if (n !== sound.lastBeat) { sound.lastBeat = n; sound.heartbeat(); fx.ring(player.x, player.y, "#ff0055", 40); }
      } else el.countdown.classList.add("hidden");

      ["q", "w", "e", "flash", "atk"].forEach(function (k) { if (cds[k] > 0) cds[k] = Math.max(0, cds[k] - dt); });
      setCooldownOverlay(el.btnQ, cds.q, cdMax.q);
      setCooldownOverlay(el.btnW, cds.w, cdMax.w);
      setCooldownOverlay(el.btnE, cds.e, cdMax.e);

      player.update(dt);
      state.canScore = inGoal(player.x, player.y);
      enemies.forEach(function (en) { en.update(dt, player); });
      projectiles.forEach(function (p) {
        p.update(dt);
        enemies.forEach(function (en) {
          if (!en.alive || p.dead || p.dmg <= 0) return;
          if (Math.hypot(en.x - p.x, en.y - p.y) < en.radius + p.r) {
            p.dead = true; sound.hit();
            fx.burst(en.x, en.y, { count: 12, speed: 240, life: 0.3, size: 3.2, colors: ["#fff", "#00f2fe"], shape: "spark" });
            if (en.takeHit(p.dmg)) spawnDrops(en.x, en.y);
          }
        });
      });
      projectiles = projectiles.filter(function (p) { return !p.dead; });
      droppedEnergies.forEach(function (orb) { orb.update(dt); });
      droppedEnergies = droppedEnergies.filter(function (orb) {
        if (Math.hypot(orb.x - player.x, orb.y - player.y) < player.radius + orb.radius) {
          player.auraCount += 1; sound.collect();
          fx.burst(orb.x, orb.y, { count: 12, speed: 150, life: 0.4, size: 3, colors: ["#ffd700", "#00f2fe"], shape: "star", gravity: -50 });
          return false;
        }
        return true;
      });

      if (player.auraCount > 0 || state.climax) {
        fx.emitAcc += dt;
        if (fx.emitAcc > 0.05) {
          fx.emitAcc = 0;
          fx.spawn(player.x + (Math.random() - 0.5) * 24, player.y + 10, 0, -50, 0.4, state.climax ? 3.2 : 2.1, state.climax ? "#ffd700" : "#00f2fe", "circle", -20, 0.96, 0.96);
        }
      }
      if (player.isDashing) fx.trail(player.x, player.y, player.vx * 400, player.vy * 400, "#ffd700");
      fx.update(dt);

      if (player.hp <= 0) {
        fx.burst(player.x, player.y, { count: 24, speed: 280, life: 0.5, size: 4, colors: ["#ff0055", "#00f2fe"], shape: "spark" });
        player.hp = player.maxHp;
        player.x = goals.player.x + 40;
        player.y = goals.player.y;
        player.auraCount = Math.max(0, player.auraCount - 2);
        player.invuln = 1.4;
      }

      state.enemyScoreAcc += dt * (state.climax ? 0.22 : 0.1);
      if (state.enemyScoreAcc >= 1) {
        state.enemyScore += Math.floor(state.enemyScoreAcc);
        state.enemyScoreAcc -= Math.floor(state.enemyScoreAcc);
      }

      updateCamera();
      updateHud(false);
      if (state.remainingTime <= 0) { state.remainingTime = 0; updateHud(true); endMatch(); }
    } else {
      updateCamera();
      fx.update(dt);
    }

    drawWorld();
    renderSorted();
    fx.render(ctx, camera.x, camera.y);
    renderMinimap();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
