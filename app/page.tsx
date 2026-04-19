"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

// --- Constants ---
const CANVAS_W = 800;
const CANVAS_H = 600;
const AUTO_FIRE_MS = 300;
const ENEMY_SPAWN_MIN_MS = 1000;
const ENEMY_SPAWN_MAX_MS = 2000;
const PLAYER_SPEED_PX = 260;
const PLAYER_W = 48;
const PLAYER_H = 40;
const MISSILE_W = 6;
const MISSILE_H = 14;
const MISSILE_SPEED = 520;
const ENEMY_BASE_W = 44;
const ENEMY_BASE_H = 36;
const BOSS_W = 120;
const BOSS_H = 80;
const BOSS_SHOOT_MS = 550;
const ENEMY_BULLET_W = 8;
const ENEMY_BULLET_H = 16;
const ENEMY_BULLET_SPEED = 320;
const ITEM_W = 28;
const ITEM_H = 28;
const ITEM_FALL_SPEED = 120;
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

// --- TypeScript types ---
type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  attack: number;
  missileCount: number;
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

type GamePhase = "playing" | "gameover" | "victory";

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

function createInitialPlayer(): Player {
  return {
    x: CANVAS_W / 2 - PLAYER_W / 2,
    y: CANVAS_H - PLAYER_H - 24,
    w: PLAYER_W,
    h: PLAYER_H,
    hp: 100,
    maxHp: 100,
    attack: 10,
    missileCount: 1,
    level: 1,
    exp: 0,
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
    nextEnemySpawnAt: performance.now() + 500,
    nextEnemySpawnDelay: randBetween(ENEMY_SPAWN_MIN_MS, ENEMY_SPAWN_MAX_MS),
    lastPlayerShot: 0,
    score: 0,
    phase: "playing",
    bossSpawned: false,
    nextId: 1,
    playerInvulnerableUntil: 0,
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

function spawnEnemy(g: GameModel, playerX: number): void {
  const w = ENEMY_BASE_W;
  const h = ENEMY_BASE_H;
  const x = randBetween(16, CANVAS_W - w - 16);
  const y = -h;
  const vy = randBetween(70, 130);
  const track = randBetween(0.35, 0.85);
  const toPlayer = playerX + PLAYER_W / 2 - (x + w / 2);
  const vx = Math.max(-80, Math.min(80, toPlayer * track * 0.02));

  g.enemies.push({
    id: nextId(g),
    x,
    y,
    w,
    h,
    hp: NORMAL_ENEMY_MAX_HP,
    maxHp: NORMAL_ENEMY_MAX_HP,
    damage: 38,
    vx,
    vy,
  });
}

function spawnBoss(g: GameModel, now: number): void {
  const maxHp = NORMAL_ENEMY_MAX_HP * BOSS_HP_MULT;
  g.enemies = [];
  g.boss = {
    id: nextId(g),
    x: CANVAS_W / 2 - BOSS_W / 2,
    y: 40,
    w: BOSS_W,
    h: BOSS_H,
    hp: maxHp,
    maxHp,
    damage: 55,
    /** rAF 타임스탬프와 통일 — 첫 발사는 지연 후에만 */
    lastShot: now + BOSS_FIRST_SHOT_DELAY_MS,
  };
  g.playerInvulnerableUntil = Math.max(
    g.playerInvulnerableUntil,
    now + BOSS_ENTRY_INVULN_MS
  );
}

function spawnMissiles(g: GameModel, p: Player): void {
  const count = Math.max(1, Math.floor(p.missileCount));
  const spacing = 14;
  const baseX = p.x + p.w / 2 - MISSILE_W / 2;
  const baseY = p.y - MISSILE_H;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    g.missiles.push({
      id: nextId(g),
      x: baseX + offset,
      y: baseY,
      w: MISSILE_W,
      h: MISSILE_H,
      damage: p.attack,
      vx: 0,
      vy: -MISSILE_SPEED,
    });
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

function applyLevelUps(g: GameModel, now: number): void {
  const p = g.player;
  while (p.exp >= expToNextLevel(p.level)) {
    p.exp -= expToNextLevel(p.level);
    p.level += 1;
    p.attack += 2;
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.22));

    if (p.level === 10 && !g.bossSpawned) {
      g.bossSpawned = true;
      spawnBoss(g, now);
    }
  }
}

function bossShoot(g: GameModel, b: Boss, px: number, py: number, now: number): void {
  if (now - b.lastShot < BOSS_SHOOT_MS) return;
  b.lastShot = now;

  const cx = b.x + b.w / 2 - ENEMY_BULLET_W / 2;
  /** 입구를 보스 히트박스 밖으로 살짝 내려 플레이어와 스폰 겹침 감소 */
  const cy = b.y + b.h + 6;
  const tx = px + PLAYER_W / 2;
  const ty = py + PLAYER_H / 2;
  const aimX = cx + ENEMY_BULLET_W / 2;
  const aimY = cy + ENEMY_BULLET_H / 2;
  const dx = tx - aimX;
  const dy = ty - aimY;
  const len = Math.hypot(dx, dy) || 1;
  const speed = ENEMY_BULLET_SPEED;
  const vx = (dx / len) * speed;
  const vy = (dy / len) * speed;

  g.enemyBullets.push({
    id: nextId(g),
    x: cx,
    y: cy,
    w: ENEMY_BULLET_W,
    h: ENEMY_BULLET_H,
    damage: Math.min(b.damage, 28),
    vx,
    vy,
    armedAfter: now + ENEMY_BULLET_ARM_MS,
  });
}

// --- Rendering ---
function drawGame(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  ranking: number[] | null
): void {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars (static pattern)
  ctx.fillStyle = "#1a2336";
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 97) % CANVAS_W) ^ 0;
    const sy = ((i * 53) % CANVAS_H) ^ 0;
    ctx.fillRect(sx, sy, 2, 2);
  }

  const p = g.player;

  // Items
  for (const it of g.items) {
    if (it.type === "heal") ctx.fillStyle = "#3ecf8e";
    else if (it.type === "missile") ctx.fillStyle = "#6cb6ff";
    else ctx.fillStyle = "#f0b429";
    ctx.fillRect(it.x, it.y, it.w, it.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(it.x + 0.5, it.y + 0.5, it.w - 1, it.h - 1);
  }

  // Enemies
  for (const e of g.enemies) {
    ctx.fillStyle = "#c94c4c";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#ff8a8a";
    ctx.fillRect(e.x + 6, e.y + 6, e.w - 12, 8);
  }

  // Boss
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

  // Missiles
  ctx.fillStyle = "#93c5fd";
  for (const m of g.missiles) {
    ctx.fillRect(m.x, m.y, m.w, m.h);
  }

  // Enemy bullets
  ctx.fillStyle = "#fb923c";
  for (const eb of g.enemyBullets) {
    ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
  }

  // Player plane
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(p.x + p.w / 2, p.y);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.lineTo(p.x, p.y + p.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e0f2fe";
  ctx.stroke();

  // HUD bars (canvas)
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

  ctx.fillStyle = "#f9fafb";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(`Lv ${p.level}`, 12, 62);
  ctx.fillText(`Score ${g.score}`, 100, 62);
  ctx.fillText(`Missiles ${p.missileCount}`, 240, 62);
  ctx.fillText(`ATK ${p.attack}`, 380, 62);

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
  } else if (g.phase === "victory") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "bold 36px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("VICTORY", CANVAS_W / 2, CANVAS_H / 2 - 50);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillText("Boss defeated — mission clear!", CANVAS_W / 2, CANVAS_H / 2 - 6);
    ctx.fillText(`Score ${g.score}`, CANVAS_W / 2, CANVAS_H / 2 + 28);
    ctx.font = "16px ui-monospace, monospace";
    ctx.fillText("Top scores:", CANVAS_W / 2, CANVAS_H / 2 + 62);
    const ranks = ranking ?? [];
    for (let i = 0; i < MAX_RANK; i++) {
      const val = ranks[i] ?? "—";
      ctx.fillText(`${i + 1}. ${val}`, CANVAS_W / 2, CANVAS_H / 2 + 88 + i * 22);
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
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) my += 1;

  if (mx !== 0 && my !== 0) {
    mx *= 0.7071;
    my *= 0.7071;
  }

  p.x += mx * PLAYER_SPEED_PX * dt;
  p.y += my * PLAYER_SPEED_PX * dt;
  p.x = Math.max(0, Math.min(CANVAS_W - p.w, p.x));
  p.y = Math.max(0, Math.min(CANVAS_H - p.h, p.y));

  const bossActive = g.boss !== null && g.boss.hp > 0;

  if (!bossActive && now >= g.nextEnemySpawnAt) {
    spawnEnemy(g, p.x);
    g.nextEnemySpawnDelay = randBetween(ENEMY_SPAWN_MIN_MS, ENEMY_SPAWN_MAX_MS);
    g.nextEnemySpawnAt = now + g.nextEnemySpawnDelay;
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    const targetX = CANVAS_W / 2 - BOSS_W / 2 + Math.sin(now / 900) * 120;
    b.x += (targetX - b.x) * Math.min(1, dt * 2);
    b.x = Math.max(8, Math.min(CANVAS_W - b.w - 8, b.x));
    bossShoot(g, b, p.x, p.y, now);
  }

  if (now - g.lastPlayerShot >= AUTO_FIRE_MS) {
    g.lastPlayerShot = now;
    spawnMissiles(g, p);
  }

  for (const m of g.missiles) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }
  g.missiles = g.missiles.filter((m) => m.y + m.h > -40 && m.x > -40 && m.x < CANVAS_W + 40);

  for (const e of g.enemies) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    const toward = p.x + p.w / 2 - (e.x + e.w / 2);
    e.vx += toward * 0.04 * dt;
    e.vx = Math.max(-140, Math.min(140, e.vx));
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

  // Missiles vs enemies
  outer: for (const m of g.missiles) {
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (!rectsOverlap(m.x, m.y, m.w, m.h, e.x, e.y, e.w, e.h)) continue;
      e.hp -= m.damage;
      m.y = -9999;
      if (e.hp <= 0) {
        g.score += SCORE_ENEMY;
        p.exp += EXP_PER_KILL;
        tryDropItem(g, e.x + e.w / 2, e.y + e.h / 2);
        g.enemies.splice(i, 1);
        applyLevelUps(g, now);
      }
      continue outer;
    }
  }
  g.missiles = g.missiles.filter((m) => m.y > -500);

  // Missiles vs boss
  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    for (const m of g.missiles) {
      if (m.y < -400) continue;
      if (!rectsOverlap(m.x, m.y, m.w, m.h, b.x, b.y, b.w, b.h)) continue;
      b.hp -= m.damage;
      m.y = -9999;
      if (b.hp <= 0) {
        g.score += SCORE_BOSS;
        g.phase = "victory";
        return;
      }
    }
    g.missiles = g.missiles.filter((m) => m.y > -500);
  }

  // Player vs enemies (DPS while overlapping)
  if (canTakeDamage) {
    for (const e of g.enemies) {
      if (!rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
      p.hp -= e.damage * dt;
    }
  }

  // Player vs enemy bullets
  for (const eb of g.enemyBullets) {
    if (now < eb.armedAfter) continue;
    if (!canTakeDamage) continue;
    if (!rectsOverlap(p.x, p.y, p.w, p.h, eb.x, eb.y, eb.w, eb.h)) continue;
    p.hp -= eb.damage;
    eb.y = CANVAS_H + 999;
  }
  g.enemyBullets = g.enemyBullets.filter((eb) => eb.y < CANVAS_H + 100);

  // Items pickup
  for (let i = g.items.length - 1; i >= 0; i--) {
    const it = g.items[i];
    if (!rectsOverlap(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) continue;
    if (it.type === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35));
    } else if (it.type === "missile") {
      p.missileCount += 1;
    } else {
      p.attack += 3;
    }
    g.items.splice(i, 1);
  }

  // Boss body collision
  if (canTakeDamage && g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (rectsOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
      p.hp -= b.damage * BOSS_CONTACT_DPS_SCALE * dt;
    }
  }

  if (p.hp <= 0) {
    p.hp = 0;
    g.phase = "gameover";
  }
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

    if (
      (g.phase === "gameover" || g.phase === "victory") &&
      !endedRef.current
    ) {
      endedRef.current = true;
      rankingRef.current = saveRankingScore(g.score);
    }

    drawGame(ctx, g, rankingRef.current);

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
    const stop = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        gameRef.current.keys[key] = true;
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        gameRef.current.keys[key] = false;
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
        stop(e);
        gameRef.current.keys[key] = false;
      },
      onPointerLeave: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (e.pointerType === "touch" || e.buttons === 0) {
          gameRef.current.keys[key] = false;
        }
      },
    };
  }, []);

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
    ]);
    const down = (e: KeyboardEvent) => {
      if (gameKeys.has(e.key)) e.preventDefault();
      gameRef.current.keys[e.key] = true;
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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
        Sky Strike
      </h1>
      <p
        style={{
          margin: 0,
          opacity: 0.8,
          fontSize: 14,
          textAlign: "center",
          maxWidth: 520,
          lineHeight: 1.45,
        }}
      >
        PC: WASD / 방향키 · 스마트폰: 아래 방향 버튼 · 자동 발사 300ms · Lv10에서
        보스
      </p>
      <div className="game-shell">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            border: "2px solid #334155",
            borderRadius: 8,
            background: "#0b1220",
            maxWidth: "100%",
            height: "auto",
          }}
        />
        <div className="mobile-pad" aria-label="이동 버튼">
          <span className="pad-spacer" />
          <button
            type="button"
            className="pad-btn"
            aria-label="위"
            {...bindPadKey("ArrowUp")}
          >
            ↑
          </button>
          <span className="pad-spacer" />
          <button
            type="button"
            className="pad-btn"
            aria-label="왼쪽"
            {...bindPadKey("ArrowLeft")}
          >
            ←
          </button>
          <span className="pad-spacer" />
          <button
            type="button"
            className="pad-btn"
            aria-label="오른쪽"
            {...bindPadKey("ArrowRight")}
          >
            →
          </button>
          <span className="pad-spacer" />
          <button
            type="button"
            className="pad-btn"
            aria-label="아래"
            {...bindPadKey("ArrowDown")}
          >
            ↓
          </button>
          <span className="pad-spacer" />
        </div>
      </div>
    </main>
  );
}
