/**
 * 坦克大战 - 纯逻辑游戏引擎
 * 所有坐标以「格」为单位，TILE = 16 像素（渲染时放大）。
 * 地图 26 x 26 格。
 */

export const TILE = 16;
export const COLS = 26;
export const ROWS = 26;

export type Dir = 0 | 1 | 2 | 3; // 上 右 下 左

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

export enum Tile {
  Empty = 0,
  Brick = 1, // 砖墙，可被打碎
  Steel = 2, // 钢墙，需要火力 2 才能打碎
  Water = 3, // 水，坦克不可通过，子弹可穿过
  Grass = 4, // 草丛，坦克可通过，遮挡视线（绘制在顶层）
  Base = 5, // 基地
}

export type Side = "player" | "enemy";

export interface Bullet {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  power: number;
  side: Side;
  dead: boolean;
  owner: number;
}

export interface Tank {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  side: Side;
  speed: number;
  size: number; // 碰撞盒边长（格）
  hp: number;
  maxHp: number;
  cooldown: number;
  bulletSpeed: number;
  bulletPower: number;
  maxBullets: number;
  activeBullets: number;
  dead: boolean;
  // AI
  aiTimer: number;
  aiDir: Dir;
  // 出生保护动画
  spawnTimer: number;
  // 渲染动画
  moving: boolean;
  trackPhase: number;
  kind: "player" | "basic" | "fast" | "power" | "armor";
}

export type GameStatus = "playing" | "paused" | "won" | "lost";

export interface GameState {
  map: Tile[][];
  tanks: Tank[];
  bullets: Bullet[];
  particles: Particle[];
  player: Tank | null;
  playerCooldown: number;
  status: GameStatus;
  lives: number;
  score: number;
  level: number;
  remaining: number; // 本关剩余敌人
  spawnQueue: number; // 待生成数量
  spawnCooldown: number;
  baseAlive: boolean;
  nextId: number;
  time: number;
  shake: number;
  respawnTimer: number;
  messages: { text: string; ttl: number; color: string }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

const BASE_ROW = ROWS - 3;

function emptyMap(): Tile[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => Tile.Empty));
}

/** 生成关卡地图 */
export function buildLevel(level: number): Tile[][] {
  const map = emptyMap();
  const rng = mulberry32(1234 + level * 977);

  // 砖块图案
  for (let r = 2; r < ROWS - 5; r += 4) {
    for (let c = 2; c < COLS - 2; c += 4) {
      const h = 2 + Math.floor(rng() * 2);
      const w = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          const rr = r + i;
          const cc = c + j;
          if (rr < ROWS - 4 && cc < COLS - 1 && map[rr][cc] === Tile.Empty) {
            map[rr][cc] = Tile.Brick;
          }
        }
      }
    }
  }

  // 钢墙
  const steelCount = 4 + level * 2;
  for (let i = 0; i < steelCount; i++) {
    const r = 3 + Math.floor(rng() * (ROWS - 10));
    const c = 3 + Math.floor(rng() * (COLS - 6));
    for (let k = 0; k < 2; k++) {
      map[r][c + k] = Tile.Steel;
      map[r + 1][c + k] = Tile.Steel;
    }
  }

  // 水域
  for (let i = 0; i < 2 + level; i++) {
    const r = 4 + Math.floor(rng() * (ROWS - 12));
    const c = 4 + Math.floor(rng() * (COLS - 8));
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) map[r + a][c + b] = Tile.Water;
    }
  }

  // 草丛
  for (let i = 0; i < 6 + level; i++) {
    const r = 2 + Math.floor(rng() * (ROWS - 8));
    const c = 2 + Math.floor(rng() * (COLS - 6));
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 3; b++) {
        if (map[r + a]?.[c + b] === Tile.Empty) map[r + a][c + b] = Tile.Grass;
      }
    }
  }

  // 清空出生点与通道
  const clearArea = (r0: number, c0: number, r1: number, c1: number) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map[r]?.[c] !== undefined) map[r][c] = Tile.Empty;
      }
    }
  };
  clearArea(BASE_ROW - 1, 11, ROWS - 1, 14); // 基地
  clearArea(BASE_ROW - 1, 7, BASE_ROW, 9); // 玩家
  for (let c = 0; c < COLS; c += 6) clearArea(0, c, 1, Math.min(COLS - 1, c + 1)); // 敌人出生点
  map[ROWS - 3][12] = Tile.Empty;

  // 基地
  map[BASE_ROW + 1][12] = Tile.Base;
  map[BASE_ROW + 1][13] = Tile.Base;
  map[BASE_ROW][12] = Tile.Base;
  map[BASE_ROW][13] = Tile.Base;
  // 基地砖墙
  for (let c = 11; c <= 14; c++) {
    if (map[BASE_ROW - 1][c] === Tile.Empty) map[BASE_ROW - 1][c] = Tile.Brick;
  }
  map[BASE_ROW][11] = Tile.Brick;
  map[BASE_ROW][14] = Tile.Brick;

  return map;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPlayer(id: number, x: number, y: number): Tank {
  return {
    id,
    x,
    y,
    dir: 0,
    side: "player",
    speed: 4.6,
    size: 1.6,
    hp: 1,
    maxHp: 1,
    cooldown: 0,
    bulletSpeed: 15,
    bulletPower: 1,
    maxBullets: 2,
    activeBullets: 0,
    dead: false,
    aiTimer: 0,
    aiDir: 0,
    spawnTimer: 0.9,
    moving: false,
    trackPhase: 0,
    kind: "player",
  };
}

const ENEMY_KINDS: {
  kind: Tank["kind"];
  speed: number;
  hp: number;
  bulletSpeed: number;
  bulletPower: number;
  maxBullets: number;
}[] = [
  { kind: "basic", speed: 2.6, hp: 1, bulletSpeed: 9, bulletPower: 1, maxBullets: 1 },
  { kind: "fast", speed: 4.0, hp: 1, bulletSpeed: 11, bulletPower: 1, maxBullets: 1 },
  { kind: "power", speed: 2.8, hp: 1, bulletSpeed: 14, bulletPower: 2, maxBullets: 2 },
  { kind: "armor", speed: 2.2, hp: 3, bulletSpeed: 9, bulletPower: 1, maxBullets: 1 },
];

export function createEnemy(id: number, x: number, y: number, level: number, rng: () => number): Tank {
  const roll = rng();
  let idx = 0;
  if (roll > 0.85) idx = 3;
  else if (roll > 0.6) idx = 2;
  else if (roll > 0.3) idx = 1;
  const spec = ENEMY_KINDS[idx];
  const speedBoost = Math.min(1.4, 1 + (level - 1) * 0.06);
  return {
    id,
    x,
    y,
    dir: 2,
    side: "enemy",
    speed: spec.speed * speedBoost,
    size: 1.6,
    hp: spec.hp,
    maxHp: spec.hp,
    cooldown: 0,
    bulletSpeed: spec.bulletSpeed,
    bulletPower: spec.bulletPower,
    maxBullets: spec.maxBullets,
    activeBullets: 0,
    dead: false,
    aiTimer: 0,
    aiDir: 2,
    spawnTimer: 1.1,
    moving: false,
    trackPhase: 0,
    kind: spec.kind,
  };
}

export function createGame(level = 1, lives = 3, score = 0): GameState {
  const state: GameState = {
    map: buildLevel(level),
    tanks: [],
    bullets: [],
    particles: [],
    player: null,
    playerCooldown: 0,
    status: "playing",
    lives,
    score,
    level,
    remaining: 6 + level * 2,
    spawnQueue: 6 + level * 2,
    spawnCooldown: 0.5,
    baseAlive: true,
    nextId: 1,
    time: 0,
    shake: 0,
    respawnTimer: 1.0,
    messages: [],
  };
  spawnPlayer(state);
  return state;
}

function spawnPlayer(state: GameState) {
  const id = state.nextId++;
  const tank = createPlayer(id, 7.7, BASE_ROW - 1.2);
  state.tanks.push(tank);
  state.player = tank;
}

export const BASE_ENEMY_SPAWNS = [0.7, 5.7, 11.7, 17.7, 23.7];

export function isSolidForTank(t: Tile): boolean {
  return t === Tile.Brick || t === Tile.Steel || t === Tile.Water || t === Tile.Base;
}

function setTile(state: GameState, c: number, r: number, t: Tile) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (r >= state.map.length || c >= state.map[r].length) return;
  state.map[r][c] = t;
}

function tileAt(map: Tile[][], c: number, r: number): Tile {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return Tile.Steel;
  return map[r][c];
}

/** 矩形与地图碰撞检测 */
function rectHitsMap(map: Tile[][], x: number, y: number, size: number): boolean {
  const minC = Math.floor(x);
  const maxC = Math.floor(x + size - 1e-6);
  const minR = Math.floor(y);
  const maxR = Math.floor(y + size - 1e-6);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (isSolidForTank(tileAt(map, c, r))) return true;
    }
  }
  return false;
}

function tankOverlap(a: { x: number; y: number; size: number }, b: { x: number; y: number; size: number }) {
  return (
    a.x < b.x + b.size &&
    a.x + a.size > b.x &&
    a.y < b.y + b.size &&
    a.y + a.size > b.y
  );
}

/** 爆炸粒子 */
function explode(state: GameState, x: number, y: number, big = false) {
  const count = big ? 26 : 10;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (big ? 2 : 1) * (0.8 + Math.random() * 3);
    state.particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color: Math.random() > 0.5 ? "#ffcc33" : Math.random() > 0.4 ? "#ff7a18" : "#ff3b30",
      size: big ? 0.15 + Math.random() * 0.25 : 0.1 + Math.random() * 0.15,
    });
  }
}

function spawnBullet(state: GameState, tank: Tank) {
  if (tank.cooldown > 0) return;
  if (tank.activeBullets >= tank.maxBullets) return;
  const cx = tank.x + tank.size / 2;
  const cy = tank.y + tank.size / 2;
  const v = DIR_VEC[tank.dir];
  const offset = tank.size / 2 + 0.15;
  const b: Bullet = {
    id: state.nextId++,
    x: cx + v.x * offset - 0.15,
    y: cy + v.y * offset - 0.15,
    dir: tank.dir,
    speed: tank.bulletSpeed,
    power: tank.bulletPower,
    side: tank.side,
    dead: false,
    owner: tank.id,
  };
  state.bullets.push(b);
  tank.activeBullets++;
  tank.cooldown = tank.side === "player" ? 0.2 : 0.75;
}

function moveTank(state: GameState, tank: Tank, dir: Dir, dt: number) {
  tank.dir = dir;
  const v = DIR_VEC[dir];
  const step = tank.speed * dt;
  // 轴对齐：转弯时对齐到网格中心，避免卡住（带容差以顺滑通过窄通道）
  const snap = Math.min(step * 1.5, 0.5);
  if (v.x !== 0) {
    const targetCenter = Math.round(tank.y + tank.size / 2);
    const diff = targetCenter - (tank.y + tank.size / 2);
    if (Math.abs(diff) <= snap) tank.y += diff;
  } else {
    const targetCenter = Math.round(tank.x + tank.size / 2);
    const diff = targetCenter - (tank.x + tank.size / 2);
    if (Math.abs(diff) <= snap) tank.x += diff;
  }

  const nx = tank.x + v.x * step;
  const ny = tank.y + v.y * step;

  if (!rectHitsMap(state.map, nx, ny, tank.size) && !hitsOtherTank(state, tank, nx, ny)) {
    tank.x = nx;
    tank.y = ny;
    tank.moving = true;
    tank.trackPhase += step;
  } else {
    tank.moving = false;
    // 贴墙时用整格对齐滑入
    let slid = false;
    if (v.y !== 0) {
      const target = Math.round(tank.x);
      if (Math.abs(target - tank.x) > 0.01) {
        const d = Math.sign(target - tank.x) * Math.min(Math.abs(target - tank.x), step);
        if (!rectHitsMap(state.map, tank.x + d, tank.y, tank.size)) {
          tank.x += d;
          slid = true;
        }
      }
    } else {
      const target = Math.round(tank.y);
      if (Math.abs(target - tank.y) > 0.01) {
        const d = Math.sign(target - tank.y) * Math.min(Math.abs(target - tank.y), step);
        if (!rectHitsMap(state.map, tank.x, tank.y + d, tank.size)) {
          tank.y += d;
          slid = true;
        }
      }
    }
    if (slid) tank.moving = true;
  }
  tank.x = Math.max(0, Math.min(COLS - tank.size, tank.x));
  tank.y = Math.max(0, Math.min(ROWS - tank.size, tank.y));
}

function hitsOtherTank(state: GameState, self: Tank, nx: number, ny: number): boolean {
  const box = { x: nx, y: ny, size: self.size };
  for (const other of state.tanks) {
    if (other.id === self.id || other.dead || other.spawnTimer > 0) continue;
    if (tankOverlap(box, other)) return true;
  }
  return false;
}

function updateBullets(state: GameState, dt: number) {
  for (const b of state.bullets) {
    if (b.dead) continue;
    const v = DIR_VEC[b.dir];
    const dist = b.speed * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    const stepLen = dist / steps;
    for (let s = 0; s < steps && !b.dead; s++) {
      b.x += v.x * stepLen;
      b.y += v.y * stepLen;

      if (b.x + 0.15 < 0 || b.y + 0.15 < 0 || b.x + 0.15 >= COLS || b.y + 0.15 >= ROWS) {
        b.dead = true;
        break;
      }

      // 与地图碰撞
      const bc = Math.floor(b.x + 0.15);
      const br = Math.floor(b.y + 0.15);
      const t = tileAt(state.map, bc, br);
      if (t === Tile.Brick) {
        setTile(state, bc, br, Tile.Empty);
        // 破坏相邻砖块，打洞更自然
        if (v.x !== 0) {
          if (state.map[br - 1]?.[bc] === Tile.Brick && Math.random() > 0.4) setTile(state, bc, br - 1, Tile.Empty);
          if (state.map[br + 1]?.[bc] === Tile.Brick && Math.random() > 0.4) setTile(state, bc, br + 1, Tile.Empty);
        } else {
          if (state.map[br]?.[bc - 1] === Tile.Brick && Math.random() > 0.4) setTile(state, bc - 1, br, Tile.Empty);
          if (state.map[br]?.[bc + 1] === Tile.Brick && Math.random() > 0.4) setTile(state, bc + 1, br, Tile.Empty);
        }
        b.dead = true;
        explode(state, bc, br, false);
        break;
      }
      if (t === Tile.Steel) {
        if (b.power >= 2) setTile(state, bc, br, Tile.Empty);
        b.dead = true;
        explode(state, bc, br, false);
        break;
      }
      if (t === Tile.Base) {
        setTile(state, bc, br, Tile.Empty);
        state.baseAlive = false;
        b.dead = true;
        explode(state, bc, br, true);
        state.shake = 0.5;
        // 基地其余部分一并摧毁
        for (let r = BASE_ROW; r <= BASE_ROW + 1; r++) {
          for (let c = 12; c <= 13; c++) if (state.map[r]?.[c] === Tile.Base) setTile(state, c, r, Tile.Empty);
        }
        loseGame(state);
        break;
      }

      // 与坦克碰撞
      for (const tank of state.tanks) {
        if (tank.dead || tank.id === b.owner) continue;
        if (tank.spawnTimer > 0) continue;
        if (tank.side === b.side) continue; // 友军不互相伤害
        if (
          b.x + 0.15 > tank.x &&
          b.x + 0.15 < tank.x + tank.size &&
          b.y + 0.15 > tank.y &&
          b.y + 0.15 < tank.y + tank.size
        ) {
          b.dead = true;
          tank.hp -= b.power;
          if (tank.hp <= 0) {
            tank.dead = true;
            explode(state, tank.x, tank.y, true);
            state.shake = Math.max(state.shake, 0.25);
            if (tank.side === "enemy") {
              state.remaining--;
              state.score += tank.kind === "armor" ? 400 : tank.kind === "power" ? 300 : tank.kind === "fast" ? 200 : 100;
            } else {
              onPlayerDeath(state);
            }
          } else {
            explode(state, bc, br, false);
          }
          break;
        }
      }

      // 子弹互相抵消
      if (!b.dead) {
        for (const other of state.bullets) {
          if (other.dead || other.id === b.id || other.side === b.side) continue;
          if (Math.abs(other.x - b.x) < 0.35 && Math.abs(other.y - b.y) < 0.35) {
            b.dead = true;
            other.dead = true;
            explode(state, b.x, b.y, false);
            break;
          }
        }
      }
    }
  }

  for (const b of state.bullets) {
    if (b.dead) {
      const owner = state.tanks.find((t) => t.id === b.owner);
      if (owner) owner.activeBullets = Math.max(0, owner.activeBullets - 1);
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

function onPlayerDeath(state: GameState) {
  state.lives--;
  state.player = null;
  if (state.lives <= 0) {
    loseGame(state);
  } else {
    state.messages.push({ text: `剩余生命 ${state.lives}`, ttl: 1.6, color: "#7dd3fc" });
  }
}

function loseGame(state: GameState) {
  state.status = "lost";
  state.messages.push({ text: "游戏失败", ttl: 999, color: "#ff5d5d" });
}

function updateEnemyAI(state: GameState, tank: Tank, dt: number) {
  tank.aiTimer -= dt;
  if (tank.aiTimer <= 0) {
    tank.aiTimer = 0.3 + Math.random() * 0.8;
    const player = state.player;
    let dir: Dir;
    if (player && Math.random() < 0.4) {
      // 朝玩家方向（较少直冲基地）
      const targetX = Math.random() < 0.7 ? player.x : 12;
      const targetY = Math.random() < 0.7 ? player.y : BASE_ROW;
      const dx = targetX - tank.x;
      const dy = targetY - tank.y;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
      else dir = dy > 0 ? 2 : 0;
    } else {
      dir = Math.floor(Math.random() * 4) as Dir;
    }
    tank.aiDir = dir;
  }

  const before = { x: tank.x, y: tank.y };
  moveTank(state, tank, tank.aiDir, dt);
  // 撞墙则换方向
  if (Math.abs(tank.x - before.x) < 1e-4 && Math.abs(tank.y - before.y) < 1e-4) {
    tank.aiTimer = 0;
  }

  // 随机开火
  if (tank.cooldown <= 0 && tank.activeBullets < tank.maxBullets) {
    const player = state.player;
    let shouldFire = Math.random() < 0.006;
    // 对准玩家时开火（不无视草丛）
    if (player) {
      const alignedX = Math.abs(player.x - tank.x) < 1.2;
      const alignedY = Math.abs(player.y - tank.y) < 1.2;
      const fireChance = 0.05 + Math.min(0.05, state.level * 0.01);
      if (alignedX && ((player.y > tank.y && tank.dir === 2) || (player.y < tank.y && tank.dir === 0)))
        shouldFire = Math.random() < fireChance;
      if (alignedY && ((player.x > tank.x && tank.dir === 1) || (player.x < tank.x && tank.dir === 3)))
        shouldFire = Math.random() < fireChance;
    }
    // 朝基地
    if (Math.abs(tank.x - 12.5) < 1.5 && tank.dir === 2) shouldFire = Math.random() < 0.012;
    if (shouldFire) spawnBullet(state, tank);
  }
}

function spawnEnemies(state: GameState, dt: number) {
  if (state.spawnQueue <= 0) return;
  const aliveEnemies = state.tanks.filter((t) => t.side === "enemy" && !t.dead).length;
  const maxAlive = Math.min(4, 2 + Math.floor(state.level / 2));
  if (aliveEnemies >= maxAlive) return;
  state.spawnCooldown -= dt;
  if (state.spawnCooldown > 0) return;
  state.spawnCooldown = 1.6;

  const slots = BASE_ENEMY_SPAWNS.slice().sort(() => Math.random() - 0.5);
  for (const sx of slots) {
    const y = 0.2;
    const box = { x: sx, y, size: 1.6 };
    const occupied = state.tanks.some((t) => !t.dead && tankOverlap(box, t));
    if (occupied) continue;
    const rng = Math.random;
    const e = createEnemy(state.nextId++, sx, y, state.level, rng);
    state.tanks.push(e);
    state.spawnQueue--;
    break;
  }
}

export function updateGame(state: GameState, input: InputState, dt: number) {
  if (state.status !== "playing") return;
  dt = Math.min(dt, 1 / 30); // 防止大跳帧
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt);
  for (const m of state.messages) m.ttl -= dt;
  state.messages = state.messages.filter((m) => m.ttl > 0);

  // 生成玩家（延迟重生）
  if (!state.player && state.lives > 0 && state.status === "playing") {
    const hasPlayer = state.tanks.some((t) => t.side === "player" && !t.dead);
    if (!hasPlayer) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) {
        state.respawnTimer = 1.2;
        spawnPlayer(state);
      }
    }
  }

  // 玩家控制
  const player = state.player;
  if (player && !player.dead) {
    if (player.spawnTimer > 0) {
      player.spawnTimer -= dt;
      if (player.spawnTimer <= 0) {
        // 出生保护结束，清除残留输入，避免瞬间开火/移动
        player.cooldown = Math.max(player.cooldown, 0.15);
      }
    } else {
      player.moving = false;
      if (input.up) moveTank(state, player, 0, dt);
      else if (input.down) moveTank(state, player, 2, dt);
      else if (input.left) moveTank(state, player, 3, dt);
      else if (input.right) moveTank(state, player, 1, dt);
      if (input.fire) spawnBullet(state, player);
    }
  }

  // 冷却
  for (const t of state.tanks) {
    if (t.cooldown > 0) t.cooldown -= dt;
    if (t.spawnTimer > 0) t.spawnTimer -= dt;
  }

  // 敌人 AI
  for (const t of state.tanks) {
    if (t.side === "enemy" && !t.dead && t.spawnTimer <= 0) {
      updateEnemyAI(state, t, dt);
    }
  }

  updateBullets(state, dt);
  spawnEnemies(state, dt);

  // 清理死亡坦克
  state.tanks = state.tanks.filter((t) => !t.dead);
  if (state.player && state.player.dead) state.player = null;

  // 粒子
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  // 关卡胜利：所有敌人生成完毕且全部被消灭
  const aliveEnemies = state.tanks.some((t) => t.side === "enemy");
  if (state.spawnQueue <= 0 && !aliveEnemies && state.baseAlive) {
    state.remaining = 0;
    state.status = "won";
    state.messages.push({ text: "关卡通过！", ttl: 999, color: "#4ade80" });
  }
}

export function nextLevel(state: GameState) {
  const totalScore = state.score;
  const level = state.level + 1;
  const newState = createGame(level, state.lives, totalScore);
  Object.assign(state, newState);
}

export function restartGame(state: GameState) {
  Object.assign(state, createGame(1, 3, 0));
}
