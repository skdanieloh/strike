"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

// --- Constants ---
const CANVAS_W = 800;
/** 세로로 긴 플레이 영역 (데스크톱/모바일 공통 논리 해상도) */
const CANVAS_H = 920;
const AUTO_FIRE_MS = 165;
const ENEMY_SPAWN_MIN_MS = 520;
const ENEMY_SPAWN_MAX_MS = 1050;
const PLAYER_SPEED_PX = 440;
const PLAYER_W = 48;
const PLAYER_H = 40;
const MISSILE_W = 6;
const MISSILE_H = 14;
const MISSILE_SPEED = 580;
const ENEMY_BASE_W = 44;
const ENEMY_BASE_H = 36;
const BOSS_W = 120;
const BOSS_H = 80;
const BOSS_SHOOT_MS = 550;
const ENEMY_BULLET_W = 8;
const ENEMY_BULLET_H = 16;
const ENEMY_BULLET_SPEED = 360;
const ITEM_W = 28;
const ITEM_H = 28;
const ITEM_FALL_SPEED = 140;
const DROP_CHANCE = 0.3;
const EXP_PER_KILL = 28;
const NORMAL_ENEMY_MAX_HP = 50;
const BOSS_HP_MULT = 10;
const SCORE_ENEMY = 10;
const SCORE_BOSS = 500;
const RANKING_KEY = "strike-plane-top5";
const MAX_RANK = 5;
/** Boss 등장 직후 플레이어 무적 (몸통/적탄/일반 적 접촉) */
const BOSS_ENTRY_INVULN_MS = 2200;
/** 보스 첫 발사까지 여유 (탄·몸통 겹침 완화) */
const BOSS_FIRST_SHOT_DELAY_MS = 750;
/** 적 탄이 플레이어에게 맞기 시작하기까지 (생성 위치 겹침 방지) */
const ENEMY_BULLET_ARM_MS = 180;
const BOSS_CONTACT_DPS_SCALE = 0.42;
/** 빌드/배포 시 구분용 버전 (화면 하단 표시) */
const GAME_VERSION = "0.6.1";
const STAGE_INTRO_MS = 2400;

const SELECT_CARD_SPREAD = { x: 72, y: 300, w: 300, h: 300 };
const SELECT_CARD_LASER = { x: 428, y: 300, w: 300, h: 300 };

// --- TypeScript types ---
type PlaneType = "spread" | "laser";

type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  attack: number;
  missileCount: number;
  weaponLevel: number;
  planeType: PlaneType;
  level: number;
  exp: number;
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  damage: number;
  vx: number;
  vy: number;
};

type Boss = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  damage: number;
  lastShot: number;
};

type ItemType = "heal" | "missile" | "power";

type Item = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: ItemType;
  vy: number;
};

type Missile = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
  vx: number;
  vy: number;
};

type EnemyBullet = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
  vx: number;
  vy: number;
  /** 이 시각 이전에는 플레이어에게 피해를 주지 않음 (스폰 겹침 방지) */
  armedAfter: number;
};

type LaserVisual = {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  ex: number;
  ey: number;
  thickness: number;
};

type GamePhase = "select" | "playing" | "gameover";

type GameModel = {
  player: Player;
  enemies: Enemy[];
  boss: Boss | null;
  missiles: Missile[];
  enemyBullets: EnemyBullet[];
  items: Item[];
  keys: Record<string, boolean>;
  nextEnemySpawnAt: number;
  nextEnemySpawnDelay: number;
  lastPlayerShot: number;
  score: number;
  phase: GamePhase;
  bossSpawned: boolean;
  nextId: number;
  /** 이 시각(ms)까지 플레이어 피해 무시 (보스 진입 등) */
  playerInvulnerableUntil: number;
  /** 1부터 시작, 보스 격파 시 증가 */
  stage: number;
  /** 이 시각까지 스테이지 시작 안내 오버레이 */
  stageIntroUntil: number;
  laserVisual: LaserVisual | null;
};

// --- Pure helpers ---
function expToNextLevel(level: number): number {
  return 45 + level * 25;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function loadRanking(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RANKING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
      .sort((a, b) => b - a)
      .slice(0, MAX_RANK);
  } catch {
    return [];
  }
}

/** 스테이지가 올라갈수록 체력·공격·속도 배율 */
function getStageDifficulty(stage: number): number {
  return 1 + Math.max(0, stage - 1) * 0.26;
}

/** 보스 HP·공격: 스테이지마다 2.25배 (2x+) */
function getBossStageMult(stage: number): number {
  return Math.pow(2.25, Math.max(0, stage - 1));
}

function saveRankingScore(score: number): number[] {
  const prev = loadRanking();
  const merged = [...prev, score].sort((a, b) => b - a);
  const top = merged.slice(0, MAX_RANK);
  try {
    localStorage.setItem(RANKING_KEY, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  return top;
}

function createInitialPlayer(planeType: PlaneType = "spread"): Player {
  const base = {
    x: CANVAS_W / 2 - PLAYER_W / 2,
    y: CANVAS_H - PLAYER_H - 24,
    w: PLAYER_W,
    h: PLAYER_H,
    hp: 100,
    maxHp: 100,
    level: 1,
    exp: 0,
    planeType,
  };
  if (planeType === "spread") {
    return {
      ...base,
      attack: 28,
      missileCount: 5,
      weaponLevel: 2,
    };
  }
  return {
    ...base,
    attack: 42,
    missileCount: 1,
    weaponLevel: 2,
  };
}

function createGameModel(): GameModel {
  return {
    player: createInitialPlayer(),
    enemies: [],
    boss: null,
    missiles: [],
    enemyBullets: [],
    items: [],
    keys: {},
    nextEnemySpawnAt: 0,
    nextEnemySpawnDelay: randBetween(
      ENEMY_SPAWN_MIN_MS * spawnIntervalScale(1, 1),
      ENEMY_SPAWN_MAX_MS * spawnIntervalScale(1, 1)
    ),
    lastPlayerShot: 0,
    score: 0,
    phase: "select",
    bossSpawned: false,
    nextId: 1,
    playerInvulnerableUntil: 0,
    stage: 1,
    stageIntroUntil: 0,
    laserVisual: null,
  };
}

function randBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function nextId(g: GameModel): number {
  const id = g.nextId;
  g.nextId += 1;
  return id;
}

function spawnIntervalScale(stage: number, level: number): number {
  const stageScale = Math.max(0.68, 1 - (stage - 1) * 0.05);
  const levelScale = Math.max(0.52, 1 - (level - 1) * 0.028);
  return stageScale * levelScale;
}

function waveSizeForLevel(level: number): number {
  return 1 + Math.floor((level - 1) / 2);
}

function beginPlaying(g: GameModel, plane: PlaneType, now: number): void {
  g.player = createInitialPlayer(plane);
  g.enemies = [];
  g.boss = null;
  g.missiles = [];
  g.enemyBullets = [];
  g.items = [];
  g.bossSpawned = false;
  g.score = 0;
  g.stage = 1;
  g.stageIntroUntil = 0;
  g.playerInvulnerableUntil = 0;
  g.laserVisual = null;
  g.phase = "playing";
  g.nextEnemySpawnAt = now + 550;
  g.nextEnemySpawnDelay = randBetween(
    ENEMY_SPAWN_MIN_MS * spawnIntervalScale(1, 1),
    ENEMY_SPAWN_MAX_MS * spawnIntervalScale(1, 1)
  );
  g.lastPlayerShot = now;
}

function trySelectPlane(g: GameModel, x: number, y: number, now: number): boolean {
  if (g.phase !== "select") return false;
  if (
    rectsOverlap(
      x,
      y,
      1,
      1,
      SELECT_CARD_SPREAD.x,
      SELECT_CARD_SPREAD.y,
      SELECT_CARD_SPREAD.w,
      SELECT_CARD_SPREAD.h
    )
  ) {
    beginPlaying(g, "spread", now);
    return true;
  }
  if (
    rectsOverlap(
      x,
      y,
      1,
      1,
      SELECT_CARD_LASER.x,
      SELECT_CARD_LASER.y,
      SELECT_CARD_LASER.w,
      SELECT_CARD_LASER.h
    )
  ) {
    beginPlaying(g, "laser", now);
    return true;
  }
  return false;
}

function spawnEnemy(g: GameModel, playerX: number): void {
  const mult = getStageDifficulty(g.stage);
  const w = ENEMY_BASE_W;
  const h = ENEMY_BASE_H;
  const x = randBetween(16, CANVAS_W - w - 16);
  const y = -h;
  const speedMult = 1 + (g.stage - 1) * 0.09;
  const vy = randBetween(105, 195) * speedMult;
  const track = randBetween(0.45, 0.95);
  const toPlayer = playerX + PLAYER_W / 2 - (x + w / 2);
  const vx = Math.max(-110, Math.min(110, toPlayer * track * 0.028));

  const hp = Math.round(NORMAL_ENEMY_MAX_HP * mult);
  const dmg = Math.round(38 * mult);

  g.enemies.push({
    id: nextId(g),
    x,
    y,
    w,
    h,
    hp,
    maxHp: hp,
    damage: dmg,
    vx,
    vy,
  });
}

function spawnBoss(g: GameModel, now: number): void {
  const stageMult = getStageDifficulty(g.stage);
  const bossMult = getBossStageMult(g.stage);
  const maxHp = Math.round(NORMAL_ENEMY_MAX_HP * BOSS_HP_MULT * stageMult * bossMult);
  const dmg = Math.round(55 * stageMult * bossMult);
  g.enemies = [];
  g.boss = {
    id: nextId(g),
    x: CANVAS_W / 2 - BOSS_W / 2,
    y: 40,
    w: BOSS_W,
    h: BOSS_H,
    hp: maxHp,
    maxHp,
    damage: dmg,
    lastShot: now + BOSS_FIRST_SHOT_DELAY_MS,
  };
  g.playerInvulnerableUntil = Math.max(
    g.playerInvulnerableUntil,
    now + BOSS_ENTRY_INVULN_MS
  );
}

function spawnSpreadBullets(g: GameModel, p: Player): void {
  const count = Math.max(3, Math.floor(p.missileCount));
  const halfSpread =
    0.22 + p.weaponLevel * 0.065 + Math.max(0, count - 3) * 0.018;
  const baseAngle = -Math.PI / 2;
  const speed = MISSILE_SPEED * (1 + p.weaponLevel * 0.05);
  const baseX = p.x + p.w / 2 - MISSILE_W / 2;
  const baseY = p.y - MISSILE_H;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = baseAngle + (t * 2 - 1) * halfSpread;
    g.missiles.push({
      id: nextId(g),
      x: baseX,
      y: baseY,
      w: MISSILE_W,
      h: MISSILE_H,
      damage: Math.round(p.attack * (1 + p.weaponLevel * 0.12)),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
}

function pointOnQuadBezier(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  ex: number,
  ey: number,
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * sx + 2 * u * t * cx + t * t * ex,
    y: u * u * sy + 2 * u * t * cy + t * t * ey,
  };
}

function distPointToRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): number {
  const cx = Math.max(rx, Math.min(px, rx + rw));
  const cy = Math.max(ry, Math.min(py, ry + rh));
  return Math.hypot(px - cx, py - cy);
}

function laserHitsRect(
  laser: LaserVisual,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const hitPad = laser.thickness * 0.55 + 5;
  for (let t = 0; t <= 1; t += 0.014) {
    const pt = pointOnQuadBezier(
      laser.sx,
      laser.sy,
      laser.cx,
      laser.cy,
      laser.ex,
      laser.ey,
      t
    );
    if (distPointToRect(pt.x, pt.y, rx, ry, rw, rh) <= hitPad) return true;
  }
  return false;
}

function findLaserTarget(
  g: GameModel,
  startX: number,
  startY: number
): { x: number; y: number } {
  let bestDist = Infinity;
  let tx = startX;
  let ty = 40;

  for (const e of g.enemies) {
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    if (ey >= startY - 8) continue;
    const d = Math.hypot(ex - startX, ey - startY);
    if (d < bestDist) {
      bestDist = d;
      tx = ex;
      ty = ey;
    }
  }

  if (g.boss && g.boss.hp > 0) {
    const bx = g.boss.x + g.boss.w / 2;
    const by = g.boss.y + g.boss.h / 2;
    const d = Math.hypot(bx - startX, by - startY);
    if (d < bestDist) {
      tx = bx;
      ty = by;
    }
  }

  return { x: tx, y: ty };
}

function killEnemy(g: GameModel, e: Enemy, idx: number, now: number): void {
  const p = g.player;
  g.score += SCORE_ENEMY;
  p.exp += EXP_PER_KILL;
  tryDropItem(g, e.x + e.w / 2, e.y + e.h / 2);
  g.enemies.splice(idx, 1);
  applyLevelUps(g, now);
}

function updateLaserWeapon(g: GameModel, p: Player, dt: number, now: number): void {
  const sx = p.x + p.w / 2;
  const sy = p.y + 4;
  const target = findLaserTarget(g, sx, sy);
  const sway = Math.sin(now / 280) * (18 + p.weaponLevel * 2);
  const cx = sx + (target.x - sx) * 0.42 + sway;
  const cy = sy - Math.max(120, (sy - target.y) * 0.55);
  const thickness = 6 + p.weaponLevel * 2.8;
  const dps = p.attack * (2.4 + p.weaponLevel * 0.58);
  const damage = dps * dt;

  g.laserVisual = {
    sx,
    sy,
    cx,
    cy,
    ex: target.x,
    ey: target.y,
    thickness,
  };

  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (!laserHitsRect(g.laserVisual, e.x, e.y, e.w, e.h)) continue;
    e.hp -= damage;
    if (e.hp <= 0) killEnemy(g, e, i, now);
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (laserHitsRect(g.laserVisual, b.x, b.y, b.w, b.h)) {
      b.hp -= damage;
      if (b.hp <= 0) {
        g.score += SCORE_BOSS;
        advanceStageAfterBoss(g, now);
      }
    }
  }
}

function tryDropItem(g: GameModel, ex: number, ey: number): void {
  if (Math.random() >= DROP_CHANCE) return;
  const roll = Math.random();
  let type: ItemType;
  if (roll < 1 / 3) type = "heal";
  else if (roll < 2 / 3) type = "missile";
  else type = "power";

  g.items.push({
    id: nextId(g),
    x: ex - ITEM_W / 2,
    y: ey,
    w: ITEM_W,
    h: ITEM_H,
    type,
    vy: ITEM_FALL_SPEED,
  });
}

function advanceStageAfterBoss(g: GameModel, now: number): void {
  g.stage += 1;
  g.boss = null;
  g.bossSpawned = false;
  g.missiles = [];
  g.enemyBullets = [];
  g.items = [];
  g.enemies = [];
  g.laserVisual = null;

  const p = g.player;
  p.level = 1;
  p.exp = 0;
  p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.42));

  g.nextEnemySpawnAt = now + 900;
  g.nextEnemySpawnDelay = randBetween(
    ENEMY_SPAWN_MIN_MS * spawnIntervalScale(g.stage, p.level),
    ENEMY_SPAWN_MAX_MS * spawnIntervalScale(g.stage, p.level)
  );
  g.lastPlayerShot = now;
  g.stageIntroUntil = now + STAGE_INTRO_MS;
  g.playerInvulnerableUntil = Math.max(g.playerInvulnerableUntil, now + 1600);
  g.phase = "playing";
}

function applyLevelUps(g: GameModel, now: number): void {
  const p = g.player;
  while (p.exp >= expToNextLevel(p.level)) {
    p.exp -= expToNextLevel(p.level);
    p.level += 1;
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.22));

    if (p.planeType === "spread") {
      p.missileCount += 3;
      p.weaponLevel += 1;
      p.attack += 4;
    } else {
      p.weaponLevel += 1;
      p.attack += 6;
    }

    if (p.level === 10 && !g.bossSpawned) {
      g.bossSpawned = true;
      spawnBoss(g, now);
    }
  }
}

function bossShoot(g: GameModel, b: Boss, px: number, py: number, now: number): void {
  const shootEvery = Math.max(380, BOSS_SHOOT_MS - (g.stage - 1) * 32);
  if (now - b.lastShot < shootEvery) return;
  b.lastShot = now;

  const cx = b.x + b.w / 2 - ENEMY_BULLET_W / 2;
  const cy = b.y + b.h + 6;
  const tx = px + PLAYER_W / 2;
  const ty = py + PLAYER_H / 2;
  const aimX = cx + ENEMY_BULLET_W / 2;
  const aimY = cy + ENEMY_BULLET_H / 2;
  const dx = tx - aimX;
  const dy = ty - aimY;
  const len = Math.hypot(dx, dy) || 1;
  const speed = ENEMY_BULLET_SPEED * (1 + (g.stage - 1) * 0.06);
  const vx = (dx / len) * speed;
  const vy = (dy / len) * speed;

  g.enemyBullets.push({
    id: nextId(g),
    x: cx,
    y: cy,
    w: ENEMY_BULLET_W,
    h: ENEMY_BULLET_H,
    damage: Math.min(b.damage, Math.round(28 * getStageDifficulty(g.stage))),
    vx,
    vy,
    armedAfter: now + ENEMY_BULLET_ARM_MS,
  });
}

function drawSelectScreen(ctx: CanvasRenderingContext2D, now: number): void {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#1a2336";
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % CANVAS_W;
    const sy = (i * 53) % CANVAS_H;
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 34px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Sky Strike", CANVAS_W / 2, 120);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px ui-monospace, monospace";
  ctx.fillText("기체를 선택하세요", CANVAS_W / 2, 158);
  ctx.font = "13px ui-monospace, monospace";
  ctx.fillText("클릭 / 탭 · 또는 1 · 2", CANVAS_W / 2, 186);

  const pulse = 0.92 + Math.sin(now / 420) * 0.08;

  const drawCard = (
    card: { x: number; y: number; w: number; h: number },
    title: string,
    lines: string[],
    accent: string,
    keyLabel: string
  ) => {
    ctx.save();
    ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-(card.x + card.w / 2), -(card.y + card.h / 2));

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = "bold 22px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(title, card.x + card.w / 2, card.y + 52);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px ui-monospace, monospace";
    lines.forEach((line, i) => {
      ctx.fillText(line, card.x + card.w / 2, card.y + 92 + i * 24);
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(keyLabel, card.x + card.w / 2, card.y + card.h - 24);
    ctx.restore();
  };

  drawCard(
    SELECT_CARD_SPREAD,
    "Spread",
    ["3-way fan missiles", "Lv↑ wider & denser", "Items: +3 shots"],
    "#38bdf8",
    "[ 1 ]"
  );
  drawCard(
    SELECT_CARD_LASER,
    "Laser",
    ["Curved tracking beam", "Pierces all targets", "Lv↑ thicker & DPS"],
    "#c084fc",
    "[ 2 ]"
  );

  ctx.fillStyle = "#64748b";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText(`Sky Strike · v${GAME_VERSION}`, CANVAS_W / 2, CANVAS_H - 8);
  ctx.textAlign = "left";
}

function drawLaserBeam(ctx: CanvasRenderingContext2D, laser: LaserVisual): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(192, 132, 252, 0.25)";
  ctx.lineWidth = laser.thickness * 2.4;
  ctx.beginPath();
  ctx.moveTo(laser.sx, laser.sy);
  ctx.quadraticCurveTo(laser.cx, laser.cy, laser.ex, laser.ey);
  ctx.stroke();

  ctx.strokeStyle = "rgba(224, 231, 255, 0.85)";
  ctx.lineWidth = laser.thickness;
  ctx.shadowColor = "#c084fc";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(laser.sx, laser.sy);
  ctx.quadraticCurveTo(laser.cx, laser.cy, laser.ex, laser.ey);
  ctx.stroke();

  ctx.restore();
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  ranking: number[] | null,
  now: number
): void {
  if (g.phase === "select") {
    drawSelectScreen(ctx, now);
    return;
  }

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#1a2336";
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % CANVAS_W;
    const sy = (i * 53) % CANVAS_H;
    ctx.fillRect(sx, sy, 2, 2);
  }

  const p = g.player;

  for (const it of g.items) {
    if (it.type === "heal") ctx.fillStyle = "#3ecf8e";
    else if (it.type === "missile") ctx.fillStyle = "#6cb6ff";
    else ctx.fillStyle = "#f0b429";
    ctx.fillRect(it.x, it.y, it.w, it.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(it.x + 0.5, it.y + 0.5, it.w - 1, it.h - 1);
  }

  for (const e of g.enemies) {
    ctx.fillStyle = "#c94c4c";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#ff8a8a";
    ctx.fillRect(e.x + 6, e.y + 6, e.w - 12, 8);
  }

  if (g.boss) {
    const b = g.boss;
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#c4b5fd";
    ctx.fillRect(b.x + 20, b.y + 16, b.w - 40, 24);
    const bw = (b.hp / b.maxHp) * (b.w - 8);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(b.x + 4, b.y - 10, bw, 6);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(b.x + 4, b.y - 10, b.w - 8, 6);
  }

  if (g.laserVisual) {
    drawLaserBeam(ctx, g.laserVisual);
  }

  ctx.fillStyle = "#93c5fd";
  for (const m of g.missiles) {
    ctx.fillRect(m.x, m.y, m.w, m.h);
  }

  ctx.fillStyle = "#fb923c";
  for (const eb of g.enemyBullets) {
    ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
  }

  ctx.fillStyle = p.planeType === "laser" ? "#c084fc" : "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(p.x + p.w / 2, p.y);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.lineTo(p.x, p.y + p.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e0f2fe";
  ctx.stroke();

  const barW = 220;
  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(12, 12, barW, 14);
  ctx.fillStyle = hpRatio > 0.35 ? "#22c55e" : "#ef4444";
  ctx.fillRect(12, 12, barW * hpRatio, 14);
  ctx.strokeStyle = "#9ca3af";
  ctx.strokeRect(12, 12, barW, 14);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`HP ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, 18, 23);

  const need = expToNextLevel(p.level);
  const expRatio = Math.min(1, p.exp / need);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(12, 32, barW, 12);
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(12, 32, barW * expRatio, 12);
  ctx.strokeStyle = "#9ca3af";
  ctx.strokeRect(12, 32, barW, 12);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText(`EXP ${Math.floor(p.exp)}/${need}`, 18, 41);

  const planeLabel = p.planeType === "spread" ? "Spr" : "Lsr";
  ctx.fillStyle = "#f9fafb";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(`St ${g.stage}`, 12, 62);
  ctx.fillText(`Lv ${p.level}`, 56, 62);
  ctx.fillText(`${planeLabel} W${p.weaponLevel}`, 108, 62);
  ctx.fillText(`Score ${g.score}`, 220, 62);
  if (p.planeType === "spread") {
    ctx.fillText(`Shots ${Math.floor(p.missileCount)}`, 360, 62);
  } else {
    ctx.fillText(`ATK ${p.attack}`, 360, 62);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Sky Strike · v${GAME_VERSION}`, CANVAS_W / 2, CANVAS_H - 8);
  ctx.textAlign = "left";

  if (g.phase === "playing" && now < g.stageIntroUntil) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "bold 28px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`STAGE ${g.stage}`, CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "15px ui-monospace, monospace";
    ctx.fillText("적이 더 강해졌습니다", CANVAS_W / 2, CANVAS_H / 2 + 24);
    ctx.textAlign = "left";
  }

  if (g.phase === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#fecaca";
    ctx.font = "bold 36px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 60);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillText(`Final Score: ${g.score}`, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = "16px ui-monospace, monospace";
    ctx.fillText("Top scores:", CANVAS_W / 2, CANVAS_H / 2 + 28);
    const ranks = ranking ?? [];
    for (let i = 0; i < MAX_RANK; i++) {
      const val = ranks[i] ?? "—";
      ctx.fillText(`${i + 1}. ${val}`, CANVAS_W / 2, CANVAS_H / 2 + 54 + i * 22);
    }
    ctx.textAlign = "left";
  }
}

function updateGame(g: GameModel, dt: number, now: number): void {
  if (g.phase !== "playing") return;

  const p = g.player;
  const keys = g.keys;
  const canTakeDamage = now >= g.playerInvulnerableUntil;

  let mx = 0;
  let my = 0;
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) mx -= 1;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) mx += 1;
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) my -= 1;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) my -= 1;

  if (mx !== 0 && my !== 0) {
    mx *= 0.7071;
    my *= 0.7071;
  }

  p.x += mx * PLAYER_SPEED_PX * dt;
  p.y += my * PLAYER_SPEED_PX * dt;
  p.x = Math.max(0, Math.min(CANVAS_W - p.w, p.x));
  p.y = Math.max(0, Math.min(CANVAS_H - p.h, p.y));

  const bossActive = g.boss !== null && g.boss.hp > 0;

  if (!bossActive && now >= g.stageIntroUntil && now >= g.nextEnemySpawnAt) {
    const wave = waveSizeForLevel(p.level);
    for (let i = 0; i < wave; i++) {
      spawnEnemy(g, p.x + (i - (wave - 1) / 2) * 18);
    }
    const sc = spawnIntervalScale(g.stage, p.level);
    g.nextEnemySpawnDelay = randBetween(
      ENEMY_SPAWN_MIN_MS * sc,
      ENEMY_SPAWN_MAX_MS * sc
    );
    g.nextEnemySpawnAt = now + g.nextEnemySpawnDelay;
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    const targetX = CANVAS_W / 2 - BOSS_W / 2 + Math.sin(now / 900) * 120;
    b.x += (targetX - b.x) * Math.min(1, dt * 2);
    b.x = Math.max(8, Math.min(CANVAS_W - b.w - 8, b.x));
    bossShoot(g, b, p.x, p.y, now);
  }

  if (p.planeType === "spread") {
    g.laserVisual = null;
    if (now - g.lastPlayerShot >= AUTO_FIRE_MS) {
      g.lastPlayerShot = now;
      spawnSpreadBullets(g, p);
    }
  } else {
    g.missiles = [];
    updateLaserWeapon(g, p, dt, now);
  }

  for (const m of g.missiles) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }
  g.missiles = g.missiles.filter(
    (m) => m.y + m.h > -40 && m.x > -40 && m.x < CANVAS_W + 40
  );

  for (const e of g.enemies) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    const toward = p.x + p.w / 2 - (e.x + e.w / 2);
    e.vx += toward * 0.05 * dt;
    e.vx = Math.max(-165, Math.min(165, e.vx));
  }
  g.enemies = g.enemies.filter((e) => e.y < CANVAS_H + 80);

  for (const it of g.items) {
    it.y += it.vy * dt;
  }
  g.items = g.items.filter((it) => it.y < CANVAS_H + 60);

  for (const eb of g.enemyBullets) {
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;
  }
  g.enemyBullets = g.enemyBullets.filter(
    (eb) => eb.y < CANVAS_H + 60 && eb.x > -60 && eb.x < CANVAS_W + 60
  );

  outer: for (const m of g.missiles) {
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (!rectsOverlap(m.x, m.y, m.w, m.h, e.x, e.y, e.w, e.h)) continue;
      e.hp -= m.damage;
      m.y = -9999;
      if (e.hp <= 0) killEnemy(g, e, i, now);
      continue outer;
    }
  }
  g.missiles = g.missiles.filter((m) => m.y > -500);

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    for (const m of g.missiles) {
      if (m.y < -400) continue;
      if (!rectsOverlap(m.x, m.y, m.w, m.h, b.x, b.y, b.w, b.h)) continue;
      b.hp -= m.damage;
      m.y = -9999;
      if (b.hp <= 0) {
        g.score += SCORE_BOSS;
        advanceStageAfterBoss(g, now);
        return;
      }
    }
    g.missiles = g.missiles.filter((m) => m.y > -500);
  }

  if (canTakeDamage) {
    for (const e of g.enemies) {
      if (!rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
      p.hp -= e.damage * dt;
    }
  }

  for (const eb of g.enemyBullets) {
    if (now < eb.armedAfter) continue;
    if (!canTakeDamage) continue;
    if (!rectsOverlap(p.x, p.y, p.w, p.h, eb.x, eb.y, eb.w, eb.h)) continue;
    p.hp -= eb.damage;
    eb.y = CANVAS_H + 999;
  }
  g.enemyBullets = g.enemyBullets.filter((eb) => eb.y < CANVAS_H + 100);

  for (let i = g.items.length - 1; i >= 0; i--) {
    const it = g.items[i];
    if (!rectsOverlap(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) continue;
    if (it.type === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35));
    } else if (it.type === "missile") {
      if (p.planeType === "spread") {
        p.missileCount += 4;
        p.weaponLevel += 1;
        p.attack += 3;
      } else {
        p.weaponLevel += 2;
        p.attack += 5;
      }
    } else {
      p.attack += 7;
    }
    g.items.splice(i, 1);
  }

  if (canTakeDamage && g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (rectsOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
      p.hp -= b.damage * BOSS_CONTACT_DPS_SCALE * dt;
    }
  }

  if (p.hp <= 0) {
    p.hp = 0;
    g.phase = "gameover";
    g.laserVisual = null;
  }
}

function canvasPointFromEvent(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameModel>(createGameModel());
  const rankingRef = useRef<number[] | null>(null);
  const endedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const loop = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const g = gameRef.current;
    if (lastTsRef.current === null) lastTsRef.current = ts;
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
    lastTsRef.current = ts;

    if (g.phase === "playing") {
      updateGame(g, dt, ts);
    }

    if (g.phase === "gameover" && !endedRef.current) {
      endedRef.current = true;
      rankingRef.current = saveRankingScore(g.score);
    }

    drawGame(ctx, g, rankingRef.current, ts);

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    endedRef.current = false;
    rankingRef.current = null;
    gameRef.current = createGameModel();
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const bindPadKey = useCallback((key: string) => {
    const setKey = (down: boolean) => {
      gameRef.current.keys[key] = down;
    };
    const stop = (e: { preventDefault: () => void; stopPropagation?: () => void }) => {
      e.preventDefault();
      e.stopPropagation?.();
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setKey(true);
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        setKey(false);
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        setKey(false);
      },
      onLostPointerCapture: () => {
        setKey(false);
      },
      onTouchStart: (e: ReactTouchEvent<HTMLButtonElement>) => {
        stop(e);
        setKey(true);
      },
      onTouchEnd: (e: ReactTouchEvent<HTMLButtonElement>) => {
        stop(e);
        setKey(false);
      },
      onTouchCancel: (e: ReactTouchEvent<HTMLButtonElement>) => {
        stop(e);
        setKey(false);
      },
    };
  }, []);

  const onCanvasPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pt = canvasPointFromEvent(canvas, e.clientX, e.clientY);
      trySelectPlane(gameRef.current, pt.x, pt.y, performance.now());
    },
    []
  );

  useEffect(() => {
    const gameKeys = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "a",
      "A",
      "w",
      "W",
      "s",
      "S",
      "d",
      "D",
      "1",
      "2",
    ]);
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (g.phase === "select") {
        if (e.key === "1") {
          beginPlaying(g, "spread", performance.now());
          return;
        }
        if (e.key === "2") {
          beginPlaying(g, "laser", performance.now());
          return;
        }
      }
      if (gameKeys.has(e.key)) e.preventDefault();
      g.keys[e.key] = true;
    };
    const up = (e: KeyboardEvent) => {
      if (gameKeys.has(e.key)) e.preventDefault();
      gameRef.current.keys[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <main className="game-page">
      <header className="game-page__header">
        <h1>Sky Strike</h1>
        <p className="game-page__hint">
          기체 선택(1/2) · PC: WASD / 방향키 / 하단 키패드 · 자동 발사 165ms · Lv10 보스
        </p>
      </header>

      <div className="game-page__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={onCanvasPointerDown}
        />
      </div>

      <div className="game-page__bottom">
        <div className="mobile-pad" aria-label="이동 버튼 (가로)">
          <button
            type="button"
            className="pad-btn"
            aria-label="왼쪽"
            {...bindPadKey("ArrowLeft")}
          >
            ←
          </button>
          <button
            type="button"
            className="pad-btn"
            aria-label="위"
            {...bindPadKey("ArrowUp")}
          >
            ↑
          </button>
          <button
            type="button"
            className="pad-btn"
            aria-label="아래"
            {...bindPadKey("ArrowDown")}
          >
            ↓
          </button>
          <button
            type="button"
            className="pad-btn"
            aria-label="오른쪽"
            {...bindPadKey("ArrowRight")}
          >
            →
          </button>
        </div>
        <p className="game-page__version">업데이트 v{GAME_VERSION}</p>
      </div>
    </main>
  );
}
