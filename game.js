(() => {
"use strict";

/* SANDER UNITED ARENA
   Mapa: assets/map-estacao-paulista.png
   Sprites: assets/sander-sprites.png e assets/nemesis-sprites.png

   MOVIMENTO / IA:
   - Sander anda pelas áreas permitidas do mapa.
   - Colisão impede atravessar vegetação, água e limites.
   - Movimento possui "slide" para contornar obstáculos.
   - Némesis persegue Sander continuamente.
   - Némesis procura rotas alternativas quando encontra obstáculos.
   - Energia é coletada ao passar sobre ela.
   - Z = ataque.
   - X = especial / congelamento.
   - C = teleporte.
*/

const $ = id => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const mini = $("minimap");
const mctx = mini.getContext("2d");

let MAP = { w: 1536, h: 952 };

let CFG = {
  speed: 230,
  nSpeed: 175,
  time: 180,
  maxEnergy: 1000,
  tp: 30,
  atkRange: 92,
  specialRange: 230
};

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

let mapOK = false;
let sanderOK = false;
let nemesisOK = false;

let mapCanvas = null;
let mapData = null;
let roadMini = null;

const MOVE_STEP = 12;
const PLAYER_COLLISION_RADIUS = 21;
const ENEMY_COLLISION_RADIUS = 27;

const VIEW_ZOOM = 1.28;

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


/* =========================
   PERSONAGENS
========================= */

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
  tp: 0
};

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

  target: null,
  state: "hunt",

  freeze: 0,
  stuck: 0,
  repath: 0
};

let energy = [];
let parts = [];
let texts = [];


/* =========================
   DIFICULDADE
========================= */

const diff = {

  easy: {
    hp: 900,
    damage: .72,
    speed: .86,
    brain: .78
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
    brain: 1.35
  }

};


/* =========================
   COLISÃO DE SEGURANÇA
========================= */

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
  },

  {
    x: 60,
    y: 55,
    w: 300,
    h: 125
  },

  {
    x: 425,
    y: 25,
    w: 190,
    h: 170
  },

  {
    x: 785,
    y: 25,
    w: 360,
    h: 120
  },

  {
    x: 1170,
    y: 40,
    w: 310,
    h: 125
  },

  {
    x: 75,
    y: 260,
    w: 285,
    h: 130
  },

  {
    x: 420,
    y: 265,
    w: 215,
    h: 135
  },

  {
    x: 770,
    y: 255,
    w: 180,
    h: 120
  },

  {
    x: 1150,
    y: 235,
    w: 300,
    h: 145
  },

  {
    x: 70,
    y: 415,
    w: 290,
    h: 135
  },

  {
    x: 445,
    y: 430,
    w: 235,
    h: 130
  },

  {
    x: 790,
    y: 445,
    w: 250,
    h: 125
  },

  {
    x: 1090,
    y: 435,
    w: 350,
    h: 145
  },

  {
    x: 55,
    y: 610,
    w: 315,
    h: 125
  },

  {
    x: 430,
    y: 615,
    w: 280,
    h: 120
  },

  {
    x: 750,
    y: 635,
    w: 330,
    h: 120
  },

  {
    x: 1110,
    y: 620,
    w: 340,
    h: 135
  }

];


/* =========================
   RESOLUÇÃO / ORIENTAÇÃO
========================= */

function resize() {

  W = innerWidth;
  H = innerHeight;

  dpr = Math.min(
    devicePixelRatio || 1,
    2
  );

  canvas.width = Math.max(
    1,
    Math.floor(W * dpr)
  );

  canvas.height = Math.max(
    1,
    Math.floor(H * dpr)
  );

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

  return (
    /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent
    ) ||
    Math.min(
      innerWidth,
      innerHeight
    ) < 700
  );

}


function isPortrait() {

  return innerHeight > innerWidth;

}


function updateOrientationLock() {

  const lock =
    $("orientation-lock");

  if (!lock) return;

  lock.style.display =
    (
      isMobile() &&
      isPortrait()
    )
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


$("rotateBtn").onclick =
  () => requestLandscape();


addEventListener(
  "orientationchange",
  () => setTimeout(
    updateOrientationLock,
    120
  )
);


addEventListener(
  "resize",
  () => setTimeout(
    updateOrientationLock,
    60
  )
);


addEventListener(
  "resize",
  resize
);


resize();


/* =========================
   MÁSCARA DO MAPA
========================= */

function buildMapMask() {

  mapCanvas =
    document.createElement(
      "canvas"
    );

  mapCanvas.width =
    MAP.w;

  mapCanvas.height =
    MAP.h;

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


/* =========================
   DETECÇÃO DO CAMINHO
========================= */

function pathPixel(x, y) {

  if (!mapData)
    return true;

  x = Math.floor(x);
  y = Math.floor(y);

  if (
    x < 0 ||
    y < 0 ||
    x >= MAP.w ||
    y >= MAP.h
  ) {

    return false;

  }

  const i =
    (y * MAP.w + x) * 4;

  const r = mapData[i];
  const g = mapData[i + 1];
  const b = mapData[i + 2];

  const max =
    Math.max(r, g, b);

  const min =
    Math.min(r, g, b);

  const lum =
    (r + g + b) / 3;


  const warm =
    r > 115 &&
    g > 90 &&
    r >= g * .88 &&
    g >= b * 1.05 &&
    b < 205;


  const neutral =
    Math.abs(r - g) < 28 &&
    Math.abs(g - b) < 35 &&
    lum > 72 &&
    lum < 225;


  const blueFloor =
    b > 105 &&
    b >= g * .92 &&
    b >= r * .72 &&
    lum > 65 &&
    max - min > 25;


  const vegetation =
    g > r * 1.16 &&
    g > b * 1.06 &&
    g > 70;


  const dark =
    lum < 28;


  return (
    !vegetation &&
    !dark &&
    (
      warm ||
      neutral ||
      blueFloor
    )
  );

}


/* =========================
   COLISÃO COM MAPA
========================= */

function blockedByMap(
  x,
  y,
  r
) {

  if (!mapData)
    return false;


  const pts = [

    [0, 0],

    [r * .55, 0],

    [-r * .55, 0],

    [0, r * .55],

    [0, -r * .55],

    [r * .42, r * .42],

    [-r * .42, r * .42],

    [r * .42, -r * .42],

    [-r * .42, -r * .42]

  ];


  let blocked = 0;


  for (const p of pts) {

    const px =
      Math.floor(
        x + p[0]
      );

    const py =
      Math.floor(
        y + p[1]
      );


    if (
      px < 0 ||
      py < 0 ||
      px >= MAP.w ||
      py >= MAP.h
    ) {

      blocked++;

      continue;

    }


    const i =
      (py * MAP.w + px) * 4;


    const r0 =
      mapData[i];

    const g0 =
      mapData[i + 1];

    const b0 =
      mapData[i + 2];


    const lum =
      (r0 + g0 + b0) / 3;


    const vegetation =
      g0 > r0 * 1.20 &&
      g0 > b0 * 1.08 &&
      g0 > 72;


    const water =
      b0 > g0 * 1.18 &&
      b0 > r0 * 1.20 &&
      b0 > 80;


    const veryDark =
      lum < 18;


    if (
      vegetation ||
      water ||
      veryDark
    ) {

      blocked++;

    }

  }


  return blocked >= 7;

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


  return (
    Math.hypot(
      x - cx,
      y - cy
    ) < r
  );

}


function blockedFallback(
  x,
  y,
  r
) {

  if (
    x - r < 20 ||
    x + r > 1516 ||
    y - r < 20 ||
    y + r > 844
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


/* =========================
   PONTO CAMINHÁVEL
========================= */

function walkable(
  x,
  y,
  r
) {

  if (
    x - r < 12 ||
    x + r > MAP.w - 12 ||
    y - r < 12 ||
    y + r > MAP.h - 12
  ) {

    return false;

  }


  if (
    !mapOK ||
    !mapData
  ) {

    return !blockedFallback(
      x,
      y,
      r
    );

  }


  return !blockedByMap(
    x,
    y,
    r
  );

}


/* =========================
   MOVIMENTO COM SLIDE
========================= */

function move(
  o,
  dx,
  dy
) {

  const len =
    Math.hypot(
      dx,
      dy
    );


  if (!len) {

    o.vx = 0;
    o.vy = 0;

    return false;

  }


  const steps =
    Math.max(
      1,
      Math.ceil(
        len / MOVE_STEP
      )
    );


  const sx =
    dx / steps;

  const sy =
    dy / steps;


  let moved = false;


  for (
    let i = 0;
    i < steps;
    i++
  ) {

    /*
      Primeiro tenta o movimento
      completo.
    */

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


    /*
      Se diagonal está bloqueada,
      tenta X.
    */

    let mx = false;
    let my = false;


    if (
      walkable(
        o.x + sx,
        o.y,
        o.r
      )
    ) {

      o.x += sx;
      mx = true;

    }


    /*
      Depois tenta Y.
    */

    if (
      walkable(
        o.x,
        o.y + sy,
        o.r
      )
    ) {

      o.y += sy;
      my = true;

    }


    moved =
      moved ||
      mx ||
      my;

  }


  o.vx =
    moved ? dx : 0;

  o.vy =
    moved ? dy : 0;


  return moved;

}


/* =========================
   ENERGIA
========================= */

function seed() {

  const pts = [

    [125,150],
    [355,165],
    [575,205],
    [820,145],
    [1200,155],
    [1400,260],

    [245,330],
    [510,370],
    [720,340],
    [1020,390],
    [1280,430],

    [145,505],
    [385,555],
    [610,600],
    [870,560],
    [1140,595],

    [1380,700],
    [245,720],
    [520,735],
    [800,750],
    [1080,735],
    [1270,780]

  ];


  energy =
    pts.map(
      (p, i) => ({

        x: p[0],
        y: p[1],

        r: 11,

        active: true,

        wait: 0,

        p: i

      })
    );

}


function collect(
  o,
  player
) {

  for (
    const e of energy
  ) {

    if (!e.active)
      continue;


    if (
      Math.hypot(
        o.x - e.x,
        o.y - e.y
      ) <
      o.r + e.r + 6
    ) {

      e.active = false;

      e.wait = 8;


      if (player) {

        o.energy =
          Math.min(
            CFG.maxEnergy,
            o.energy + 100
          );


        o.level =
          Math.min(
            10,
            1 +
            Math.floor(
              o.energy / 250
            )
          );


        burst(
          e.x,
          e.y,
          "#ffd52b",
          14
        );


        text(
          e.x,
          e.y,
          "+100 ENERGIA"
        );


        beep(
          660,
          .07
        );

      } else {

        o.energy =
          Math.min(
            CFG.maxEnergy,
            o.energy + 60
          );

      }

    }

  }

}


/* =========================
   UTILITÁRIOS
========================= */

function dist(a, b) {

  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );

}


function clamp(
  v,
  a,
  b
) {

  return Math.max(
    a,
    Math.min(
      b,
      v
    )
  );

}


function norm(
  x,
  y
) {

  const l =
    Math.hypot(
      x,
      y
    ) || 1;


  return {

    x: x / l,
    y: y / l

  };

}


/* =========================
   HUD
========================= */

function show(
  id,
  on
) {

  $(id).classList.toggle(
    "hidden",
    !on
  );

}


function message(
  t,
  s = 1.6
) {

  $("message").textContent = t;

  $("message").classList.add(
    "show"
  );

  msgT = s;

}


function beep(
  f = 440,
  d = .06
) {

  if (muted)
    return;


  try {

    audio ||= new(
      window.AudioContext ||
      window.webkitAudioContext
    )();


    const o =
      audio.createOscillator();

    const g =
      audio.createGain();


    o.type =
      "sine";

    o.frequency.value =
      f;

    g.gain.value =
      .035;


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


/* =========================
   BOTÕES
========================= */

$("startBtn").onclick =
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

  };


document
  .querySelectorAll(
    "[data-difficulty]"
  )
  .forEach(
    b =>
      b.onclick =
        () => {

          choice =
            b.dataset.difficulty;

          start();

        }
  );


$("pauseBtn").onclick =
  togglePause;


$("resumeBtn").onclick =
  togglePause;


$("soundBtn").onclick =
  () => {

    muted =
      !muted;

    $("soundBtn").textContent =
      muted
        ? "🔇"
        : "🔊";


    if (!muted)
      beep(
        520,
        .05
      );

  };


$("restartBtn").onclick =
  () => {

    show(
      "result",
      false
    );

    show(
      "difficulty",
      true
    );

  };


/* =========================
   INICIAR
========================= */

async function start() {

  await requestLandscape();


  const d =
    diff[choice];


  /* SANDER */

  sand.x = 130;
  sand.y = 145;

  sand.hp = 100;
  sand.energy = 0;

  sand.level = 1;

  sand.atk = 0;
  sand.special = 0;
  sand.tp = 0;

  sand.vx = 0;
  sand.vy = 0;


  /* NÉMESIS */

  nem.x = 1125;
  nem.y = 185;

  nem.maxHp =
    d.hp;

  nem.hp =
    d.hp;

  nem.energy = 0;
  nem.level = 1;

  nem.atk = 0;
  nem.special = 0;

  nem.target =
    sand;

  nem.state =
    "hunt";

  nem.freeze =
    0;

  nem.stuck =
    0;

  nem.repath =
    0;

  nem.vx = 0;
  nem.vy = 0;


  elapsed = 0;

  energy = [];
  parts = [];
  texts = [];


  seed();


  camera.x =
    clamp(
      sand.x,
      W /
      (2 * VIEW_ZOOM),
      MAP.w -
      W /
      (2 * VIEW_ZOOM)
    );


  camera.y =
    clamp(
      sand.y,
      H /
      (2 * VIEW_ZOOM),
      MAP.h -
      H /
      (2 * VIEW_ZOOM)
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


  last =
    performance.now();


  message(
    "Recolha energia. Némesis também está evoluindo!",
    2.5
  );


  requestAnimationFrame(
    loop
  );

}


/* =========================
   FINAL
========================= */

function finish(
  win
) {

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

      ? `Némesis foi derrotado. Sander terminou com ${Math.round(sand.hp)}% de vida.`

      : "A energia de Sander chegou a zero.";


  beep(
    win ? 880 : 110,
    .22
  );

}


/* =========================
   PAUSA
========================= */

function togglePause() {

  if (!game)
    return;


  paused =
    !paused;


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


/* =========================
   TECLADO
========================= */

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


    if (
      k === "Escape"
    ) {

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


/* =========================
   CONTROLES TOUCH
========================= */

document
  .querySelectorAll(
    "#touch button"
  )
  .forEach(
    b => {

      const k =
        b.dataset.key;


      const down =
        e => {

          e.preventDefault();

          keys.add(k);


          if (k === "z")
            attack();

          if (k === "x")
            special();

          if (k === "c")
            teleport();

        };


      const up =
        e => {

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

    }
  );


/* =========================
   AÇÕES DO JOGADOR
========================= */

function actions() {

  if (!game || paused)
    return;


  let dx = 0;
  let dy = 0;


  if (
    keys.has("ArrowUp") ||
    keys.has("w")
  ) {

    dy -= 1;

  }


  if (
    keys.has("ArrowDown") ||
    keys.has("s")
  ) {

    dy += 1;

  }


  if (
    keys.has("ArrowLeft") ||
    keys.has("a")
  ) {

    dx -= 1;

  }


  if (
    keys.has("ArrowRight") ||
    keys.has("d")
  ) {

    dx += 1;

  }


  if (
    dx !== 0 ||
    dy !== 0
  ) {

    const n =
      norm(dx, dy);


    sand.f.x =
      n.x;

    sand.f.y =
      n.y;


    move(
      sand,
      n.x *
      CFG.speed *
      .016,
      n.y *
      CFG.speed *
      .016
    );

  }


  if (
    keys.has("z")
  ) {

    attack();

  }


  if (
    keys.has("x")
  ) {

    special();

  }


  if (
    keys.has("c")
  ) {

    teleport();

  }

}


/* =========================
   UPDATE PLAYER
========================= */

function updatePlayer(dt) {

  sand.inv =
    Math.max(
      0,
      sand.inv - dt
    );


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


  collect(
    sand,
    true
  );

}


/* =========================
   IA DO NÉMESIS
========================= */

function updateEnemy(dt) {

  const d =
    diff[choice];


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
      (nem.freeze || 0) - dt
    );


  nem.target =
    sand;


  nem.state =
    "hunt";


  const dp =
    dist(
      nem,
      sand
    );


  /*
    NÉMESIS CONGELADO
  */

  if (
    nem.freeze > 0
  ) {

    nem.vx = 0;
    nem.vy = 0;


    if (
      Math.random() < .08
    ) {

      burst(
        nem.x +
        (Math.random() - .5) * 25,

        nem.y +
        (Math.random() - .5) * 25,

        "#72eaff",

        2
      );

    }

  }

  else {

    /*
      Direção para Sander.
    */

    const v =
      norm(
        sand.x - nem.x,
        sand.y - nem.y
      );


    nem.f =
      v;


    const sp =
      CFG.nSpeed *
      d.speed *
      (
        1 +
        Math.min(
          5,
          nem.level - 1
        ) * .025
      );


    /*
      Tenta ir diretamente até Sander.
    */

    let moved =
      move(
        nem,
        v.x * sp * dt,
        v.y * sp * dt
      );


    /*
      Se encontrou obstáculo,
      procura uma direção alternativa.
    */

    if (!moved) {

      const options = [];


      for (
        let i = 0;
        i < 16;
        i++
      ) {

        const a =
          Math.PI *
          2 *
          i /
          16;


        const n = {

          x: Math.cos(a),

          y: Math.sin(a)

        };


        if (
          walkable(
            nem.x +
            n.x * 18,

            nem.y +
            n.y * 18,

            nem.r
          )
        ) {

          const nx =
            nem.x +
            n.x *
            sp *
            .9 *
            dt;


          const ny =
            nem.y +
            n.y *
            sp *
            .9 *
            dt;


          options.push({

            n,

            d:
              Math.hypot(
                nx - sand.x,
                ny - sand.y
              )

          });

        }

      }


      options.sort(
        (a, b) =>
          a.d - b.d
      );


      if (
        options[0]
      ) {

        moved =
          move(
            nem,

            options[0].n.x *
            sp *
            .9 *
            dt,

            options[0].n.y *
            sp *
            .9 *
            dt
          );

      }

    }


    /*
      Sistema anti-travamento.
    */

    nem.stuck =
      moved
        ? 0
        : (nem.stuck || 0) + dt;


    if (
      nem.stuck > .5
    ) {

      for (
        let radius = 24;
        radius <= 120;
        radius += 24
      ) {

        let found =
          false;


        for (
          let i = 0;
          i < 16;
          i++
        ) {

          const a =
            Math.PI *
            2 *
            i /
            16;


          const x =
            nem.x +
            Math.cos(a) *
            radius;


          const y =
            nem.y +
            Math.sin(a) *
            radius;


          if (
            walkable(
              x,
              y,
              nem.r
            )
          ) {

            nem.x = x;
            nem.y = y;

            found =
              true;

            break;

          }

        }


        if (found)
          break;

      }


      nem.stuck = 0;

    }


    nem.vx =
      v.x * sp;

    nem.vy =
      v.y * sp;

  }


  /*
    Némesis também pode recolher energia.
  */

  collect(
    nem,
    false
  );


  /*
    Ataque normal.
  */

  if (
    dp <
    CFG.atkRange + 8 &&
    nem.atk <= 0
  ) {

    nem.atk =
      1.1 /
      d.brain;


    hurtPlayer(
      (
        7 +
        nem.level * 2
      ) *
      d.damage
    );

  }


  /*
    Ataque especial.
  */

  if (
    dp <
    CFG.specialRange &&
    nem.special <= 0 &&
    nem.energy >= 150 &&
    nem.freeze <= 0
  ) {

    nem.special =
      5 /
      d.brain;


    nem.energy -= 150;


    hurtPlayer(
      (
        12 +
        nem.level * 3
      ) *
      d.damage
    );

  }

}


/* =========================
   DANO AO SANDER
========================= */

function hurtPlayer(
  dmg
) {

  if (
    sand.inv > 0
  )
    return;


  sand.hp =
    Math.max(
      0,
      sand.hp - dmg
    );


  sand.inv =
    .35;


  burst(
    sand.x,
    sand.y,
    "#ff5263",
    9
  );


  text(
    sand.x,
    sand.y,
    `-${Math.round(dmg)}`
  );


  beep(
    120,
    .06
  );


  if (
    sand.hp <= 0
  ) {

    finish(false);

  }

}


/* =========================
   ATAQUE SANDER
========================= */

function attack() {

  if (
    !game ||
    paused ||
    sand.atk > 0
  )
    return;


  sand.atk =
    .38;


  if (
    dist(
      sand,
      nem
    ) <=
    CFG.atkRange
  ) {

    const p =
      12 +
      sand.level * 4;


    nem.hp =
      Math.max(
        0,
        nem.hp - p
      );


    burst(
      nem.x,
      nem.y,
      "#69bfff",
      9
    );


    text(
      nem.x,
      nem.y,
      `-${p}`
    );


    beep(
      180,
      .06
    );


    if (
      nem.hp <= 0
    ) {

      finish(true);

    }

  }

  else {

    message(
      "Némesis está fora do alcance.",
      .7
    );

  }

}


/* =========================
   ESPECIAL / CONGELAMENTO
========================= */

function special() {

  if (
    !game ||
    paused ||
    sand.special > 0
  )
    return;


  sand.special =
    4;


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
      28 +
      sand.level * 8;


    nem.hp =
      Math.max(
        0,
        nem.hp - p
      );


    nem.freeze =
      2.4;


    burst(
      nem.x,
      nem.y,
      "#72eaff",
      26
    );


    text(
      nem.x,
      nem.y,
      `-${p} CONGELADO`
    );


    message(
      "NÉMESIS CONGELADO!",
      1.2
    );


    beep(
      110,
      .14
    );


    if (
      nem.hp <= 0
    ) {

      finish(true);

    }

  }

  else {

    const n =
      norm(
        nem.x - sand.x,
        nem.y - sand.y
      );


    burst(
      sand.x +
      n.x * 70,

      sand.y +
      n.y * 70,

      "#8fd8ff",
      14
    );


    message(
      "Especial lançado!",
      .7
    );


    beep(
      520,
      .08
    );

  }

}


/* =========================
   TELEPORTE
========================= */

function teleport() {

  if (
    !game ||
    paused ||
    sand.tp > 0
  )
    return;


  let tx =
    sand.x;

  let ty =
    sand.y;


  for (
    let i = 1;
    i <= 8;
    i++
  ) {

    const nx =
      sand.x +
      sand.f.x *
      260 *
      i /
      8;


    const ny =
      sand.y +
      sand.f.y *
      260 *
      i /
      8;


    if (
      walkable(
        nx,
        ny,
        sand.r
      )
    ) {

      tx = nx;
      ty = ny;

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
    CFG.tp;


  burst(
    tx,
    ty,
    "#5effd2",
    28
  );


  beep(
    880,
    .13
  );


  message(
    "TELEPORTE EXECUTADO!",
    .9
  );

}


/* =========================
   UPDATE GERAL
========================= */

function update(
  dt
) {

  elapsed += dt;


  if (
    elapsed >= CFG.time
  ) {

    finish(false);

    return;

  }


  updateEnergy(dt);

  updatePlayer(dt);

  updateEnemy(dt);


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


  /*
    Câmera acompanha Sander.
  */

  const viewW =
    W /
    VIEW_ZOOM;


  const viewH =
    H /
    VIEW_ZOOM;


  const targetCamX =
    clamp(
      sand.x,
      viewW / 2,
      MAP.w - viewW / 2
    );


  const targetCamY =
    clamp(
      sand.y,
      viewH / 2,
      MAP.h - viewH / 2
    );


  camera.x +=
    (
      targetCamX -
      camera.x
    ) *
    Math.min(
      1,
      dt * 8
    );


  camera.y +=
    (
      targetCamY -
      camera.y
    ) *
    Math.min(
      1,
      dt * 8
    );


  /*
    HUD
  */

  $("sanderHp").style.width =
    sand.hp + "%";


  $("sanderEnergy").style.width =
    (sand.energy / 10) + "%";


  $("nemesisHp").style.width =
    (
      nem.hp /
      nem.maxHp *
      100
    ) + "%";


  $("timer").textContent =
    timeLeft();


  $("teleportStatus").textContent =
    sand.tp <= 0

      ? "TELEPORTE: PRONTO"

      : `TELEPORTE: ${Math.ceil(sand.tp)}s`;


  $("distanceInfo").textContent =
    `NÉMESIS: ${Math.round(dist(sand,nem))}m`;


  $("energyInfo").textContent =
    `ENERGIA: ${Math.round(sand.energy)} | NÍVEL ${sand.level}`;


  const nd =
    $("nemesis-direction");


  if (nd) {

    const sx =
      (
        nem.x -
        camera.x
      ) *
      VIEW_ZOOM +
      W / 2;


    const sy =
      (
        nem.y -
        camera.y
      ) *
      VIEW_ZOOM +
      H / 2;


    const inside =
      sx >= 0 &&
      sy >= 0 &&
      sx <= W &&
      sy <= H;


    if (inside) {

      nd.textContent =
        nem.freeze > 0

          ? `NÉMESIS CONGELADO • ${nem.freeze.toFixed(1)}s`

          : "NÉMESIS VISÍVEL";


      nd.style.opacity =
        ".9";

    }

    else {

      const dx =
        nem.x -
        camera.x;


      const dy =
        nem.y -
        camera.y;


      nd.textContent =
        `NÉMESIS ${Math.round(dist(sand,nem))}m • ${
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
              )
        }`;


      nd.style.opacity =
        "1";

    }

  }


  if (
    msgT > 0
  ) {

    msgT -= dt;


    if (
      msgT <= 0
    ) {

      $("message")
        .classList
        .remove(
          "show"
        );

    }

  }

}


/* =========================
   ENERGIA
========================= */

function updateEnergy(dt) {

  for (
    const e of energy
  ) {

    if (
      e.active
    )
      continue;


    e.wait -= dt;


    if (
      e.wait <= 0
    ) {

      /*
        A energia reaparece.
      */

      e.active =
        true;

    }

  }

}


/* =========================
   TEMPO
========================= */

function timeLeft() {

  let s =
    Math.ceil(
      CFG.time -
      elapsed
    );


  let m =
    Math.floor(
      s / 60
    );


  let r =
    s % 60;


  return `${
    String(m).padStart(
      2,
      "0"
    )
  }:${
    String(r).padStart(
      2,
      "0"
    )
  }`;

}


/* =========================
   DESENHAR MAPA
========================= */

function world() {

  if (
    mapOK
  ) {

    ctx.drawImage(
      imgs.map,
      0,
      0,
      MAP.w,
      MAP.h
    );

  }

  else {

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


    ctx.fillStyle =
      "#0a441b";


    for (
      const o of
      fallbackBlocks
    ) {

      ctx.fillRect(
        o.x,
        o.y,
        o.w,
        o.h
      );

    }


    ctx.fillStyle =
      "#fff";


    ctx.font =
      "900 30px system-ui";


    ctx.fillText(
      "ESTAÇÃO PAULISTA",
      590,
      105
    );

  }

}


/* =========================
   DESENHAR ENERGIA
========================= */

function drawEnergy() {

  for (
    const e of energy
  ) {

    if (
      !e.active
    )
      continue;


    const b =
      Math.sin(
        elapsed * 3 +
        e.p
      ) * 3;


    ctx.save();


    ctx.translate(
      e.x,
      e.y + b
    );


    ctx.shadowBlur =
      18;


    ctx.shadowColor =
      "#ffd52b";


    ctx.fillStyle =
      "#fff5a4";


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


    ctx.restore();

  }

}


/* =========================
   PERSONAGENS
========================= */

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
    (
      player &&
      sanderOK
    ) ||
    (
      !player &&
      nemesisOK
    )
  ) {

    const im =
      player
        ? imgs.sander
        : imgs.nemesis;


    const cols =
      4;


    const rows =
      4;


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
      ) > .1;


    const actionRow =
      0;


    let col =
      moving
        ? Math.floor(
            elapsed * 8
          ) % 4
        : 0;


    const row =
      actionRow;


    const size =
      player

        ? Math.max(
            92,
            o.r * 4.0
          )

        : Math.max(
            104,
            o.r * 4.3
          );


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

  else if (
    player
  ) {

    ctx.fillStyle =
      "#167fe4";


    ctx.beginPath();


    ctx.arc(
      0,
      -2,
      o.r,
      0,
      Math.PI * 2
    );


    ctx.fill();

  }

  else {

    ctx.fillStyle =
      "#f3f3ec";


    ctx.beginPath();


    ctx.ellipse(
      0,
      0,
      o.r * .9,
      o.r * 1.1,
      0,
      0,
      Math.PI * 2
    );


    ctx.fill();

  }


  /*
    Efeito de congelamento.
  */

  if (
    !player &&
    nem.freeze > 0
  ) {

    ctx.strokeStyle =
      "#72eaff";


    ctx.lineWidth =
      4;


    ctx.shadowBlur =
      18;


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


  /*
    Aura de evolução.
  */

  if (
    o.level > 1
  ) {

    ctx.strokeStyle =
      player
        ? "#4ecbffaa"
        : "#ffb545aa";


    ctx.lineWidth =
      3;


    ctx.shadowBlur =
      15;


    ctx.shadowColor =
      ctx.strokeStyle;


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


  /*
    Barra de vida.
  */

  const hp =
    player
      ? o.hp / 100
      : o.hp / o.maxHp;


  ctx.shadowBlur =
    0;


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


/* =========================
   DESENHAR JOGO
========================= */

function draw() {

  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  ctx.save();


  ctx.translate(
    W / 2,
    H / 2
  );


  ctx.scale(
    VIEW_ZOOM,
    VIEW_ZOOM
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


  /*
    Partículas.
  */

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
      3 / VIEW_ZOOM,
      0,
      Math.PI * 2
    );


    ctx.fill();

  }


  ctx.globalAlpha =
    1;


  /*
    Textos de dano.
  */

  for (
    const t of texts
  ) {

    ctx.globalAlpha =
      t.life;


    ctx.font =
      `900 ${
        14 / VIEW_ZOOM
      }px system-ui`;


    ctx.textAlign =
      "center";


    ctx.fillStyle =
      "#fff";


    ctx.strokeStyle =
      "#000b";


    ctx.lineWidth =
      4 / VIEW_ZOOM;


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


/* =========================
   MINIMAPA
========================= */

function buildRoadMini() {

  const mw =
    420;


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
    MAP.w /
    mw;


  const sy =
    MAP.h /
    mh;


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

      const wx =
        (x + .5) *
        sx;


      const wy =
        (y + .5) *
        sy;


      let ok =
        pathPixel(
          wx,
          wy
        );


      if (!ok) {

        for (
          const q of [
            [-2,0],
            [2,0],
            [0,-2],
            [0,2]
          ]
        ) {

          if (
            pathPixel(
              wx +
              q[0] * sx,

              wy +
              q[1] * sy
            )
          ) {

            ok = true;

            break;

          }

        }

      }


      if (ok) {

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


/* =========================
   DESENHAR MINIMAPA
========================= */

function drawMini() {

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


  /*
    Estação.
  */

  mctx.fillStyle =
    "#ffffff66";


  mctx.beginPath();


  mctx.arc(
    700 /
    MAP.w *
    mw,

    72 /
    MAP.h *
    mh,

    2.5,

    0,
    Math.PI * 2
  );


  mctx.fill();


  /*
    Energias.
  */

  for (
    const e of energy
  ) {

    if (
      e.active
    ) {

      mctx.fillStyle =
        "#ffd52b99";


      mctx.beginPath();


      mctx.arc(
        e.x /
        MAP.w *
        mw,

        e.y /
        MAP.h *
        mh,

        1.8,

        0,
        Math.PI * 2
      );


      mctx.fill();

    }

  }


  /*
    Área da câmera.
  */

  const viewW =
    Math.min(
      MAP.w,
      W /
      VIEW_ZOOM
    );


  const viewH =
    Math.min(
      MAP.h,
      H /
      VIEW_ZOOM
    );


  mctx.strokeStyle =
    "#ffffff55";


  mctx.lineWidth =
    1;


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


  /*
    Marcador Sander.
  */

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


  /*
    Marcador Némesis.
  */

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


/* =========================
   EFEITOS
========================= */

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
        Math.cos(a) * s,

      vy:
        Math.sin(a) * s,

      life:
        .45 +
        Math.random() * .5,

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


/* =========================
   LOOP
========================= */

function loop(now) {

  if (
    !game ||
    paused
  )
    return;


  const dt =
    Math.min(
      (now - last) / 1000,
      .035
    );


  last =
    now;


  actions();

  update(dt);

  draw();


  requestAnimationFrame(
    loop
  );

}


/* =========================
   INICIALIZAÇÃO
========================= */

drawMini();

})();
