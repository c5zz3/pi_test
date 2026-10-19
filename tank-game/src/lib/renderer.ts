import { COLS, DIR_VEC, GameState, ROWS, TILE, Tank, Tile } from "./tank-game";

// 经典配色
const COLORS = {
  brickA: "#b45309",
  brickB: "#8a3d06",
  brickLight: "#d97706",
  steelA: "#9ca3af",
  steelB: "#6b7280",
  steelLight: "#e5e7eb",
  water: "#1d4ed8",
  waterLight: "#3b82f6",
  grass: "#15803d",
  grassLight: "#22c55e",
  base: "#eab308",
};

const TANK_COLORS = {
  player: { body: "#facc15", bodyDark: "#a16207", accent: "#fef3c7", track: "#78350f" },
  basic: { body: "#9ca3af", bodyDark: "#4b5563", accent: "#e5e7eb", track: "#374151" },
  fast: { body: "#38bdf8", bodyDark: "#0369a1", accent: "#e0f2fe", track: "#075985" },
  power: { body: "#f472b6", bodyDark: "#9d174d", accent: "#fce7f3", track: "#831843" },
  armor: { body: "#86efac", bodyDark: "#166534", accent: "#dcfce7", track: "#14532d" },
};

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, scale: number, dpr: number) {
  const tilePx = TILE * scale;
  const w = COLS * tilePx;
  const h = ROWS * tilePx;
  const time = state.time;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 抖动
  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * tilePx * 0.6;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0b0f17");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, w + 40, h + 40);

  // 网格
  ctx.strokeStyle = "rgba(148,163,184,0.05)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c += 2) {
    ctx.beginPath();
    ctx.moveTo(c * tilePx, 0);
    ctx.lineTo(c * tilePx, h);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r += 2) {
    ctx.beginPath();
    ctx.moveTo(0, r * tilePx);
    ctx.lineTo(w, r * tilePx);
    ctx.stroke();
  }

  // 地图（非草丛）
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = state.map[r][c];
      if (t === Tile.Empty || t === Tile.Grass) continue;
      drawTile(ctx, t, c * tilePx, r * tilePx, tilePx, time);
    }
  }

  // 坦克
  for (const tank of state.tanks) {
    drawTank(ctx, tank, tilePx, time);
  }

  // 子弹
  for (const b of state.bullets) {
    const cx = (b.x + 0.15) * tilePx;
    const cy = (b.y + 0.15) * tilePx;
    const r = tilePx * 0.13;
    ctx.save();
    ctx.shadowColor = b.side === "player" ? "#fde047" : "#f87171";
    ctx.shadowBlur = tilePx * 0.6;
    ctx.fillStyle = "#fffbe6";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.side === "player" ? "#fde047" : "#f87171";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    // 拖尾
    const v = DIR_VEC[b.dir];
    const grad = ctx.createLinearGradient(cx - v.x * tilePx * 0.7, cy - v.y * tilePx * 0.7, cx, cy);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, b.side === "player" ? "rgba(253,224,71,0.7)" : "rgba(248,113,113,0.7)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = r * 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - v.x * tilePx * 0.7, cy - v.y * tilePx * 0.7);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
  }

  // 草丛（覆盖在坦克之上）
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.map[r][c] === Tile.Grass) drawTile(ctx, Tile.Grass, c * tilePx, r * tilePx, tilePx, time);
    }
  }

  // 粒子
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const s = p.size * tilePx;
    ctx.fillRect(p.x * tilePx - s / 2, p.y * tilePx - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 屏幕暗角
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  t: Tile,
  x: number,
  y: number,
  s: number,
  time: number
) {
  switch (t) {
    case Tile.Brick: {
      ctx.fillStyle = COLORS.brickB;
      ctx.fillRect(x, y, s, s);
      const half = s / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const bx = x + j * half + 1;
          const by = y + i * half + 1;
          ctx.fillStyle = (i + j) % 2 === 0 ? COLORS.brickA : COLORS.brickLight;
          ctx.fillRect(bx, by, half - 2, half - 2);
        }
      }
      break;
    }
    case Tile.Steel: {
      const half = s / 2;
      ctx.fillStyle = COLORS.steelB;
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const bx = x + j * half + 1;
          const by = y + i * half + 1;
          ctx.fillStyle = COLORS.steelA;
          ctx.fillRect(bx, by, half - 2, half - 2);
          ctx.fillStyle = COLORS.steelLight;
          ctx.fillRect(bx + 1, by + 1, half - 4, Math.max(1, half * 0.2));
        }
      }
      break;
    }
    case Tile.Water: {
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.waterLight;
      for (let i = 0; i < 2; i++) {
        const phase = Math.sin(time * 3 + (x + y) * 0.05 + i * 1.7) * s * 0.15;
        ctx.fillRect(x + s * 0.15 + phase, y + s * (0.25 + i * 0.4), s * 0.5, s * 0.12);
      }
      break;
    }
    case Tile.Grass: {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COLORS.grassLight;
      const blades = 5;
      for (let i = 0; i < blades; i++) {
        const bx = x + (i / blades) * s + s * 0.05;
        const sway = Math.sin(time * 2 + i * 1.3 + x * 0.1) * s * 0.06;
        ctx.beginPath();
        ctx.moveTo(bx, y + s);
        ctx.lineTo(bx + sway, y + s * 0.15);
        ctx.lineTo(bx + s / blades - s * 0.1, y + s);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case Tile.Base: {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(x, y, s, s);
      // 鹰徽简化
      ctx.fillStyle = COLORS.base;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.12);
      ctx.lineTo(x + s * 0.88, y + s * 0.4);
      ctx.lineTo(x + s * 0.75, y + s * 0.88);
      ctx.lineTo(x + s * 0.5, y + s * 0.72);
      ctx.lineTo(x + s * 0.25, y + s * 0.88);
      ctx.lineTo(x + s * 0.12, y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(x + s * 0.42, y + s * 0.3, s * 0.16, s * 0.3);
      break;
    }
  }
}

function drawTank(ctx: CanvasRenderingContext2D, tank: Tank, tilePx: number, time: number) {
  const size = tank.size * tilePx;
  const cx = (tank.x + tank.size / 2) * tilePx;
  const cy = (tank.y + tank.size / 2) * tilePx;
  const colors = TANK_COLORS[tank.kind];
  const rot = (tank.dir * Math.PI) / 2; // 0上 1右 2下 3左

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // 出生保护闪烁
  if (tank.spawnTimer > 0) {
    const blink = Math.floor(time * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.25 : 1;
    // 出生星形特效
    ctx.save();
    ctx.rotate(-rot + time * 6);
    ctx.strokeStyle = "rgba(253,224,71,0.9)";
    ctx.lineWidth = tilePx * 0.1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const a = (i * Math.PI) / 2;
      ctx.moveTo(Math.cos(a) * size * 0.4, Math.sin(a) * size * 0.4);
      ctx.lineTo(Math.cos(a) * size * 0.8, Math.sin(a) * size * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 阴影
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = tilePx * 0.35;
  ctx.shadowOffsetY = tilePx * 0.08;

  const half = size / 2;
  const bodyW = size * 0.62;
  const bodyH = size * 0.78;

  // 履带
  ctx.fillStyle = colors.track;
  const trackW = size * 0.2;
  ctx.fillRect(-half, -half + size * 0.08, trackW, size * 0.84);
  ctx.fillRect(half - trackW, -half + size * 0.08, trackW, size * 0.84);

  // 履带纹路
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  const phase = ((tank.trackPhase * tilePx) / (tilePx * 0.22)) % 1;
  for (let i = 0; i < 5; i++) {
    const ty = -half + size * 0.1 + ((i + phase) / 5) * size * 0.8;
    ctx.fillRect(-half, ty, trackW, Math.max(1, tilePx * 0.05));
    ctx.fillRect(half - trackW, ty, trackW, Math.max(1, tilePx * 0.05));
  }

  // 车体
  const grad = ctx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
  grad.addColorStop(0, colors.bodyDark);
  grad.addColorStop(0.5, colors.body);
  grad.addColorStop(1, colors.bodyDark);
  ctx.fillStyle = grad;
  roundRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, size * 0.12);
  ctx.fill();

  // 车体高光
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, tilePx * 0.05);
  roundRect(ctx, -bodyW / 2 + 1, -bodyH / 2 + 1, bodyW - 2, bodyH - 2, size * 0.1);
  ctx.stroke();

  // 炮塔
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(0, size * 0.02, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.bodyDark;
  ctx.beginPath();
  ctx.arc(0, size * 0.02, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // 炮管
  ctx.fillStyle = "#111827";
  roundRect(ctx, -size * 0.06, -half - size * 0.02, size * 0.12, size * 0.55, size * 0.03);
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.5;
  roundRect(ctx, -size * 0.02, -half - size * 0.02, size * 0.04, size * 0.5, size * 0.02);
  ctx.fill();
  ctx.globalAlpha = tank.spawnTimer > 0 ? ctx.globalAlpha : 1;

  // 血量
  if (tank.maxHp > 1) {
    const hpW = size * 0.8;
    const hpX = -hpW / 2;
    const hpY = -half - size * 0.16;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(hpX, hpY, hpW, size * 0.09);
    ctx.fillStyle = tank.hp / tank.maxHp > 0.5 ? "#4ade80" : tank.hp / tank.maxHp > 0.25 ? "#facc15" : "#f87171";
    ctx.fillRect(hpX, hpY, (hpW * tank.hp) / tank.maxHp, size * 0.09);
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
