(() => {
"use strict";

/* =========================================================
   SANDER UNITED ARENA
   MOVIMENTO LIVRE + IA + FUGA + PERSEGUIÇÃO + COMBATE
   ========================================================= */

const $ = id => document.getElementById(id);

const canvas = $("game");
const ctx = canvas.getContext("2d");

const mini = $("minimap");
const mctx = mini.getContext("2d");


/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const CFG = {
  speed: 245,
  enemySpeed: 190,

  time: 180,

  maxEnergy: 1000,

  teleportCooldown: 30,

  attackRange: 86,
  specialRange: 235,

  pickupRange: 34,

  gemCount: 24,

  gemRespawnMin: 0.45,
  gemRespawnMax: 1.35,

  playerAttackCooldown: 0.34,
  enemyAttackCooldown: 0.90,

  specialCooldown: 4.2,
  enemySpecialCooldown: 4.8,

  moveStep: 9,

  cameraSmooth: 8
};


/* =========================================================
   DIFICULDADES
   ========================================================= */

const DIFF = {

  easy: {
    hp: 900,
    damage: .72,
    speed: .88,
    brain: .72
  },

  normal: {
    hp: 1100,
    damage: 1,
    speed: 1,
    brain: 1
  },

  hard: {
    hp: 1350,
    damage: 1.28,
    speed: 1.12,
    brain: 1.32
  }

};


/* =========================================================
   ESTADO GERAL
   ========================================================= */

let W = innerWidth;
let H = innerHeight;

let dpr = 1;

let game = false;
let paused = false;
let muted = false;

let elapsed = 0;
let last = 0;

let choice = "normal";

let msgT = 0;

let camera = {
  x: 0,
  y: 0
};

let keys = new Set();

let audio = null;

let MAP = {
  w: 1536,
  h: 952
};

let mapOK = false;
let sanderOK = false;
let nemesisOK = false;

let mapCanvas = null;
let mapData = null;

let roadMini = null;

let energy = [];
let parts = [];
let texts = [];

let shake = 0;


/* =========================================================
   IMAGENS
   ========================================================= */

const imgs = {

  map: new Image(),

  sander: new Image(),

  nemesis: new Image()

};


imgs.map.onload = () => {

  MAP.w = imgs.map.naturalWidth || 1536;
  MAP.h = imgs.map.naturalHeight || 952;

  mapOK = true;

  buildMapMask();

  drawMini();

};


imgs.sander.onload = () => {

  sanderOK = true;

};


imgs.nemesis.onload = () => {

  nemesisOK = true;

};


imgs.map.src = "assets/map-estacao-paulista.png";

imgs.sander.src = "assets/sander-sprites.png";

imgs.nemesis.src = "assets/nemesis-sprites.png";


/* =========================================================
   SANDER
   ========================================================= */

const sand = {

  x: 130,
  y: 145,

  r: 21,

  hp: 100,

  energy: 0,

  level: 1,

  f: {
    x: 1,
    y: 0
  },

  vx: 0,
  vy: 0,

  inv: 0,

  atk: 0,

  special: 0,

  tp: 0,

  combo: 0,

  comboTimer: 0,

  anim: 0

};


/* =========================================================
   NÉMESIS
   ========================================================= */

const nem = {

  x: 1125,
  y: 185,

  r: 27,

  hp: 1100,

  maxHp: 1100,

  energy: 0,

  level: 1,

  f: {
    x: -1,
    y: 0
  },

  vx: 0,
  vy: 0,

  atk: 0,

  special: 0,

  freeze: 0,

  inv: 0,

  state: "collect",

  stateT: 0,

  targetGem: null,

  goal: null,

  dodge: 0,

  dodgeDir: 1,

  stuck: 0

};


/* =========================================================
   BORDA DO MAPA
   ========================================================= */

const fallbackBlocks = [

  {
    x: 0,
    y: 0,
    w: 1536,
    h: 18
  },

  {
    x: 0,
    y: 846,
    w: 1536,
    h: 18
  },

  {
    x: 0,
    y: 0,
    w: 18,
    h: 864
  },

  {
    x: 1518,
    y: 0,
    w: 18,
    h: 864
  }

];


/* =========================================================
   RESIZE / MOBILE
   ========================================================= */

function resize() {

  W = innerWidth;
  H = innerHeight;

  dpr = Math.min(
    devicePixelRatio || 1,
    2
  );

  canvas.width =
    Math.max(1, Math.floor(W * dpr));

  canvas.height =
    Math.max(1, Math.floor(H * dpr));

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  drawMini();

  updateOrientationLock();

}


function isMobile() {

  return /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent
  )
  ||
  Math.min(innerWidth, innerHeight) < 700;

}


function isPortrait() {

  return innerHeight > innerWidth;

}


function updateOrientationLock() {

  const lock = $("orientation-lock");

  if (!lock) return;

  lock.style.display =
    isMobile() && isPortrait()
      ? "flex"
      : "none";

}


async function requestLandscape() {

  try {

    if (
      document.documentElement.requestFullscreen &&
      !document.fullscreenElement
    ) {

      await document.documentElement.requestFullscreen();

    }

  } catch {}

  try {

    if (
      screen.orientation &&
      screen.orientation.lock
    ) {

      await screen.orientation.lock(
        "landscape"
      );

    }

  } catch {}

  updateOrientationLock();

  resize();

}


$("rotateBtn")?.addEventListener(
  "click",
  requestLandscape
);


addEventListener(
  "orientationchange",
  () => {

    setTimeout(
      updateOrientationLock,
      120
    );

  }
);


addEventListener(
  "resize",
  () => {

    setTimeout(
      updateOrientationLock,
      60
    );

  }
);


addEventListener(
  "resize",
  resize
);


/* =========================================================
   MÁSCARA DO MAPA
   ========================================================= */

function buildMapMask() {

  mapCanvas =
    document.createElement("canvas");

  mapCanvas.width = MAP.w;
  mapCanvas.height = MAP.h;

  const c =
    mapCanvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  c.drawImage(
    imgs.map,
    0,
    0,
    MAP.w,
    MAP.h
  );

  try {

    mapData =
      c.getImageData(
        0,
        0,
        MAP.w,
        MAP.h
      ).data;

    buildRoadMini();

  } catch {

    mapData = null;

  }

}


/* =========================================================
   LEITURA DO TERRENO
   ========================================================= */

function pixelInfo(x, y) {

  if (!mapData) {

    return {
      valid: true,
      blocked: false,
      path: true
    };

  }

  x = Math.floor(x);
  y = Math.floor(y);

  if (
    x < 0 ||
    y < 0 ||
    x >= MAP.w ||
    y >= MAP.h
  ) {

    return {
      valid: false,
      blocked: true,
      path: false
    };

  }

  const i =
    (y * MAP.w + x) * 4;

  const r = mapData[i];
  const g = mapData[i + 1];
  const b = mapData[i + 2];

  const lum =
    (r + g + b) / 3;

  const vegetation =
    g > r * 1.16 &&
    g > b * 1.06 &&
    g > 68;

  const water =
    b > g * 1.20 &&
    b > r * 1.18 &&
    b > 75;

  const veryDark =
    lum < 22;

  const warmPath =
    r > 112 &&
    g > 88 &&
    r >= g * .86 &&
    g >= b * 1.03 &&
    b < 215;

  const neutralFloor =
    Math.abs(r - g) < 32 &&
    Math.abs(g - b) < 38 &&
    lum > 70 &&
    lum < 235;

  const blueFloor =
    b > 105 &&
    b >= g * .90 &&
    b >= r * .72 &&
    lum > 62;

  return {

    valid: true,

    blocked:
      vegetation ||
      water ||
      veryDark,

    path:
      !vegetation &&
      !water &&
      !veryDark &&
      (
        warmPath ||
        neutralFloor ||
        blueFloor
      )

  };

}


/* =========================================================
   COLISÃO
   ========================================================= */

function blockedByMap(x, y, r) {

  if (!mapData) return false;

  const pts = [

    [0, 0],

    [r * .65, 0],

    [-r * .65, 0],

    [0, r * .65],

    [0, -r * .65],

    [r * .48, r * .48],

    [-r * .48, r * .48],

    [r * .48, -r * .48],

    [-r * .48, -r * .48]

  ];

  let blocked = 0;

  for (const [dx, dy] of pts) {

    if (
      pixelInfo(
        x + dx,
        y + dy
      ).blocked
    ) {

      blocked++;

    }

  }

  return blocked >= 4;

}


function circleRect(
  x,
  y,
  r,
  rx,
  ry,
  rw,
  rh
) {

  const cx =
    Math.max(
      rx,
      Math.min(
        x,
        rx + rw
      )
    );

  const cy =
    Math.max(
      ry,
      Math.min(
        y,
        ry + rh
      )
    );

  return Math.hypot(
    x - cx,
    y - cy
  ) < r;

}


function blockedFallback(
  x,
  y,
  r
) {

  if (
    x - r < 10 ||
    x + r > MAP.w - 10 ||
    y - r < 10 ||
    y + r > MAP.h - 10
  ) {

    return true;

  }

  return fallbackBlocks.some(
    o =>
      circleRect(
        x,
        y,
        r,
        o.x,
        o.y,
        o.w,
        o.h
      )
  );

}


function walkable(x, y, r) {

  if (
    x - r < 10 ||
    x + r > MAP.w - 10 ||
    y - r < 10 ||
    y + r > MAP.h - 10
  ) {

    return false;

  }

  if (
    blockedFallback(
      x,
      y,
      r
    )
  ) {

    return false;

  }

  if (!mapData) return true;

  return !blockedByMap(
    x,
    y,
    r
  );

}


/* =========================================================
   MOVIMENTO COM SLIDE
   ========================================================= */

function move(o, dx, dy) {

  const len =
    Math.hypot(dx, dy);

  if (!len) {

    o.vx = 0;
    o.vy = 0;

    return false;

  }

  const steps =
    Math.max(
      1,
      Math.ceil(
        len / CFG.moveStep
      )
    );

  const sx = dx / steps;
  const sy = dy / steps;

  let moved = false;

  for (
    let i = 0;
    i < steps;
    i++
  ) {

    /* Movimento diagonal */

    if (
      walkable(
        o.x + sx,
        o.y + sy,
        o.r
      )
    ) {

      o.x += sx;
      o.y += sy;

      moved = true;

      continue;

    }


    /* Slide horizontal */

    if (
      walkable(
        o.x + sx,
        o.y,
        o.r
      )
    ) {

      o.x += sx;

      moved = true;

    }


    /* Slide vertical */

    if (
      walkable(
        o.x,
        o.y + sy,
        o.r
      )
    ) {

      o.y += sy;

      moved = true;

    }

  }

  o.vx =
    moved ? dx : 0;

  o.vy =
    moved ? dy : 0;

  return moved;

}


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function norm(x, y) {

  const l =
    Math.hypot(x, y) || 1;

  return {

    x: x / l,

    y: y / l

  };

}


function dist(a, b) {

  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );

}


function clamp(v, a, b) {

  return Math.max(
    a,
    Math.min(b, v)
  );

}


function rand(a, b) {

  return a +
    Math.random() *
    (b - a);

}


function show(id, on) {

  $(id)?.classList.toggle(
    "hidden",
    !on
  );

}


/* =========================================================
   MENSAGEM
   ========================================================= */

function message(
  t,
  s = 1.5
) {

  const el =
    $("message");

  if (!el) return;

  el.textContent = t;

  el.classList.add("show");

  msgT = s;

}


/* =========================================================
   SOM
   ========================================================= */

function beep(
  f = 440,
  d = .06,
  type = "sine"
) {

  if (muted) return;

  try {

    audio ||=
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    const o =
      audio.createOscillator();

    const g =
      audio.createGain();

    o.type = type;

    o.frequency.value = f;

    g.gain.value = .035;

    o.connect(g);

    g.connect(
      audio.destination
    );

    o.start();

    g.gain.exponentialRampToValueAtTime(
      .001,
      audio.currentTime + d
    );

    o.stop(
      audio.currentTime + d
    );

  } catch {}

}


/* =========================================================
   CONTROLES
   ========================================================= */

addEventListener(
  "keydown",
  e => {

    const k =
      e.key.length === 1
        ? e.key.toLowerCase()
        : e.key;

    keys.add(k);

    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
        "z",
        "x",
        "c",
        " "
      ].includes(k)
    ) {

      e.preventDefault();

    }

    if (k === "Escape") {

      togglePause();

    }

  }
);


addEventListener(
  "keyup",
  e => {

    const k =
      e.key.length === 1
        ? e.key.toLowerCase()
        : e.key;

    keys.delete(k);

  }
);


/* =========================================================
   TOUCH
   ========================================================= */

document
  .querySelectorAll("#touch button")
  .forEach(b => {

    const k =
      b.dataset.key;

    const down = e => {

      e.preventDefault();

      keys.add(k);

      if (k === "z")
        attack();

      if (k === "x")
        special();

      if (k === "c")
        teleport();

    };

    const up = e => {

      e.preventDefault();

      keys.delete(k);

    };

    b.addEventListener(
      "pointerdown",
      down
    );

    b.addEventListener(
      "pointerup",
      up
    );

    b.addEventListener(
      "pointercancel",
      up
    );

    b.addEventListener(
      "pointerleave",
      up
    );

  });


let latch = {
  z: false,
  x: false,
  c: false
};


function actions() {

  for (
    const k of ["z", "x", "c"]
  ) {

    if (
      keys.has(k) &&
      !latch[k]
    ) {

      if (k === "z")
        attack();

      if (k === "x")
        special();

      if (k === "c")
        teleport();

    }

    latch[k] =
      keys.has(k);

  }

}


function inputVector() {

  let x = 0;
  let y = 0;

  if (
    keys.has("ArrowLeft") ||
    keys.has("a")
  ) {

    x--;

  }

  if (
    keys.has("ArrowRight") ||
    keys.has("d")
  ) {

    x++;

  }

  if (
    keys.has("ArrowUp") ||
    keys.has("w")
  ) {

    y--;

  }

  if (
    keys.has("ArrowDown") ||
    keys.has("s")
  ) {

    y++;

  }

  if (x || y) {

    return norm(x, y);

  }

  return {
    x: 0,
    y: 0
  };

}


/* =========================================================
   NAVEGAÇÃO INTELIGENTE
   ========================================================= */

function steerToward(
  o,
  target,
  speed,
  dt,
  extraDirs = []
) {

  const base =
    norm(
      target.x - o.x,
      target.y - o.y
    );

  const dirs = [

    {
      x: base.x,
      y: base.y
    }

  ];


  /* Direções alternativas */

  const angles = [

    -.45,
    .45,

    -.9,
    .9,

    -1.35,
    1.35,

    Math.PI

  ];


  for (
    const angle of angles
  ) {

    const c =
      Math.cos(angle);

    const s =
      Math.sin(angle);

    dirs.push({

      x:
        base.x * c -
        base.y * s,

      y:
        base.x * s +
        base.y * c

    });

  }


  for (
    const d of extraDirs
  ) {

    dirs.push(d);

  }


  let best = null;

  let bestScore = Infinity;


  for (
    const d of dirs
  ) {

    const probe = 35;

    if (
      !walkable(
        o.x + d.x * probe,
        o.y + d.y * probe,
        o.r
      )
    ) {

      continue;

    }

    const nx =
      o.x + d.x * 55;

    const ny =
      o.y + d.y * 55;

    const score =
      Math.hypot(
        nx - target.x,
        ny - target.y
      );

    if (
      score < bestScore
    ) {

      bestScore = score;

      best = d;

    }

  }


  if (!best)
    return false;


  o.f = best;

  return move(
    o,
    best.x * speed * dt,
    best.y * speed * dt
  );

}


/* =========================================================
   ENERGIA
   ========================================================= */

function randomGemPosition() {

  for (
    let i = 0;
    i < 180;
    i++
  ) {

    const x =
      rand(
        50,
        MAP.w - 50
      );

    const y =
      rand(
        50,
        MAP.h - 50
      );

    if (
      walkable(
        x,
        y,
        11
      )
    ) {

      return {
        x,
        y
      };

    }

  }


  return {

    x:
      rand(
        80,
        MAP.w - 80
      ),

    y:
      rand(
        80,
        MAP.h - 80
      )

  };

}


function createGem(
  index
) {

  const p =
    randomGemPosition();

  return {

    x: p.x,

    y: p.y,

    r: 11,

    active: true,

    p: index,

    vx: rand(
      -28,
      28
    ),

    vy: rand(
      -28,
      28
    ),

    change:
      rand(
        .4,
        1.8
      ),

    bob:
      Math.random() *
      Math.PI *
      2,

    wait: 0

  };

}


function seedEnergy() {

  energy = [];

  for (
    let i = 0;
    i < CFG.gemCount;
    i++
  ) {

    energy.push(
      createGem(i)
    );

  }

}


/* =========================================================
   ENERGIA SE MOVENDO
   ========================================================= */

function updateEnergy(dt) {

  for (
    const e of energy
  ) {

    e.bob +=
      dt * 3;


    /* Respawn */

    if (!e.active) {

      e.wait -= dt;

      if (
        e.wait <= 0
      ) {

        const p =
          randomGemPosition();

        e.x = p.x;
        e.y = p.y;

        e.vx =
          rand(-35, 35);

        e.vy =
          rand(-35, 35);

        e.change =
          rand(.5, 1.7);

        e.active = true;

      }

      continue;

    }


    /* Troca aleatória de direção */

    e.change -= dt;

    if (
      e.change <= 0
    ) {

      const a =
        Math.random() *
        Math.PI *
        2;

      const s =
        rand(18, 48);

      e.vx =
        Math.cos(a) * s;

      e.vy =
        Math.sin(a) * s;

      e.change =
        rand(.45, 1.7);

    }


    const nx =
      e.x + e.vx * dt;

    const ny =
      e.y + e.vy * dt;


    if (
      walkable(
        nx,
        ny,
        e.r
      )
    ) {

      e.x = nx;
      e.y = ny;

    } else {

      e.vx *= -1;
      e.vy *= -1;

    }

  }

}


/* =========================================================
   PEGAR ENERGIA
   ========================================================= */

function nearestGem(o) {

  let best = null;

  let bd = Infinity;

  for (
    const e of energy
  ) {

    if (!e.active)
      continue;

    const d =
      dist(o, e);

    if (
      d < bd
    ) {

      bd = d;

      best = e;

    }

  }

  return best;

}


function collect(
  o,
  player
) {

  for (
    const e of energy
  ) {

    if (
      !e.active
    )
      continue;

    if (
      dist(o, e) >
      CFG.pickupRange
    )
      continue;


    e.active = false;

    e.wait =
      rand(
        CFG.gemRespawnMin,
        CFG.gemRespawnMax
      );


    const gain =
      player
        ? 55
        : 48;


    o.energy =
      clamp(
        o.energy + gain,
        0,
        CFG.maxEnergy
      );


    o.level =
      1 +
      Math.min(
        9,
        Math.floor(
          o.energy / 180
        )
      );


    burst(
      e.x,
      e.y,
      "#ffd52b",
      12
    );


    text(
      e.x,
      e.y,
      `+${gain} ⚡`
    );


    beep(
      player ? 620 : 470,
      .045
    );


    if (player) {

      message(
        `ENERGIA ABSORVIDA • NÍVEL ${o.level}`,
        .7
      );

    }

  }

}


/* =========================================================
   IA — ESCOLHER COMPORTAMENTO
   ========================================================= */

function chooseEnemyState() {

  const d =
    DIFF[choice];

  const dp =
    dist(
      nem,
      sand
    );

  const hpRatio =
    nem.hp /
    nem.maxHp;

  const energyAdv =
    nem.energy -
    sand.energy;


  /* Congelado */

  if (
    nem.freeze > 0
  ) {

    return "flee";

  }


  /* Fugir quando está muito fraco */

  if (
    dp < 125 &&
    (
      hpRatio < .38 ||
      sand.energy >
        nem.energy + 220
    )
  ) {

    return "flee";

  }


  /* Ataque */

  if (
    dp <
      CFG.specialRange &&
    (
      nem.energy > 100 ||
      sand.energy < 180
    )
  ) {

    return "attack";

  }


  /* Perseguir */

  if (
    dp < 430 &&
    (
      energyAdv > 160 ||
      sand.energy >
        nem.energy + 350
    )
  ) {

    return "chase";

  }


  /* Movimento aleatório */

  if (
    Math.random() <
    .22 * d.brain
  ) {

    return "wander";

  }


  return "collect";

}


/* =========================================================
   IA NÉMESIS
   ========================================================= */

function updateEnemy(dt) {

  const d =
    DIFF[choice];


  nem.atk =
    Math.max(
      0,
      nem.atk - dt
    );


  nem.special =
    Math.max(
      0,
      nem.special - dt
    );


  nem.freeze =
    Math.max(
      0,
      nem.freeze - dt
    );


  nem.inv =
    Math.max(
      0,
      nem.inv - dt
    );


  nem.stateT -= dt;

  nem.dodge -= dt;


  const dp =
    dist(
      nem,
      sand
    );


  /* =====================================================
     CONGELADO
     ===================================================== */

  if (
    nem.freeze > 0
  ) {

    nem.vx = 0;
    nem.vy = 0;

    collect(
      nem,
      false
    );

    return;

  }


  /* =====================================================
     TROCAR DE ESTADO
     ===================================================== */

  if (
    nem.stateT <= 0 ||
    !nem.goal ||
    !walkable(
      nem.goal.x,
      nem.goal.y,
      nem.r
    )
  ) {

    nem.state =
      chooseEnemyState();

    nem.stateT =
      rand(
        .7,
        1.8
      ) / d.brain;

    nem.goal = null;

    nem.targetGem = null;

  }


  /* =====================================================
     FUGA
     ===================================================== */

  if (
    nem.state === "flee"
  ) {

    if (
      !nem.goal ||
      dist(
        nem,
        nem.goal
      ) < 38
    ) {

      let best = null;

      let bestScore =
        -Infinity;


      for (
        let i = 0;
        i < 32;
        i++
      ) {

        const a =
          Math.PI *
          2 *
          i /
          32 +
          rand(
            -.08,
            .08
          );


        const radius =
          rand(
            170,
            380
          );


        const p = {

          x:
            clamp(
              nem.x +
                Math.cos(a) *
                radius,

              nem.r + 15,

              MAP.w -
                nem.r -
                15
            ),

          y:
            clamp(
              nem.y +
                Math.sin(a) *
                radius,

              nem.r + 15,

              MAP.h -
                nem.r -
                15
            )

        };


        if (
          !walkable(
            p.x,
            p.y,
            nem.r
          )
        ) {

          continue;

        }


        const away =
          dist(
            p,
            sand
          );


        const centerPenalty =
          Math.hypot(
            p.x - MAP.w / 2,
            p.y - MAP.h / 2
          ) * .08;


        const score =
          away -
          centerPenalty +
          rand(
            0,
            100
          );


        if (
          score >
          bestScore
        ) {

          bestScore =
            score;

          best = p;

        }

      }


      nem.goal =
        best ||
        randomGemPosition();

    }


    /* Movimento lateral para dificultar */

    const side = {

      x:
        -(sand.y - nem.y),

      y:
        sand.x - nem.x

    };


    const sideN =
      norm(
        side.x,
        side.y
      );


    const speed =
      CFG.enemySpeed *
      d.speed *
      (
        1.08 +
        Math.min(
          4,
          nem.level - 1
        ) * .02
      );


    steerToward(
      nem,
      nem.goal,
      speed,
      dt,
      [
        sideN,

        {
          x: -sideN.x,
          y: -sideN.y
        }
      ]
    );


    if (
      dp > 330 &&
      Math.random() < .03
    ) {

      nem.state =
        "collect";

    }

  }


  /* =====================================================
     ATAQUE
     ===================================================== */

  else if (
    nem.state === "attack"
  ) {

    if (
      dp >
      CFG.attackRange + 18
    ) {

      const to =
        norm(
          sand.x - nem.x,
          sand.y - nem.y
        );


      const strafe = {

        x: -to.y,

        y: to.x

      };


      if (
        nem.dodge <= 0
      ) {

        nem.dodge =
          rand(
            .35,
            .9
          );

        nem.dodgeDir =
          Math.random() < .5
            ? -1
            : 1;

      }


      const dir =
        norm(

          to.x * .78 +
          strafe.x *
            .22 *
            nem.dodgeDir,

          to.y * .78 +
          strafe.y *
            .22 *
            nem.dodgeDir

        );


      steerToward(
        nem,

        {
          x:
            nem.x +
            dir.x * 100,

          y:
            nem.y +
            dir.y * 100
        },

        CFG.enemySpeed *
          d.speed,

        dt
      );

    } else {

      nem.vx = 0;
      nem.vy = 0;

    }


    if (
      dp <=
      CFG.attackRange + 8
    ) {

      enemyAttack();

    }


    if (
      dp <=
      CFG.specialRange &&
      nem.energy >= 140
    ) {

      enemySpecial();

    }

  }


  /* =====================================================
     PERSEGUIÇÃO
     ===================================================== */

  else if (
    nem.state === "chase"
  ) {

    /* Prevê um pouco o movimento do Sander */

    const lead = .32;


    const target = {

      x:
        sand.x +
        (sand.vx || 0) *
        lead,

      y:
        sand.y +
        (sand.vy || 0) *
        lead

    };


    const speed =
      CFG.enemySpeed *
      d.speed *
      (
        1 +
        Math.min(
          6,
          nem.level - 1
        ) * .025
      );


    /* Movimento lateral */

    const strafe = {

      x:
        -(sand.y - nem.y),

      y:
        sand.x - nem.x

    };


    const sn =
      norm(
        strafe.x,
        strafe.y
      );


    steerToward(
      nem,
      target,
      speed,
      dt,
      [
        sn,

        {
          x: -sn.x,
          y: -sn.y
        }
      ]
    );


    if (
      dp <
      CFG.attackRange + 10
    ) {

      enemyAttack();

    }


    if (
      dp <
        CFG.specialRange &&
      nem.energy >= 140
    ) {

      enemySpecial();

    }

  }


  /* =====================================================
     COLETA DE ENERGIA
     ===================================================== */

  else if (
    nem.state === "collect"
  ) {

    nem.targetGem =
      nearestGem(nem);


    if (
      nem.targetGem
    ) {

      steerToward(
        nem,
        nem.targetGem,
        CFG.enemySpeed *
          d.speed *
          (
            1 +
            Math.min(
              5,
              nem.level - 1
            ) * .025
          ),
        dt
      );

    } else {

      nem.state =
        "wander";

    }

  }


  /* =====================================================
     WANDER
     ===================================================== */

  else {

    if (
      !nem.goal ||
      dist(
        nem,
        nem.goal
      ) < 45
    ) {

      nem.goal =
        randomGemPosition();

    }


    steerToward(
      nem,
      nem.goal,
      CFG.enemySpeed *
        d.speed *
        .82,
      dt
    );


    if (
      dp <
        CFG.attackRange + 8 &&
      Math.random() <
        .35 * d.brain
    ) {

      enemyAttack();

    }

  }


  /* =====================================================
     COLETA
     ===================================================== */

  const beforeX =
    nem.x;

  const beforeY =
    nem.y;


  collect(
    nem,
    false
  );


  /* =====================================================
     DESATOLAR
     ===================================================== */

  if (
    Math.hypot(
      nem.x - beforeX,
      nem.y - beforeY
    ) < .5
  ) {

    nem.stuck += dt;


    if (
      nem.stuck > .65
    ) {

      nem.goal =
        randomGemPosition();

      nem.stateT = 0;

      nem.stuck = 0;

    }

  } else {

    nem.stuck = 0;

  }

}


/* =========================================================
   ATAQUE DO NÉMESIS
   ========================================================= */

function enemyAttack() {

  if (
    !game ||
    nem.atk > 0 ||
    nem.freeze > 0
  ) {

    return;

  }


  const d =
    DIFF[choice];


  const dp =
    dist(
      nem,
      sand
    );


  if (
    dp >
    CFG.attackRange + 12
  ) {

    return;

  }


  nem.atk =
    CFG.enemyAttackCooldown /
    d.brain;


  const combo =
    Math.random() < .25
      ? 2
      : 1;


  const damage =
    (
      8 +
      nem.level * 2.5
    ) *
    d.damage *
    combo;


  hurtPlayer(
    damage
  );


  burst(
    sand.x,
    sand.y,
    "#ff5a64",
    10
  );


  shake = .13;

}


/* =========================================================
   ESPECIAL DO NÉMESIS
   ========================================================= */

function enemySpecial() {

  if (
    !game ||
    nem.special > 0 ||
    nem.freeze > 0 ||
    nem.energy < 140
  ) {

    return;

  }


  const d =
    DIFF[choice];


  if (
    dist(
      nem,
      sand
    ) >
    CFG.specialRange
  ) {

    return;

  }


  nem.special =
    CFG.enemySpecialCooldown /
    d.brain;


  nem.energy -= 140;


  const damage =
    (
      18 +
      nem.level * 4
    ) *
    d.damage;


  hurtPlayer(
    damage
  );


  burst(
    sand.x,
    sand.y,
    "#d94cff",
    24
  );


  text(
    sand.x,
    sand.y,
    `-${Math.round(damage)}`
  );


  message(
    "NÉMESIS USOU O ESPECIAL!",
    .9
  );


  shake = .2;

}


/* =========================================================
   JOGADOR
   ========================================================= */

function updatePlayer(dt) {

  sand.atk =
    Math.max(
      0,
      sand.atk - dt
    );


  sand.special =
    Math.max(
      0,
      sand.special - dt
    );


  sand.tp =
    Math.max(
      0,
      sand.tp - dt
    );


  sand.inv =
    Math.max(
      0,
      sand.inv - dt
    );


  sand.comboTimer =
    Math.max(
      0,
      sand.comboTimer - dt
    );


  if (
    sand.comboTimer <= 0
  ) {

    sand.combo = 0;

  }


  const v =
    inputVector();


  if (
    v.x ||
    v.y
  ) {

    sand.f = v;


    const speed =
      CFG.speed *
      (
        1 +
        Math.min(
          8,
          sand.level - 1
        ) * .035
      );


    move(
      sand,

      v.x *
        speed *
        dt,

      v.y *
        speed *
        dt
    );


    sand.anim +=
      dt * 10;

  } else {

    sand.vx = 0;
    sand.vy = 0;

    sand.anim +=
      dt * 2;

  }


  collect(
    sand,
    true
  );

}


/* =========================================================
   DANO NO SANDER
   ========================================================= */

function hurtPlayer(dmg) {

  if (
    sand.inv > 0 ||
    !game
  ) {

    return;

  }


  sand.hp =
    Math.max(
      0,
      sand.hp - dmg
    );


  sand.inv = .34;


  burst(
    sand.x,
    sand.y,
    "#ff5263",
    12
  );


  text(
    sand.x,
    sand.y,
    `-${Math.round(dmg)}`
  );


  beep(
    120,
    .06,
    "sawtooth"
  );


  if (
    sand.hp <= 0
  ) {

    finish(false);

  }

}


/* =========================================================
   ATAQUE DO SANDER
   ========================================================= */

function attack() {

  if (
    !game ||
    paused ||
    sand.atk > 0
  ) {

    return;

  }


  sand.atk =
    CFG.playerAttackCooldown;


  sand.comboTimer =
    .8;


  sand.combo =
    Math.min(
      3,
      sand.combo + 1
    );


  const d =
    dist(
      sand,
      nem
    );


  if (
    d >
    CFG.attackRange
  ) {

    message(
      "Aproxime-se do Némesis para atacar.",
      .55
    );

    return;

  }


  const p =
    (
      12 +
      sand.level * 4
    ) *
    (
      1 +
      .16 *
      (sand.combo - 1)
    );


  nem.hp =
    Math.max(
      0,
      nem.hp - p
    );


  nem.inv = .12;


  /* Pequeno knockback */

  const knock =
    norm(
      nem.x - sand.x,
      nem.y - sand.y
    );


  move(
    nem,
    knock.x * 28,
    knock.y * 28
  );


  burst(
    nem.x,
    nem.y,
    "#69bfff",
    12
  );


  text(
    nem.x,
    nem.y,
    `-${Math.round(p)}`
  );


  beep(
    180 +
      sand.combo * 90,
    .07
  );


  shake = .12;


  if (
    nem.hp <= 0
  ) {

    finish(true);

  }

}


/* =========================================================
   ESPECIAL DO SANDER
   ========================================================= */

function special() {

  if (
    !game ||
    paused ||
    sand.special > 0
  ) {

    return;

  }


  sand.special =
    CFG.specialCooldown;


  const d =
    dist(
      sand,
      nem
    );


  if (
    d <=
    CFG.specialRange
  ) {

    const p =
      30 +
      sand.level * 9;


    nem.hp =
      Math.max(
        0,
        nem.hp - p
      );


    nem.freeze =
      2.4;


    nem.inv = .15;


    burst(
      nem.x,
      nem.y,
      "#72eaff",
      30
    );


    text(
      nem.x,
      nem.y,
      `-${p} CONGELADO`
    );


    message(
      "❄ NÉMESIS CONGELADO!",
      1.2
    );


    beep(
      110,
      .15,
      "triangle"
    );


    shake = .22;


    if (
      nem.hp <= 0
    ) {

      finish(true);

    }

  } else {

    const n =
      norm(
        nem.x - sand.x,
        nem.y - sand.y
      );


    burst(
      sand.x +
        n.x * 80,

      sand.y +
        n.y * 80,

      "#8fd8ff",
      18
    );


    message(
      "Especial lançado!",
      .6
    );


    beep(
      520,
      .08
    );

  }

}


/* =========================================================
   TELEPORTE
   ========================================================= */

function teleport() {

  if (
    !game ||
    paused ||
    sand.tp > 0
  ) {

    return;

  }


  let tx =
    sand.x;

  let ty =
    sand.y;


  for (
    let i = 1;
    i <= 12;
    i++
  ) {

    const nx =
      sand.x +
      sand.f.x *
      300 *
      i / 12;


    const ny =
      sand.y +
      sand.f.y *
      300 *
      i / 12;


    if (
      walkable(
        nx,
        ny,
        sand.r
      )
    ) {

      tx = nx;
      ty = ny;

    } else {

      break;

    }

  }


  if (
    tx === sand.x &&
    ty === sand.y
  ) {

    message(
      "Teleporte bloqueado.",
      .8
    );

    return;

  }


  sand.x = tx;
  sand.y = ty;


  sand.tp =
    CFG.teleportCooldown;


  burst(
    tx,
    ty,
    "#5effd2",
    30
  );


  beep(
    880,
    .13,
    "triangle"
  );


  message(
    "TELEPORTE EXECUTADO!",
    .9
  );

}


/* =========================================================
   INICIAR JOGO
   ========================================================= */

$("startBtn")?.addEventListener(
  "click",
  async () => {

    await requestLandscape();

    show(
      "intro",
      false
    );

    show(
      "difficulty",
      true
    );

    beep(
      440,
      .08
    );

  }
);


document
  .querySelectorAll(
    "[data-difficulty]"
  )
  .forEach(b => {

    b.addEventListener(
      "click",
      () => {

        choice =
          b.dataset.difficulty;

        start();

      }
    );

  });


$("pauseBtn")?.addEventListener(
  "click",
  togglePause
);


$("resumeBtn")?.addEventListener(
  "click",
  togglePause
);


$("soundBtn")?.addEventListener(
  "click",
  () => {

    muted = !muted;

    $("soundBtn").textContent =
      muted
        ? "🔇"
        : "🔊";

    if (!muted)
      beep(
        520,
        .05
      );

  }
);


$("restartBtn")?.addEventListener(
  "click",
  () => {

    show(
      "result",
      false
    );

    show(
      "difficulty",
      true
    );

  }
);


/* =========================================================
   START
   ========================================================= */

async function start() {

  await requestLandscape();


  const d =
    DIFF[choice];


  /* SANDER */

  sand.x = 130;
  sand.y = 145;

  sand.hp = 100;

  sand.energy = 0;

  sand.level = 1;

  sand.f = {
    x: 1,
    y: 0
  };

  sand.vx = 0;
  sand.vy = 0;

  sand.inv = 0;

  sand.atk = 0;

  sand.special = 0;

  sand.tp = 0;

  sand.combo = 0;

  sand.comboTimer = 0;


  /* NÉMESIS */

  nem.x = 1125;
  nem.y = 185;

  nem.r = 27;

  nem.maxHp = d.hp;

  nem.hp = d.hp;

  nem.energy = 0;

  nem.level = 1;

  nem.f = {
    x: -1,
    y: 0
  };

  nem.vx = 0;
  nem.vy = 0;

  nem.atk = 0;

  nem.special = 0;

  nem.freeze = 0;

  nem.inv = 0;

  nem.state =
    "collect";

  nem.stateT = 0;

  nem.goal = null;

  nem.targetGem = null;

  nem.stuck = 0;

  nem.dodge = 0;


  /* PARTIDA */

  elapsed = 0;

  parts = [];

  texts = [];


  /* ENERGIAS ALEATÓRIAS */

  seedEnergy();


  /* CÂMERA */

  camera.x =
    clamp(
      sand.x,
      W / (2 * 1.28),
      MAP.w -
        W / (2 * 1.28)
    );


  camera.y =
    clamp(
      sand.y,
      H / (2 * 1.28),
      MAP.h -
        H / (2 * 1.28)
    );


  paused = false;

  game = true;


  show(
    "difficulty",
    false
  );

  show(
    "hud",
    true
  );

  show(
    "touch",
    true
  );


  message(
    "Explore livremente • absorva energia • lute com Némesis!",
    2.5
  );


  last =
    performance.now();


  requestAnimationFrame(
    loop
  );

}


/* =========================================================
   FINAL
   ========================================================= */

function finish(win) {

  if (!game)
    return;


  game = false;


  show(
    "hud",
    false
  );

  show(
    "touch",
    false
  );

  show(
    "result",
    true
  );


  $("resultIcon").textContent =
    win
      ? "🏆"
      : "💥";


  $("resultTitle").textContent =
    win
      ? "VITÓRIA!"
      : "NÉMESIS VENCEU";


  $("resultText").textContent =
    win

      ? `Némesis foi derrotado. Sander terminou com ${Math.round(sand.hp)}% de vida e nível ${sand.level}.`

      : "A vida de Sander chegou a zero.";


  beep(
    win
      ? 880
      : 110,

    .22,

    win
      ? "triangle"
      : "sawtooth"
  );

}


/* =========================================================
   PAUSA
   ========================================================= */

function togglePause() {

  if (!game)
    return;


  paused = !paused;


  show(
    "pause",
    paused
  );


  if (!paused) {

    last =
      performance.now();

    requestAnimationFrame(
      loop
    );

  }

}


/* =========================================================
   UPDATE
   ========================================================= */

function update(dt) {

  elapsed += dt;


  if (
    elapsed >=
    CFG.time
  ) {

    finish(false);

    return;

  }


  updateEnergy(dt);

  updatePlayer(dt);

  updateEnemy(dt);


  /* Partículas */

  for (
    const p of parts
  ) {

    p.life -= dt;

    p.x +=
      p.vx * dt;

    p.y +=
      p.vy * dt;

    p.vy +=
      40 * dt;

  }


  parts =
    parts.filter(
      p => p.life > 0
    );


  /* Textos */

  for (
    const t of texts
  ) {

    t.life -= dt;

    t.y -=
      25 * dt;

  }


  texts =
    texts.filter(
      t => t.life > 0
    );


  shake =
    Math.max(
      0,
      shake - dt
    );


  /* =====================================================
     CÂMERA
     ===================================================== */

  const zoom = 1.28;

  const viewW =
    W / zoom;

  const viewH =
    H / zoom;


  const targetCamX =
    clamp(
      sand.x,
      viewW / 2,
      MAP.w -
        viewW / 2
    );


  const targetCamY =
    clamp(
      sand.y,
      viewH / 2,
      MAP.h -
        viewH / 2
    );


  camera.x +=
    (
      targetCamX -
      camera.x
    ) *
    Math.min(
      1,
      dt *
        CFG.cameraSmooth
    );


  camera.y +=
    (
      targetCamY -
      camera.y
    ) *
    Math.min(
      1,
      dt *
        CFG.cameraSmooth
    );


  updateHUD();

}


/* =========================================================
   HUD
   ========================================================= */

function updateHUD() {

  $("sanderHp").style.width =
    clamp(
      sand.hp,
      0,
      100
    ) + "%";


  $("sanderEnergy").style.width =
    clamp(
      sand.energy / 10,
      0,
      100
    ) + "%";


  $("nemesisHp").style.width =
    clamp(
      nem.hp /
      nem.maxHp *
      100,

      0,
      100
    ) + "%";


  $("timer").textContent =
    timeLeft();


  $("teleportStatus").textContent =

    sand.tp <= 0

      ? "TELEPORTE: PRONTO"

      : `TELEPORTE: ${Math.ceil(sand.tp)}s`;


  $("distanceInfo").textContent =
    `NÉMESIS: ${Math.round(
      dist(
        sand,
        nem
      )
    )}m`;


  $("energyInfo").textContent =
    `ENERGIA: ${Math.round(
      sand.energy
    )} | NÍVEL ${sand.level}`;


  /* =====================================================
     DIREÇÃO DO NÉMESIS
     ===================================================== */

  const nd =
    $("nemesis-direction");


  if (nd) {

    const zoom = 1.28;


    const sx =
      (
        nem.x -
        camera.x
      ) *
      zoom +
      W / 2;


    const sy =
      (
        nem.y -
        camera.y
      ) *
      zoom +
      H / 2;


    const inside =
      sx >= 0 &&
      sy >= 0 &&
      sx <= W &&
      sy <= H;


    if (inside) {

      nd.textContent =

        nem.freeze > 0

          ? `❄ NÉMESIS CONGELADO • ${nem.freeze.toFixed(1)}s`

          : `NÉMESIS • ${nem.state.toUpperCase()}`;


      nd.style.opacity =
        ".95";

    }

    else {

      const dx =
        nem.x -
        sand.x;

      const dy =
        nem.y -
        sand.y;


      const dir =

        Math.abs(dx) >
        Math.abs(dy)

          ? (
              dx > 0
                ? "→ DIREITA"
                : "← ESQUERDA"
            )

          : (
              dy > 0
                ? "↓ ABAIXO"
                : "↑ ACIMA"
            );


      nd.textContent =
        `NÉMESIS ${Math.round(
          dist(
            sand,
            nem
          )
        )}m • ${dir}`;


      nd.style.opacity =
        "1";

    }

  }


  if (
    msgT > 0
  ) {

    msgT -= .016;

    if (
      msgT <= 0
    ) {

      $("message")?.
        classList.remove(
          "show"
        );

    }

  }

}


/* =========================================================
   TEMPO
   ========================================================= */

function timeLeft() {

  const s =
    Math.ceil(
      CFG.time -
      elapsed
    );


  return (

    String(
      Math.floor(
        s / 60
      )
    ).padStart(
      2,
      "0"
    )

    +

    ":"

    +

    String(
      s % 60
    ).padStart(
      2,
      "0"
    )

  );

}


/* =========================================================
   MUNDO
   ========================================================= */

function world() {

  if (mapOK) {

    ctx.drawImage(
      imgs.map,
      0,
      0,
      MAP.w,
      MAP.h
    );

    return;

  }


  ctx.fillStyle =
    "#18582a";

  ctx.fillRect(
    0,
    0,
    MAP.w,
    MAP.h
  );


  ctx.fillStyle =
    "#e7c27e";


  for (
    const y of [
      145,
      350,
      535,
      720
    ]
  ) {

    ctx.fillRect(
      0,
      y,
      MAP.w,
      65
    );

  }


  for (
    const x of [
      120,
      370,
      680,
      1010,
      1280
    ]
  ) {

    ctx.fillRect(
      x,
      0,
      70,
      MAP.h
    );

  }

}


/* =========================================================
   DESENHAR ENERGIAS
   ========================================================= */

function drawEnergy() {

  for (
    const e of energy
  ) {

    if (!e.active)
      continue;


    const bob =
      Math.sin(
        e.bob
      ) * 3.5;


    ctx.save();


    ctx.translate(
      e.x,
      e.y + bob
    );


    ctx.shadowBlur =
      22;

    ctx.shadowColor =
      "#ffd52b";


    ctx.fillStyle =
      "#fff7ad";


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      10,
      0,
      Math.PI * 2
    );

    ctx.fill();


    ctx.fillStyle =
      "#ffb300";


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      5,
      0,
      Math.PI * 2
    );

    ctx.fill();


    ctx.strokeStyle =
      "#fff";


    ctx.globalAlpha =
      .75;


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      14,
      elapsed % 6,
      elapsed % 6 +
        Math.PI * .8
    );

    ctx.stroke();


    ctx.restore();

  }

}


/* =========================================================
   PERSONAGENS
   ========================================================= */

function character(
  o,
  player
) {

  ctx.save();


  ctx.translate(
    o.x,
    o.y
  );


  if (
    (player && sanderOK) ||
    (!player && nemesisOK)
  ) {

    const im =
      player
        ? imgs.sander
        : imgs.nemesis;


    const cols = 4;
    const rows = 4;


    const fw =
      im.width /
      cols;


    const fh =
      im.height /
      rows;


    const moving =
      Math.hypot(
        o.vx || 0,
        o.vy || 0
      ) > 3;


    const col =
      moving
        ? Math.floor(
            elapsed * 9
          ) % cols
        : 0;


    const row = 0;


    const size =
      player
        ? Math.max(
            92,
            o.r * 4
          )
        : Math.max(
            104,
            o.r * 4.25
          );


    if (
      !player &&
      o.inv > 0 &&
      Math.floor(
        elapsed * 20
      ) % 2 === 0
    ) {

      ctx.globalAlpha =
        .35;

    }


    ctx.drawImage(

      im,

      col * fw,

      row * fh,

      fw,

      fh,

      -size / 2,

      -size / 2,

      size,

      size

    );

  }


  else {

    ctx.fillStyle =
      player
        ? "#167fe4"
        : "#f3f3ec";


    ctx.beginPath();


    if (player) {

      ctx.arc(
        0,
        0,
        o.r,
        0,
        Math.PI * 2
      );

    }

    else {

      ctx.ellipse(
        0,
        0,
        o.r * .9,
        o.r * 1.1,
        0,
        0,
        Math.PI * 2
      );

    }


    ctx.fill();

  }


  /* =====================================================
     CONGELAMENTO
     ===================================================== */

  if (
    !player &&
    nem.freeze > 0
  ) {

    ctx.strokeStyle =
      "#72eaff";

    ctx.lineWidth = 4;

    ctx.shadowBlur =
      20;

    ctx.shadowColor =
      "#72eaff";


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      o.r +
        10 +
        Math.sin(
          elapsed * 8
        ) * 2,

      0,
      Math.PI * 2
    );

    ctx.stroke();

  }


  /* =====================================================
     AURA DE NÍVEL
     ===================================================== */

  if (
    o.level > 1
  ) {

    ctx.strokeStyle =
      player
        ? "#4ecbffaa"
        : "#ffb545aa";


    ctx.lineWidth = 3;

    ctx.shadowBlur =
      14;


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      o.r +
        7 +
        Math.sin(
          elapsed * 4
        ) * 2,

      0,
      Math.PI * 2
    );

    ctx.stroke();

  }


  /* =====================================================
     BARRA DE VIDA
     ===================================================== */

  const hp =
    player
      ? o.hp / 100
      : o.hp / o.maxHp;


  ctx.shadowBlur = 0;


  ctx.fillStyle =
    "#000a";


  ctx.fillRect(
    -25,
    -o.r - 14,
    50,
    5
  );


  ctx.fillStyle =
    player
      ? "#45e77f"
      : "#ff5361";


  ctx.fillRect(
    -25,
    -o.r - 14,
    50 *
      clamp(
        hp,
        0,
        1
      ),
    5
  );


  ctx.restore();

}


/* =========================================================
   RENDER
   ========================================================= */

function draw() {

  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  const zoom = 1.28;


  const sx =
    shake > 0
      ? rand(-5,5)
      : 0;


  const sy =
    shake > 0
      ? rand(-4,4)
      : 0;


  ctx.save();


  ctx.translate(
    W / 2 + sx,
    H / 2 + sy
  );


  ctx.scale(
    zoom,
    zoom
  );


  ctx.translate(
    -camera.x,
    -camera.y
  );


  world();

  drawEnergy();

  character(
    sand,
    true
  );

  character(
    nem,
    false
  );


  /* Partículas */

  for (
    const p of parts
  ) {

    ctx.globalAlpha =
      Math.max(
        0,
        p.life / .9
      );


    ctx.fillStyle =
      p.color;


    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      3 / zoom,
      0,
      Math.PI * 2
    );

    ctx.fill();

  }


  ctx.globalAlpha = 1;


  /* Textos */

  for (
    const t of texts
  ) {

    ctx.globalAlpha =
      clamp(
        t.life,
        0,
        1
      );


    ctx.font =
      `900 ${14 / zoom}px system-ui`;


    ctx.textAlign =
      "center";


    ctx.fillStyle =
      "#fff";


    ctx.strokeStyle =
      "#000b";


    ctx.lineWidth =
      4 / zoom;


    ctx.strokeText(
      t.s,
      t.x,
      t.y
    );


    ctx.fillText(
      t.s,
      t.x,
      t.y
    );

  }


  ctx.restore();


  drawMini();

}


/* =========================================================
   MINIMAPA
   ========================================================= */

function buildRoadMini() {

  const mw = 420;

  const mh =
    Math.round(
      mw *
      MAP.h /
      MAP.w
    );


  roadMini =
    document.createElement(
      "canvas"
    );


  roadMini.width =
    mw;

  roadMini.height =
    mh;


  const rc =
    roadMini.getContext(
      "2d"
    );


  const sx =
    MAP.w / mw;

  const sy =
    MAP.h / mh;


  rc.clearRect(
    0,
    0,
    mw,
    mh
  );


  for (
    let y = 0;
    y < mh;
    y++
  ) {

    for (
      let x = 0;
      x < mw;
      x++
    ) {

      const p =
        pixelInfo(
          (x + .5) * sx,
          (y + .5) * sy
        );


      if (
        p.path
      ) {

        rc.fillStyle =
          "#e8c879";


        rc.fillRect(
          x,
          y,
          1.5,
          1.5
        );

      }

    }

  }

}


/* =========================================================
   DESENHAR MINIMAPA
   ========================================================= */

function drawMini() {

  if (
    !mini ||
    !mctx
  )
    return;


  const r =
    mini.getBoundingClientRect();


  const mw =
    Math.max(
      210,
      Math.floor(
        r.width || 300
      )
    );


  const mh =
    Math.max(
      120,
      Math.floor(
        mw *
        MAP.h /
        MAP.w
      )
    );


  mini.width =
    Math.floor(
      mw * dpr
    );


  mini.height =
    Math.floor(
      mh * dpr
    );


  mctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  mctx.clearRect(
    0,
    0,
    mw,
    mh
  );


  mctx.fillStyle =
    "#07131dd9";


  mctx.fillRect(
    0,
    0,
    mw,
    mh
  );


  if (
    roadMini
  ) {

    mctx.drawImage(
      roadMini,
      0,
      0,
      mw,
      mh
    );

  }

  else if (
    mapOK
  ) {

    mctx.drawImage(
      imgs.map,
      0,
      0,
      mw,
      mh
    );

  }


  /* Energias */

  for (
    const e of energy
  ) {

    if (!e.active)
      continue;


    mctx.fillStyle =
      "#ffd52b";


    mctx.beginPath();

    mctx.arc(

      e.x /
        MAP.w *
        mw,

      e.y /
        MAP.h *
        mh,

      2,

      0,
      Math.PI * 2

    );

    mctx.fill();

  }


  /* Área da câmera */

  const viewW =
    Math.min(
      MAP.w,
      W / 1.28
    );


  const viewH =
    Math.min(
      MAP.h,
      H / 1.28
    );


  mctx.strokeStyle =
    "#ffffff77";


  mctx.lineWidth = 1;


  mctx.strokeRect(

    (
      camera.x -
      viewW / 2
    ) /
      MAP.w *
      mw,

    (
      camera.y -
      viewH / 2
    ) /
      MAP.h *
      mh,

    viewW /
      MAP.w *
      mw,

    viewH /
      MAP.h *
      mh

  );


  /* Marcadores */

  if (
    $("sander-marker")
  ) {

    $("sander-marker").style.left =
      sand.x /
      MAP.w *
      100 +
      "%";


    $("sander-marker").style.top =
      sand.y /
      MAP.h *
      100 +
      "%";

  }


  if (
    $("nemesis-marker")
  ) {

    $("nemesis-marker").style.left =
      nem.x /
      MAP.w *
      100 +
      "%";


    $("nemesis-marker").style.top =
      nem.y /
      MAP.h *
      100 +
      "%";

  }

}


/* =========================================================
   EFEITOS
   ========================================================= */

function burst(
  x,
  y,
  color,
  n = 10
) {

  for (
    let i = 0;
    i < n;
    i++
  ) {

    const a =
      Math.random() *
      Math.PI *
      2;


    const s =
      Math.random() *
      90 +
      30;


    parts.push({

      x,

      y,

      vx:
        Math.cos(a) *
        s,

      vy:
        Math.sin(a) *
        s,

      life:
        .45 +
        Math.random() *
        .5,

      color

    });

  }

}


function text(
  x,
  y,
  s
) {

  texts.push({

    x,

    y,

    s,

    life: 1

  });

}


/* =========================================================
   LOOP PRINCIPAL
   ========================================================= */

function loop(now) {

  if (
    !game ||
    paused
  )
    return;


  const dt =
    Math.min(
      (
        now - last
      ) / 1000,

      .035
    );


  last = now;


  actions();

  update(dt);

  draw();


  requestAnimationFrame(
    loop
  );

}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

resize();

drawMini();

})();
