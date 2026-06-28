"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ActiveSkillButton } from "@/components/ActiveSkillButton";
import { BombButton } from "@/components/BombButton";
import { GameOverPanel } from "@/components/GameOverPanel";
import { ItemLegendDock } from "@/components/ItemLegendDock";
import { LobbyScreen } from "@/components/LobbyScreen";
import { VirtualJoystick } from "@/components/VirtualJoystick";
import type { SharePlane } from "@/lib/share";

// --- Constants ---
const CANVAS_W = 800;
/** 9:16에 가까운 세로 플레이 영역 (모바일 세로 화면 활용) */
const CANVAS_H = 1280;
const AUTO_FIRE_MS = 165;
const ENEMY_SPAWN_MIN_MS = 520;
const ENEMY_SPAWN_MAX_MS = 1050;
const PLAYER_SPEED_PX = 560;
/** 터치 드래그: dead zone 안이면 정지, ramp 구간에서 0→1 가속 */
const TOUCH_DEAD_ZONE = 36;
const TOUCH_RAMP_DIST = 100;
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
/** 보스 전용 추가 체력 배율 (스테이지·보스 배율과 별도) */
const BOSS_HP_TANK_BASE = 32000;
/** W레벨 이상부터 부채꼴 각도·탄수 시각 고정 — 두께는 overflowVisualProgress 로 계속 성장 */
const VISUAL_WEAPON_LEVEL_CAP = 8;
const VISUAL_SPREAD_HALF_CAP = 0.52;
const VISUAL_SPREAD_COUNT_CAP = 11;
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
const GAME_VERSION = "0.12.0";
const HEAL_PULSE_MS = 750;
const PICKUP_TOAST_MS = 1000;
const MOBILE_PICKUP_TOAST_MS = 1300;
const COMBO_WINDOW_MS = 2400;
const COMBO_MULT_STEP = 0.12;
const COMBO_MULT_CAP = 3;
const STAGE_OBJECTIVE_BONUS_BASE = 380;
const STAGE_FAST_CLEAR_MS = 90_000;
const ACTIVE_SKILL_COOLDOWN_MS = 16_000;
const ACTIVE_SKILL_DURATION_MS = 2800;
const BOMB_ATTACK_MULT = 200;
const STARTING_BOMBS = 3;
const STAGE_BOMB_DROP_MIN = 3;
const STAGE_BOMB_DROP_MAX = 10;
const BOMB_DROP_INTERVAL_MIN_MS = 6500;
const BOMB_DROP_INTERVAL_MAX_MS = 14500;
const BOMB_DROP_FIRST_MIN_MS = 3500;
const BOMB_DROP_FIRST_MAX_MS = 7500;
const BOMB_COOLDOWN_MS = 520;
const BOMB_FLASH_MS = 460;
const STAGE_LIFE_DROP_CHANCE = 0.1;
const LIFE_DROP_FIRST_MIN_MS = 9000;
const LIFE_DROP_FIRST_MAX_MS = 20000;
const RESPAWN_INVULN_MS = 2200;
const BOSS_SPAWN_Y_DESKTOP = 138;
const BOSS_SPAWN_Y_MOBILE = 152;

type MovementInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

const EMPTY_MOVE: MovementInput = {
  left: false,
  right: false,
  up: false,
  down: false,
};

function clearMovement(m: MovementInput): void {
  m.left = false;
  m.right = false;
  m.up = false;
  m.down = false;
}

/** Magic Keyboard 등: e.code 기준 (e.key보다 안정적) */
function applyKeyboardMove(e: KeyboardEvent, down: boolean, kb: MovementInput): boolean {
  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      kb.left = down;
      return true;
    case "ArrowRight":
    case "KeyD":
      kb.right = down;
      return true;
    case "ArrowUp":
    case "KeyW":
      kb.up = down;
      return true;
    case "ArrowDown":
    case "KeyS":
      kb.down = down;
      return true;
    default:
      return false;
  }
}

function readMovementDelta(kb: MovementInput, pad: MovementInput): { mx: number; my: number } {
  let mx = 0;
  let my = 0;
  if (kb.left || pad.left) mx -= 1;
  if (kb.right || pad.right) mx += 1;
  if (kb.up || pad.up) my -= 1;
  if (kb.down || pad.down) my += 1;
  if (mx !== 0 && my !== 0) {
    mx *= 0.7071;
    my *= 0.7071;
  }
  return { mx, my };
}

type TouchSteerState = {
  active: boolean;
  mx: number;
  my: number;
  fingerX: number;
  fingerY: number;
  source: "seek" | "joystick";
};

const EMPTY_TOUCH_STEER: TouchSteerState = {
  active: false,
  mx: 0,
  my: 0,
  fingerX: 0,
  fingerY: 0,
  source: "seek",
};

function clearTouchSteer(ts: TouchSteerState): void {
  ts.active = false;
  ts.mx = 0;
  ts.my = 0;
  ts.fingerX = 0;
  ts.fingerY = 0;
  ts.source = "seek";
}

/** 손가락 위치 → 비행기 중심 기준 아날로그 이동 벡터 (거리 비례 속도) */
function computeTouchSteerVector(
  fingerX: number,
  fingerY: number,
  cx: number,
  cy: number
): { mx: number; my: number } {
  const dx = fingerX - cx;
  const dy = fingerY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist <= TOUCH_DEAD_ZONE) {
    return { mx: 0, my: 0 };
  }
  const t = Math.min(1, (dist - TOUCH_DEAD_ZONE) / TOUCH_RAMP_DIST);
  return { mx: (dx / dist) * t, my: (dy / dist) * t };
}

function readCombinedMovement(
  kb: MovementInput,
  pad: MovementInput,
  touch: TouchSteerState
): { mx: number; my: number } {
  const digital = readMovementDelta(kb, pad);
  if (!touch.active) return digital;
  if (touch.mx !== 0 || touch.my !== 0) {
    return { mx: touch.mx, my: touch.my };
  }
  return digital;
}
const STAGE_INTRO_MS = 2400;
/** 프레임 급락·멈춤 방지용 상한 */
const MAX_ENEMIES = 38;
const MAX_MISSILES = 96;
const MAX_ENEMY_BULLETS = 55;
const MAX_ITEMS = 18;
const MAX_SPREAD_PER_SHOT = 16;

function trimEntityCounts(g: GameModel): void {
  if (g.missiles.length > MAX_MISSILES) {
    g.missiles.splice(0, g.missiles.length - MAX_MISSILES);
  }
  if (g.enemyBullets.length > MAX_ENEMY_BULLETS) {
    g.enemyBullets.splice(0, g.enemyBullets.length - MAX_ENEMY_BULLETS);
  }
  if (g.items.length > MAX_ITEMS) {
    g.items.splice(0, g.items.length - MAX_ITEMS);
  }
  if (g.enemies.length > MAX_ENEMIES) {
    g.enemies.splice(0, g.enemies.length - MAX_ENEMIES);
  }
}

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

type ItemType = "heal" | "missile" | "power" | "bomb" | "life";

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
  pierce?: boolean;
};

type StageObjectiveId = "no_hit_preboss" | "no_bomb_boss" | "fast_clear";

type StageObjective = {
  id: StageObjectiveId;
  label: string;
  shortLabel: string;
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
  /** 충돌·피해 판정 두께 */
  thickness: number;
  /** 화면에 그리는 두께 (상한 적용) */
  drawThickness: number;
};

type HealPulse = {
  fromHp: number;
  toHp: number;
  startAt: number;
  until: number;
};

type PickupToast = {
  text: string;
  color: string;
  startAt: number;
  until: number;
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
  kbMove: MovementInput;
  padMove: MovementInput;
  touchSteer: TouchSteerState;
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
  /** 회복 아이템 픽업 시 HP 바 애니메이션 */
  healPulse: HealPulse | null;
  pickupToast: PickupToast | null;
  /** tick에서 갱신 — 모바일 HUD·토스트 타이밍 */
  hudMobile: boolean;
  /** playing 시작 시각(ms) — 플레이 시간 기록 */
  playStartedAt: number;
  bombs: number;
  bombCooldownUntil: number;
  bombFlashUntil: number;
  /** 이번 스테이지에 아직 드랍할 폭탄 개수 */
  stageBombsLeft: number;
  /** 다음 폭탄 아이템 드랍 시각(ms) */
  nextBombDropAt: number;
  /** 남은 추가 생명 (0이면 HP 0 시 게임 오버) */
  extraLives: number;
  /** 이번 스테이지에 생명 아이템 드랍 예정 여부 (10% 확률) */
  stageLifeWillDrop: boolean;
  /** 이번 스테이지 생명 아이템 이미 드랍했는지 */
  stageLifeDropped: boolean;
  /** 생명 아이템 드랍 예정 시각(ms) */
  nextLifeDropAt: number;
  comboCount: number;
  comboExpiresAt: number;
  comboDisplayUntil: number;
  bestCombo: number;
  stageObjective: StageObjective | null;
  stageObjectiveCompleted: boolean;
  stageDamaged: boolean;
  stageBombsUsed: number;
  stageStartedAt: number;
  activeSkillUntil: number;
  activeSkillCooldownUntil: number;
};

const STAGE_OBJECTIVES: StageObjective[] = [
  { id: "no_hit_preboss", label: "보스전까지 무피격", shortLabel: "무피격" },
  { id: "no_bomb_boss", label: "폭탄 없이 보스 격파", shortLabel: "무분탄" },
  { id: "fast_clear", label: "90초 안에 보스 격파", shortLabel: "속전" },
];

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

function calcBossMaxHp(stage: number): number {
  const stageMult = getStageDifficulty(stage);
  const bossMult = getBossStageMult(stage);
  return Math.round(BOSS_HP_TANK_BASE * bossMult * stageMult);
}

function visualWeaponLevel(weaponLevel: number): number {
  return Math.min(weaponLevel, VISUAL_WEAPON_LEVEL_CAP);
}

/** 캡 이후 W레벨 — 캡 구간만큼 더 올리면 시각 두께가 최대치의 2배까지 성장 */
function overflowVisualProgress(weaponLevel: number): number {
  if (weaponLevel <= VISUAL_WEAPON_LEVEL_CAP) return 0;
  const overflow = weaponLevel - VISUAL_WEAPON_LEVEL_CAP;
  return Math.min(overflow / VISUAL_WEAPON_LEVEL_CAP, 1);
}

function visualLaserDrawThickness(weaponLevel: number): number {
  const capThickness = 4 + VISUAL_WEAPON_LEVEL_CAP * 2.4;
  if (weaponLevel <= VISUAL_WEAPON_LEVEL_CAP) {
    return 4 + weaponLevel * 2.4;
  }
  return capThickness * (1 + overflowVisualProgress(weaponLevel));
}

function visualSpreadBulletDimensions(weaponLevel: number): { w: number; h: number } {
  const capWl = VISUAL_WEAPON_LEVEL_CAP;
  const capW = MISSILE_W + capWl * 0.35;
  const capH = MISSILE_H + capWl * 0.55;
  if (weaponLevel <= capWl) {
    const visWl = weaponLevel;
    return {
      w: MISSILE_W + visWl * 0.35,
      h: MISSILE_H + visWl * 0.55,
    };
  }
  const scale = 1 + overflowVisualProgress(weaponLevel);
  return { w: capW * scale, h: capH * scale };
}

function comboScoreMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(COMBO_MULT_CAP, 1 + (combo - 1) * COMBO_MULT_STEP);
}

function registerComboKill(g: GameModel, now: number): number {
  if (now <= g.comboExpiresAt) {
    g.comboCount += 1;
  } else {
    g.comboCount = 1;
  }
  g.comboExpiresAt = now + COMBO_WINDOW_MS;
  g.comboDisplayUntil = now + 900;
  if (g.comboCount > g.bestCombo) g.bestCombo = g.comboCount;
  return Math.round(SCORE_ENEMY * comboScoreMultiplier(g.comboCount));
}

function breakCombo(g: GameModel): void {
  g.comboCount = 0;
  g.comboExpiresAt = 0;
}

function notePlayerDamage(g: GameModel, damage: number): void {
  if (damage <= 0) return;
  g.stageDamaged = true;
  breakCombo(g);
}

function isActiveSkillLive(g: GameModel, now: number): boolean {
  return now < g.activeSkillUntil;
}

function pickStageObjective(): StageObjective {
  return STAGE_OBJECTIVES[Math.floor(Math.random() * STAGE_OBJECTIVES.length)];
}

function resetStageObjectiveState(g: GameModel, now: number): void {
  g.stageObjective = pickStageObjective();
  g.stageObjectiveCompleted = false;
  g.stageDamaged = false;
  g.stageBombsUsed = 0;
  g.stageStartedAt = now;
}

function isStageObjectiveMet(g: GameModel, now: number): boolean {
  const obj = g.stageObjective;
  if (!obj) return false;
  if (obj.id === "no_hit_preboss") return !g.stageDamaged;
  if (obj.id === "no_bomb_boss") return g.stageBombsUsed === 0;
  return now - g.stageStartedAt <= STAGE_FAST_CLEAR_MS;
}

function awardStageObjectiveBonus(g: GameModel, now: number): void {
  if (g.stageObjectiveCompleted || !g.stageObjective) return;
  if (!isStageObjectiveMet(g, now)) return;

  g.stageObjectiveCompleted = true;
  const bonus = STAGE_OBJECTIVE_BONUS_BASE * g.stage;
  g.score += bonus;
  g.bombs += 1;
  g.pickupToast = {
    text: `보너스 +${bonus.toLocaleString()} · 폭탄+1`,
    color: "#fde047",
    startAt: now,
    until: now + (g.hudMobile ? MOBILE_PICKUP_TOAST_MS + 400 : PICKUP_TOAST_MS + 400),
  };
  playItemPickupSound("power");
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
    weaponLevel: 1,
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
    kbMove: { ...EMPTY_MOVE },
    padMove: { ...EMPTY_MOVE },
    touchSteer: { ...EMPTY_TOUCH_STEER },
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
    healPulse: null,
    pickupToast: null,
    hudMobile: false,
    playStartedAt: 0,
    bombs: STARTING_BOMBS,
    bombCooldownUntil: 0,
    bombFlashUntil: 0,
    stageBombsLeft: 0,
    nextBombDropAt: Number.POSITIVE_INFINITY,
    extraLives: 0,
    stageLifeWillDrop: false,
    stageLifeDropped: false,
    nextLifeDropAt: Number.POSITIVE_INFINITY,
    comboCount: 0,
    comboExpiresAt: 0,
    comboDisplayUntil: 0,
    bestCombo: 0,
    stageObjective: null,
    stageObjectiveCompleted: false,
    stageDamaged: false,
    stageBombsUsed: 0,
    stageStartedAt: 0,
    activeSkillUntil: 0,
    activeSkillCooldownUntil: 0,
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
  resumeGameAudio();
  playGameStartSound();
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
  g.healPulse = null;
  g.pickupToast = null;
  clearTouchSteer(g.touchSteer);
  clearMovement(g.kbMove);
  clearMovement(g.padMove);
  g.phase = "playing";
  g.nextEnemySpawnAt = now + 550;
  g.nextEnemySpawnDelay = randBetween(
    ENEMY_SPAWN_MIN_MS * spawnIntervalScale(1, 1),
    ENEMY_SPAWN_MAX_MS * spawnIntervalScale(1, 1)
  );
  g.lastPlayerShot = now;
  g.playStartedAt = now;
  g.bombs = STARTING_BOMBS;
  g.bombCooldownUntil = 0;
  g.bombFlashUntil = 0;
  g.extraLives = 0;
  g.comboCount = 0;
  g.comboExpiresAt = 0;
  g.comboDisplayUntil = 0;
  g.bestCombo = 0;
  g.activeSkillUntil = 0;
  g.activeSkillCooldownUntil = 0;
  resetStageObjectiveState(g, now);
  initStageBombDrops(g, now);
  initStageLifeDrop(g, now);
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
  if (g.enemies.length >= MAX_ENEMIES) return;
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

function rollStageBombDropCount(): number {
  return (
    STAGE_BOMB_DROP_MIN +
    Math.floor(Math.random() * (STAGE_BOMB_DROP_MAX - STAGE_BOMB_DROP_MIN + 1))
  );
}

function initStageBombDrops(g: GameModel, now: number): void {
  g.stageBombsLeft = rollStageBombDropCount();
  g.nextBombDropAt = now + randBetween(BOMB_DROP_FIRST_MIN_MS, BOMB_DROP_FIRST_MAX_MS);
}

function scheduleNextBombDrop(g: GameModel, now: number): void {
  if (g.stageBombsLeft <= 0) {
    g.nextBombDropAt = Number.POSITIVE_INFINITY;
    return;
  }
  g.nextBombDropAt = now + randBetween(BOMB_DROP_INTERVAL_MIN_MS, BOMB_DROP_INTERVAL_MAX_MS);
}

function spawnBombItem(g: GameModel): void {
  if (g.items.length >= MAX_ITEMS) return;
  g.items.push({
    id: nextId(g),
    x: randBetween(20, CANVAS_W - ITEM_W - 20),
    y: -ITEM_H,
    w: ITEM_W,
    h: ITEM_H,
    type: "bomb",
    vy: ITEM_FALL_SPEED * 0.95,
  });
}

function updateStageBombDrops(g: GameModel, now: number): void {
  if (g.phase !== "playing" || g.stageBombsLeft <= 0) return;
  if (now < g.nextBombDropAt) return;
  spawnBombItem(g);
  g.stageBombsLeft -= 1;
  scheduleNextBombDrop(g, now);
}

function initStageLifeDrop(g: GameModel, now: number): void {
  g.stageLifeWillDrop = Math.random() < STAGE_LIFE_DROP_CHANCE;
  g.stageLifeDropped = false;
  g.nextLifeDropAt = g.stageLifeWillDrop
    ? now + randBetween(LIFE_DROP_FIRST_MIN_MS, LIFE_DROP_FIRST_MAX_MS)
    : Number.POSITIVE_INFINITY;
}

function spawnLifeItem(g: GameModel): void {
  if (g.items.length >= MAX_ITEMS) return;
  g.items.push({
    id: nextId(g),
    x: randBetween(20, CANVAS_W - ITEM_W - 20),
    y: -ITEM_H,
    w: ITEM_W,
    h: ITEM_H,
    type: "life",
    vy: ITEM_FALL_SPEED * 0.92,
  });
}

function updateStageLifeDrop(g: GameModel, now: number): void {
  if (g.phase !== "playing" || !g.stageLifeWillDrop || g.stageLifeDropped) return;
  if (now < g.nextLifeDropAt) return;
  spawnLifeItem(g);
  g.stageLifeDropped = true;
}

function tryConsumeExtraLife(g: GameModel, now: number): boolean {
  if (g.extraLives <= 0) return false;

  g.extraLives -= 1;
  const p = g.player;
  p.hp = p.maxHp;
  g.enemyBullets = [];
  g.missiles = [];
  g.laserVisual = null;
  g.playerInvulnerableUntil = now + RESPAWN_INVULN_MS;
  breakCombo(g);
  g.pickupToast = {
    text: "부활!",
    color: "#f472b6",
    startAt: now,
    until: now + (g.hudMobile ? MOBILE_PICKUP_TOAST_MS : PICKUP_TOAST_MS),
  };
  playItemPickupSound("life");
  return true;
}

function calcBossSpawnY(hudMobile: boolean): number {
  return hudMobile ? BOSS_SPAWN_Y_MOBILE : BOSS_SPAWN_Y_DESKTOP;
}

function spawnBoss(g: GameModel, now: number): void {
  const maxHp = calcBossMaxHp(g.stage);
  const stageMult = getStageDifficulty(g.stage);
  const bossMult = getBossStageMult(g.stage);
  const dmg = Math.round(55 * stageMult * bossMult);
  g.enemies = [];
  g.boss = {
    id: nextId(g),
    x: CANVAS_W / 2 - BOSS_W / 2,
    y: calcBossSpawnY(g.hudMobile),
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
  playBossSpawnSound();
}

function spawnSpreadBullets(g: GameModel, p: Player, now: number): void {
  const count = Math.min(
    Math.max(3, Math.floor(p.missileCount)),
    MAX_SPREAD_PER_SHOT
  );
  if (g.missiles.length >= MAX_MISSILES - count) return;
  const skillActive = isActiveSkillLive(g, now);
  const visWl = visualWeaponLevel(p.weaponLevel);
  const visCount = Math.min(count, VISUAL_SPREAD_COUNT_CAP);
  let halfSpread = Math.min(
    VISUAL_SPREAD_HALF_CAP,
    0.22 + visWl * 0.065 + Math.max(0, visCount - 3) * 0.016
  );
  if (skillActive) halfSpread *= 0.5;
  const baseAngle = -Math.PI / 2;
  const speed = MISSILE_SPEED * (1 + p.weaponLevel * 0.05) * (skillActive ? 1.18 : 1);
  const baseX = p.x + p.w / 2 - MISSILE_W / 2;
  const baseY = p.y - MISSILE_H;
  const baseDamage = Math.round(p.attack * (1 + p.weaponLevel * 0.12));
  const damage = skillActive ? Math.round(baseDamage * 1.35) : baseDamage;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = baseAngle + (t * 2 - 1) * halfSpread;
    g.missiles.push({
      id: nextId(g),
      x: baseX,
      y: baseY,
      w: MISSILE_W,
      h: MISSILE_H,
      damage,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      pierce: skillActive,
    });
  }
  playSpreadShotSound(now);
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
  for (let t = 0; t <= 1; t += 0.04) {
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
  playEnemyKillSound(now);
  const p = g.player;
  g.score += registerComboKill(g, now);
  p.exp += EXP_PER_KILL;
  tryDropItem(g, e.x + e.w / 2, e.y + e.h / 2);
  g.enemies.splice(idx, 1);
  applyLevelUps(g, now);
}

function defeatBoss(g: GameModel, now: number): void {
  awardStageObjectiveBonus(g, now);
  g.score += SCORE_BOSS;
  advanceStageAfterBoss(g, now);
}

function updateActiveLaserWeapon(g: GameModel, p: Player, dt: number, now: number): void {
  playLaserPulseSound(now);

  const sx = p.x + p.w / 2;
  const sy = p.y + 4;
  const ex = sx;
  const ey = 16;
  const cx = sx;
  const cy = (sy + ey) / 2;
  const hitThickness = 10 + p.weaponLevel * 2.2;
  const drawThickness = visualLaserDrawThickness(p.weaponLevel) * 1.4;
  const dps = p.attack * (4.5 + p.weaponLevel * 0.72);
  const damage = dps * dt;

  g.laserVisual = {
    sx,
    sy,
    cx,
    cy,
    ex,
    ey,
    thickness: hitThickness,
    drawThickness,
  };

  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (!laserHitsRect(g.laserVisual, e.x, e.y, e.w, e.h)) continue;
    e.hp -= damage;
    if (e.hp <= 0) {
      killEnemy(g, e, i, now);
    } else {
      playEnemyHitSound(now, false);
    }
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (laserHitsRect(g.laserVisual, b.x, b.y, b.w, b.h)) {
      b.hp -= damage;
      if (b.hp <= 0) {
        defeatBoss(g, now);
      } else {
        playBossHitSound(now);
      }
    }
  }
}

function updateLaserWeapon(g: GameModel, p: Player, dt: number, now: number): void {
  if (isActiveSkillLive(g, now)) {
    updateActiveLaserWeapon(g, p, dt, now);
    return;
  }

  playLaserPulseSound(now);

  const sx = p.x + p.w / 2;
  const sy = p.y + 4;
  const target = findLaserTarget(g, sx, sy);
  const sway = Math.sin(now / 280) * (18 + visualWeaponLevel(p.weaponLevel) * 2);
  const cx = sx + (target.x - sx) * 0.42 + sway;
  const cy = sy - Math.max(120, (sy - target.y) * 0.55);
  const hitThickness = 4 + p.weaponLevel * 2.4;
  const drawThickness = visualLaserDrawThickness(p.weaponLevel);
  const dps = p.attack * (2.4 + p.weaponLevel * 0.58);
  const damage = dps * dt;

  g.laserVisual = {
    sx,
    sy,
    cx,
    cy,
    ex: target.x,
    ey: target.y,
    thickness: hitThickness,
    drawThickness,
  };

  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (!laserHitsRect(g.laserVisual, e.x, e.y, e.w, e.h)) continue;
    e.hp -= damage;
    if (e.hp <= 0) {
      killEnemy(g, e, i, now);
    } else {
      playEnemyHitSound(now, false);
    }
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (laserHitsRect(g.laserVisual, b.x, b.y, b.w, b.h)) {
      b.hp -= damage;
      if (b.hp <= 0) {
        defeatBoss(g, now);
      } else {
        playBossHitSound(now);
      }
    }
  }
}

function useActiveSkill(g: GameModel, now: number): boolean {
  if (g.phase !== "playing") return false;
  if (now < g.activeSkillCooldownUntil) return false;
  if (isActiveSkillLive(g, now)) return false;

  resumeGameAudio();
  g.activeSkillUntil = now + ACTIVE_SKILL_DURATION_MS;
  g.activeSkillCooldownUntil = now + ACTIVE_SKILL_COOLDOWN_MS;
  const p = g.player;
  const label = p.planeType === "spread" ? "관통탄!" : "관통빔!";
  g.pickupToast = {
    text: label,
    color: p.planeType === "spread" ? "#38bdf8" : "#c084fc",
    startAt: now,
    until: now + (g.hudMobile ? MOBILE_PICKUP_TOAST_MS : PICKUP_TOAST_MS),
  };
  playStageAdvanceSound();
  return true;
}

let sfxAudioCtx: AudioContext | null = null;
let lastSpreadShotSfxAt = 0;
let lastLaserPulseSfxAt = 0;
let lastEnemyHitSfxAt = 0;
let lastBossHitSfxAt = 0;
let lastPlayerHitSfxAt = 0;
let lastContactHitSfxAt = 0;

const SPREAD_SHOT_SFX_COOLDOWN_MS = 145;
const LASER_PULSE_SFX_COOLDOWN_MS = 78;
const ENEMY_HIT_SFX_COOLDOWN_MS = 48;
const BOSS_HIT_SFX_COOLDOWN_MS = 72;
const PLAYER_HIT_SFX_COOLDOWN_MS = 130;
const CONTACT_HIT_SFX_COOLDOWN_MS = 220;

function getSfxContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sfxAudioCtx) sfxAudioCtx = new Ctx();
  return sfxAudioCtx;
}

function resumeGameAudio(): void {
  const ctx = getSfxContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

function ensureSfxContext(): AudioContext | null {
  const ctx = getSfxContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function sfxCooldownOk(now: number, lastAt: number, cooldownMs: number): boolean {
  return now - lastAt >= cooldownMs;
}

function playSfxTone(
  ctx: AudioContext,
  t0: number,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number | null,
  duration: number,
  peak: number,
  delay = 0
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  const start = t0 + delay;
  osc.frequency.setValueAtTime(freqStart, start);
  if (freqEnd !== null && freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(freqEnd, 1),
      start + duration * 0.72
    );
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playSfxArpeggio(
  ctx: AudioContext,
  t0: number,
  type: OscillatorType,
  notes: { f: number; d: number; dur: number; p: number }[]
): void {
  for (const n of notes) {
    playSfxTone(ctx, t0, type, n.f, null, n.dur, n.p, n.d);
  }
}

function playGameStartSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sine", 220, 880, 0.22, 0.09);
  playSfxTone(ctx, t0, "triangle", 440, 1320, 0.18, 0.055, 0.04);
}

function playSpreadShotSound(now: number): void {
  if (!sfxCooldownOk(now, lastSpreadShotSfxAt, SPREAD_SHOT_SFX_COOLDOWN_MS)) return;
  lastSpreadShotSfxAt = now;

  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sine", 1180, 620, 0.07, 0.055);
  playSfxTone(ctx, t0, "triangle", 880, 440, 0.05, 0.038, 0.012);
}

function playLaserPulseSound(now: number): void {
  if (!sfxCooldownOk(now, lastLaserPulseSfxAt, LASER_PULSE_SFX_COOLDOWN_MS)) return;
  lastLaserPulseSfxAt = now;

  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 280, 520, 0.09, 0.042);
  playSfxTone(ctx, t0, "sine", 640, 960, 0.07, 0.028, 0.018);
}

function playEnemyHitSound(now: number, isBoss: boolean): void {
  const cooldown = isBoss ? BOSS_HIT_SFX_COOLDOWN_MS : ENEMY_HIT_SFX_COOLDOWN_MS;
  const lastAt = isBoss ? lastBossHitSfxAt : lastEnemyHitSfxAt;
  if (!sfxCooldownOk(now, lastAt, cooldown)) return;
  if (isBoss) lastBossHitSfxAt = now;
  else lastEnemyHitSfxAt = now;

  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  if (isBoss) {
    playSfxTone(ctx, t0, "square", 140, 72, 0.09, 0.058);
    playSfxTone(ctx, t0, "triangle", 95, 55, 0.07, 0.032, 0.02);
  } else {
    playSfxTone(ctx, t0, "triangle", 420, 180, 0.06, 0.062);
    playSfxTone(ctx, t0, "sine", 660, 330, 0.045, 0.035, 0.008);
  }
}

function playBossHitSound(now: number): void {
  playEnemyHitSound(now, true);
}

function playEnemyKillSound(now: number): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "square", 720, 160, 0.11, 0.075);
  playSfxTone(ctx, t0, "sine", 980, 420, 0.14, 0.05, 0.03);
  playSfxTone(ctx, t0, "triangle", 1320, 880, 0.1, 0.038, 0.06);
}

function playPlayerHitSound(now: number): void {
  if (!sfxCooldownOk(now, lastPlayerHitSfxAt, PLAYER_HIT_SFX_COOLDOWN_MS)) return;
  lastPlayerHitSfxAt = now;

  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 240, 78, 0.16, 0.088);
  playSfxTone(ctx, t0, "square", 120, 58, 0.1, 0.04, 0.016);
}

function playPlayerContactSound(now: number): void {
  if (!sfxCooldownOk(now, lastContactHitSfxAt, CONTACT_HIT_SFX_COOLDOWN_MS)) return;
  lastContactHitSfxAt = now;

  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 180, 95, 0.12, 0.055);
}

function playBossDefeatSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxArpeggio(ctx, t0, "triangle", [
    { f: 523, d: 0, dur: 0.14, p: 0.095 },
    { f: 659, d: 0.07, dur: 0.14, p: 0.095 },
    { f: 784, d: 0.14, dur: 0.14, p: 0.1 },
    { f: 1047, d: 0.22, dur: 0.48, p: 0.115 },
  ]);
  playSfxArpeggio(ctx, t0, "sine", [
    { f: 1568, d: 0.32, dur: 0.35, p: 0.045 },
    { f: 2093, d: 0.42, dur: 0.28, p: 0.038 },
  ]);
}

function playBossSpawnSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 88, 44, 0.38, 0.1);
  playSfxTone(ctx, t0, "square", 220, 165, 0.12, 0.055, 0.08);
  playSfxTone(ctx, t0, "sine", 440, 330, 0.1, 0.05, 0.16);
  playSfxTone(ctx, t0, "sine", 330, 440, 0.1, 0.05, 0.28);
  playSfxTone(ctx, t0, "sine", 440, 330, 0.1, 0.05, 0.4);
}

function playBossShootSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 380, 95, 0.13, 0.048);
  playSfxTone(ctx, t0, "triangle", 260, 120, 0.09, 0.032, 0.02);
}

function playBombSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxTone(ctx, t0, "sawtooth", 88, 36, 0.42, 0.14);
  playSfxTone(ctx, t0, "triangle", 140, 52, 0.36, 0.1, 0.04);
  playSfxTone(ctx, t0, "sine", 220, 55, 0.28, 0.07, 0.08);
}

function playLevelUpSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxArpeggio(ctx, t0, "sine", [
    { f: 523, d: 0, dur: 0.1, p: 0.07 },
    { f: 659, d: 0.06, dur: 0.1, p: 0.07 },
    { f: 784, d: 0.12, dur: 0.1, p: 0.075 },
    { f: 988, d: 0.18, dur: 0.12, p: 0.08 },
    { f: 1175, d: 0.26, dur: 0.22, p: 0.085 },
  ]);
}

function playGameOverSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  playSfxArpeggio(ctx, t0, "triangle", [
    { f: 330, d: 0, dur: 0.22, p: 0.08 },
    { f: 262, d: 0.16, dur: 0.24, p: 0.075 },
    { f: 196, d: 0.34, dur: 0.38, p: 0.07 },
  ]);
}

function playStageAdvanceSound(): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.52;
  playSfxTone(ctx, t0, "sine", 880, 1175, 0.22, 0.065);
  playSfxTone(ctx, t0, "triangle", 1320, 1760, 0.18, 0.04, 0.08);
}

function playItemPickupSound(type: ItemType): void {
  const ctx = ensureSfxContext();
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const peak = 0.11;

  if (type === "heal") {
    playSfxTone(ctx, t0, "sine", 392, 784, 0.26, peak);
  } else if (type === "missile") {
    playSfxTone(ctx, t0, "triangle", 494, 988, 0.18, peak * 0.9);
  } else if (type === "bomb") {
    playSfxTone(ctx, t0, "sawtooth", 120, 240, 0.16, peak * 0.85);
    playSfxTone(ctx, t0, "square", 180, 360, 0.12, peak * 0.55, 0.04);
  } else if (type === "life") {
    playSfxTone(ctx, t0, "sine", 440, 880, 0.24, peak);
    playSfxTone(ctx, t0, "triangle", 660, 1320, 0.16, peak * 0.55, 0.05);
  } else {
    playSfxTone(ctx, t0, "square", 196, 523, 0.2, peak * 0.65);
  }
}

function pickupToastMeta(
  type: ItemType,
  planeType: PlaneType
): { text: string; color: string } {
  if (type === "heal") return { text: "HP 회복!", color: "#4ade80" };
  if (type === "bomb") return { text: "폭탄 +1!", color: "#fb923c" };
  if (type === "life") return { text: "생명 +1!", color: "#f472b6" };
  if (type === "power") return { text: "공격력 UP!", color: "#fbbf24" };
  if (planeType === "spread") return { text: "탄환 UP!", color: "#60a5fa" };
  return { text: "레이저 UP!", color: "#c084fc" };
}

function showPickupFeedback(
  g: GameModel,
  type: ItemType,
  planeType: PlaneType,
  now: number
): void {
  const meta = pickupToastMeta(type, planeType);
  g.pickupToast = {
    text: meta.text,
    color: meta.color,
    startAt: now,
    until: now + (g.hudMobile ? MOBILE_PICKUP_TOAST_MS : PICKUP_TOAST_MS),
  };
  playItemPickupSound(type);
}

function applyItemPickup(g: GameModel, p: Player, type: ItemType, now: number): void {
  if (type === "heal") {
    const prevHp = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.35));
    g.healPulse = {
      fromHp: prevHp,
      toHp: p.hp,
      startAt: now,
      until: now + HEAL_PULSE_MS,
    };
  } else if (type === "missile") {
    if (p.planeType === "spread") {
      p.missileCount += 4;
      p.weaponLevel += 1;
      p.attack += 3;
    } else {
      p.weaponLevel += 2;
      p.attack += 5;
    }
  } else if (type === "bomb") {
    g.bombs += 1;
  } else if (type === "life") {
    g.extraLives += 1;
  } else {
    p.attack += 7;
  }
  showPickupFeedback(g, type, p.planeType, now);
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
  playBossDefeatSound();
  playStageAdvanceSound();
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
  resetStageObjectiveState(g, now);
  initStageBombDrops(g, now);
  initStageLifeDrop(g, now);
}

function applyLevelUps(g: GameModel, now: number): void {
  const p = g.player;
  while (p.exp >= expToNextLevel(p.level)) {
    p.exp -= expToNextLevel(p.level);
    p.level += 1;
    playLevelUpSound();
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

function spawnBossBullet(
  g: GameModel,
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  now: number
): void {
  if (g.enemyBullets.length >= MAX_ENEMY_BULLETS) return;
  g.enemyBullets.push({
    id: nextId(g),
    x,
    y,
    w: ENEMY_BULLET_W,
    h: ENEMY_BULLET_H,
    damage,
    vx,
    vy,
    armedAfter: now + ENEMY_BULLET_ARM_MS,
  });
}

type BossPatternCtx = {
  g: GameModel;
  b: Boss;
  px: number;
  py: number;
  now: number;
  speed: number;
  damage: number;
};

function bossPatternAimedSingle(c: BossPatternCtx): void {
  const cx = c.b.x + c.b.w / 2 - ENEMY_BULLET_W / 2;
  const cy = c.b.y + c.b.h + 6;
  const tx = c.px + PLAYER_W / 2;
  const ty = c.py + PLAYER_H / 2;
  const aimX = cx + ENEMY_BULLET_W / 2;
  const aimY = cy + ENEMY_BULLET_H / 2;
  const dx = tx - aimX;
  const dy = ty - aimY;
  const len = Math.hypot(dx, dy) || 1;
  spawnBossBullet(
    c.g,
    cx,
    cy,
    (dx / len) * c.speed,
    (dy / len) * c.speed,
    c.damage,
    c.now
  );
}

function bossPatternTripleFan(c: BossPatternCtx): void {
  const cx = c.b.x + c.b.w / 2;
  const cy = c.b.y + c.b.h + 8;
  const tx = c.px + PLAYER_W / 2;
  const ty = c.py + PLAYER_H / 2;
  const base = Math.atan2(ty - cy, tx - cx);
  const spread = 0.28;
  for (const offset of [-spread, 0, spread]) {
    const angle = base + offset;
    spawnBossBullet(
      c.g,
      cx - ENEMY_BULLET_W / 2,
      cy,
      Math.cos(angle) * c.speed,
      Math.sin(angle) * c.speed,
      c.damage,
      c.now
    );
  }
}

function bossPatternRingBurst(c: BossPatternCtx): void {
  const cx = c.b.x + c.b.w / 2;
  const cy = c.b.y + c.b.h * 0.55;
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.PI / 2;
    spawnBossBullet(
      c.g,
      cx - ENEMY_BULLET_W / 2,
      cy,
      Math.cos(angle) * c.speed * 0.82,
      Math.sin(angle) * c.speed * 0.82,
      Math.round(c.damage * 0.85),
      c.now
    );
  }
}

function bossPatternSideStreams(c: BossPatternCtx): void {
  const y = c.b.y + c.b.h + 4;
  const leftX = c.b.x + 8;
  const rightX = c.b.x + c.b.w - ENEMY_BULLET_W - 8;
  const streamSpeed = c.speed * 0.92;
  for (const x of [leftX, rightX]) {
    spawnBossBullet(c.g, x, y, 0, streamSpeed, c.damage, c.now);
    spawnBossBullet(
      c.g,
      x,
      y,
      x < c.b.x + c.b.w / 2 ? -streamSpeed * 0.35 : streamSpeed * 0.35,
      streamSpeed,
      Math.round(c.damage * 0.9),
      c.now
    );
  }
}

function bossPatternCrossBurst(c: BossPatternCtx): void {
  const cx = c.b.x + c.b.w / 2 - ENEMY_BULLET_W / 2;
  const cy = c.b.y + c.b.h + 6;
  const diag = c.speed * 0.72;
  const dirs = [
    { vx: 0, vy: c.speed },
    { vx: -diag, vy: diag },
    { vx: diag, vy: diag },
    { vx: 0, vy: c.speed * 1.05 },
  ];
  for (const d of dirs) {
    spawnBossBullet(c.g, cx, cy, d.vx, d.vy, Math.round(c.damage * 0.88), c.now);
  }
}

const BOSS_ATTACK_PATTERNS: ((c: BossPatternCtx) => void)[] = [
  bossPatternAimedSingle,
  bossPatternTripleFan,
  bossPatternRingBurst,
  bossPatternSideStreams,
  bossPatternCrossBurst,
];

function bossShoot(g: GameModel, b: Boss, px: number, py: number, now: number): void {
  if (g.enemyBullets.length >= MAX_ENEMY_BULLETS) return;
  const shootEvery = Math.max(340, BOSS_SHOOT_MS - (g.stage - 1) * 32 - (g.player.level - 10) * 18);
  if (now - b.lastShot < shootEvery) return;
  b.lastShot = now;

  const speed = ENEMY_BULLET_SPEED * (1 + (g.stage - 1) * 0.06);
  const damage = Math.min(b.damage, Math.round(28 * getStageDifficulty(g.stage)));
  const patternCount = Math.min(
    BOSS_ATTACK_PATTERNS.length,
    Math.max(1, g.player.level - 9)
  );
  const ctx: BossPatternCtx = { g, b, px, py, now, speed, damage };

  for (let i = 0; i < patternCount; i++) {
    if (g.enemyBullets.length >= MAX_ENEMY_BULLETS) break;
    BOSS_ATTACK_PATTERNS[i](ctx);
  }
  playBossShootSound();
}

function useBomb(g: GameModel, now: number): boolean {
  if (g.phase !== "playing" || g.bombs <= 0) return false;
  if (now < g.bombCooldownUntil) return false;

  resumeGameAudio();
  const p = g.player;
  const damage = Math.round(p.attack * BOMB_ATTACK_MULT);
  g.bombs -= 1;
  g.stageBombsUsed += 1;
  g.bombCooldownUntil = now + BOMB_COOLDOWN_MS;
  g.bombFlashUntil = now + BOMB_FLASH_MS;
  g.enemyBullets = [];

  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    e.hp -= damage;
    if (e.hp <= 0) {
      killEnemy(g, e, i, now);
    } else {
      playEnemyHitSound(now, false);
    }
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    b.hp -= damage;
    if (b.hp <= 0) {
      defeatBoss(g, now);
    } else {
      playBossHitSound(now);
    }
  }

  playBombSound();
  g.pickupToast = {
    text: `💣 ${damage.toLocaleString()} dmg`,
    color: "#fb923c",
    startAt: now,
    until: now + (g.hudMobile ? MOBILE_PICKUP_TOAST_MS : PICKUP_TOAST_MS),
  };
  return true;
}

function drawBombFlash(ctx: CanvasRenderingContext2D, g: GameModel, now: number): void {
  if (!g.bombFlashUntil || now >= g.bombFlashUntil) return;
  const remain = g.bombFlashUntil - now;
  const t = 1 - remain / BOMB_FLASH_MS;
  const alpha = (1 - t) * 0.62;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H * 0.4;
  const r = CANVAS_W * (0.25 + t * 0.55);

  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(255, 237, 213, ${alpha})`);
  grad.addColorStop(0.35, `rgba(251, 146, 60, ${alpha * 0.75})`);
  grad.addColorStop(1, "rgba(249, 115, 22, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
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
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(card.x, card.y, card.w, card.h, 16);
    } else {
      ctx.rect(card.x, card.y, card.w, card.h);
    }
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
  const w = laser.drawThickness;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(192, 132, 252, 0.25)";
  ctx.lineWidth = w * 2.4;
  ctx.beginPath();
  ctx.moveTo(laser.sx, laser.sy);
  ctx.quadraticCurveTo(laser.cx, laser.cy, laser.ex, laser.ey);
  ctx.stroke();

  ctx.strokeStyle = "rgba(224, 231, 255, 0.85)";
  ctx.lineWidth = w;
  ctx.shadowColor = "#c084fc";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(laser.sx, laser.sy);
  ctx.quadraticCurveTo(laser.cx, laser.cy, laser.ex, laser.ey);
  ctx.stroke();

  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, now: number): void {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  const pulse = 1 + Math.sin(now / 220 + it.id) * 0.08;
  const r = (it.w / 2) * pulse;

  ctx.save();
  ctx.translate(cx, cy);

  if (it.type === "heal") {
    ctx.fillStyle = "rgba(62, 207, 142, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3ecf8e";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ecfdf5";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", 0, 1);
  } else if (it.type === "missile") {
    ctx.fillStyle = "rgba(108, 182, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(0, -r - 5);
    ctx.lineTo(r + 5, 0);
    ctx.lineTo(0, r + 5);
    ctx.lineTo(-r - 5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6cb6ff";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, r * 0.55);
    ctx.lineTo(-r, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("M", 0, r * 0.1);
  } else if (it.type === "bomb") {
    ctx.fillStyle = "rgba(251, 146, 60, 0.38)";
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffedd5";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#431407";
    ctx.font = "bold 14px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", 0, 1);
  } else if (it.type === "life") {
    ctx.fillStyle = "rgba(244, 114, 182, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.bezierCurveTo(r * 0.95, -r * 0.45, r * 1.05, r * 0.55, 0, r * 1.05);
    ctx.bezierCurveTo(-r * 1.05, r * 0.55, -r * 0.95, -r * 0.45, 0, r * 0.35);
    ctx.fill();
    ctx.strokeStyle = "#fce7f3";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+1", 0, r * 0.42);
  } else {
    ctx.fillStyle = "rgba(240, 180, 41, 0.35)";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r + 5 : r * 0.45;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0b429";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", 0, 1);
  }

  ctx.restore();
}

/** 모바일은 캔버스가 축소되어 HUD 글자·게이지가 함께 작아지므로 별도 레이아웃 적용 */
type HudLayout = {
  mobile: boolean;
  marginX: number;
  barW: number;
  hpBarH: number;
  expBarH: number;
  hpY: number;
  expY: number;
  statY1: number;
  statY2: number;
  fontHp: string;
  fontExp: string;
  fontStat: string;
  fontStatBold: string;
  fontBossTitle: string;
  fontBossHp: string;
  bossBarH: number;
  bossY: number;
  toastYRatio: number;
  toastFont: string;
  showVersion: boolean;
  showLegend: boolean;
};

function getHudLayout(mobile: boolean): HudLayout {
  if (!mobile) {
    return {
      mobile: false,
      marginX: 12,
      barW: 220,
      hpBarH: 14,
      expBarH: 12,
      hpY: 12,
      expY: 32,
      statY1: 62,
      statY2: 62,
      fontHp: "12px ui-monospace, monospace",
      fontExp: "12px ui-monospace, monospace",
      fontStat: "14px ui-monospace, monospace",
      fontStatBold: "bold 14px ui-monospace, monospace",
      fontBossTitle: "bold 14px ui-sans-serif, system-ui",
      fontBossHp: "12px ui-monospace, monospace",
      bossBarH: 20,
      bossY: 86,
      toastYRatio: 0.36,
      toastFont: "bold 26px ui-sans-serif, system-ui",
      showVersion: true,
      showLegend: true,
    };
  }

  const marginX = 10;
  const barW = CANVAS_W - marginX * 2;
  const hpBarH = 28;
  const expBarH = 5;
  const hpY = 8;
  const expY = hpY + hpBarH + 5;
  const statY1 = expY + expBarH + 10;

  return {
    mobile: true,
    marginX,
    barW,
    hpBarH,
    expBarH,
    hpY,
    expY,
    statY1,
    statY2: statY1,
    fontHp: "bold 17px ui-sans-serif, system-ui",
    fontExp: "13px ui-monospace, monospace",
    fontStat: "15px ui-monospace, monospace",
    fontStatBold: "bold 17px ui-monospace, monospace",
    fontBossTitle: "bold 19px ui-sans-serif, system-ui",
    fontBossHp: "15px ui-monospace, monospace",
    bossBarH: 24,
    bossY: statY1 + 22,
    toastYRatio: 0.3,
    toastFont: "bold 38px ui-sans-serif, system-ui",
    showVersion: false,
    showLegend: false,
  };
}

function hudBackdropHeight(g: GameModel, layout: HudLayout): number {
  if (g.boss && g.boss.hp > 0) {
    return layout.bossY + layout.bossBarH + 24;
  }
  return layout.statY1 + 14;
}

function drawHudBackdrop(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  layout: HudLayout
): void {
  if (!layout.mobile || g.phase !== "playing") return;
  const h = hudBackdropHeight(g, layout);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(2, 6, 23, 0.58)");
  grad.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, h);
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  stroke = "rgba(0,0,0,0.65)",
  lineWidth = 3
): void {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawComboBadge(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  now: number,
  layout: HudLayout
): void {
  if (g.comboCount < 2 || now > g.comboExpiresAt) return;

  const mult = comboScoreMultiplier(g.comboCount);
  const text = `${g.comboCount} COMBO ×${mult.toFixed(1)}`;
  const pulse = now < g.comboDisplayUntil ? 1 + Math.sin(now / 60) * 0.06 : 1;
  ctx.save();
  ctx.font = layout.mobile ? "bold 18px ui-sans-serif, system-ui" : "bold 16px ui-monospace, monospace";
  const tw = ctx.measureText(text).width;
  const x = layout.mobile ? CANVAS_W / 2 : CANVAS_W - tw - 18;
  const y = layout.mobile ? layout.statY1 + 28 : layout.statY1 + 18;
  ctx.translate(x + tw / 2, y);
  ctx.scale(pulse, pulse);
  drawOutlinedText(ctx, text, -tw / 2, 0, "#fde047", "rgba(0,0,0,0.55)", 2);
  ctx.restore();
}

function drawStageObjectiveHud(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  layout: HudLayout
): void {
  const obj = g.stageObjective;
  if (!obj || g.stageObjectiveCompleted) return;

  const label = `보너스: ${obj.shortLabel}`;
  ctx.font = layout.mobile ? "bold 12px ui-sans-serif, system-ui" : "11px ui-monospace, monospace";
  const tw = ctx.measureText(label).width;
  const padX = 8;
  const bh = layout.mobile ? 20 : 18;
  const bw = tw + padX * 2;
  const bx = layout.mobile ? layout.marginX : CANVAS_W - bw - 14;
  const by = layout.mobile ? layout.statY1 + 46 : layout.statY1 + 36;

  fillRoundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.strokeStyle = "rgba(253, 224, 71, 0.35)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, bh / 2);
  drawOutlinedText(
    ctx,
    label,
    bx + padX,
    by + bh / 2 + (layout.mobile ? 4 : 3),
    "#fde68a",
    "rgba(0,0,0,0.45)",
    2
  );
}

function drawMobileScoreBadge(
  ctx: CanvasRenderingContext2D,
  score: number,
  layout: HudLayout
): void {
  const text = score.toLocaleString();
  ctx.font = layout.fontStatBold;
  const tw = ctx.measureText(text).width;
  const padX = 10;
  const bh = layout.hpBarH;
  const bw = tw + padX * 2;
  const bx = layout.marginX + layout.barW - bw;
  const by = layout.hpY;

  fillRoundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
  ctx.lineWidth = 1.5;
  strokeRoundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, bh / 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawOutlinedText(ctx, text, bx + bw / 2, by + bh / 2, "#fde047", "rgba(0,0,0,0.55)", 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawItemLegend(
  ctx: CanvasRenderingContext2D,
  planeType: PlaneType,
  layout: HudLayout
): void {
  if (!layout.showLegend) return;

  const missileLabel = planeType === "spread" ? "탄환↑" : "레이저↑";
  const entries: { color: string; label: string; sym: string }[] = [
    { color: "#3ecf8e", label: "HP회복", sym: "+" },
    { color: "#6cb6ff", label: missileLabel, sym: "M" },
    { color: "#f0b429", label: "공격↑", sym: "P" },
    { color: "#f472b6", label: "생명+1", sym: "♥" },
  ];

  const y = CANVAS_H - 26;
  let x = 14;
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const e of entries) {
    const w = e.label.length > 4 ? 58 : 52;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x - 2, y - 10, w, 18);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(x + 7, y - 1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText(e.sym, x + 5, y);
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(e.label, x + 16, y - 1);
    x += w + 4;
  }
}

function drawPlayerHpBar(
  ctx: CanvasRenderingContext2D,
  p: Player,
  healPulse: HealPulse | null,
  now: number,
  layout: HudLayout
): void {
  const barW = layout.barW;
  const barH = layout.hpBarH;
  const x = layout.marginX;
  const y = layout.hpY;

  let displayHp = p.hp;
  let pulsing = false;
  let pulseScale = 1;

  if (healPulse && now < healPulse.until) {
    pulsing = true;
    const dur = healPulse.until - healPulse.startAt;
    const t = Math.min(1, (now - healPulse.startAt) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    displayHp = healPulse.fromHp + (healPulse.toHp - healPulse.fromHp) * eased;
    pulseScale = 1 + Math.sin((now - healPulse.startAt) / 70) * 0.12;
  } else if (healPulse && now >= healPulse.until) {
    displayHp = p.hp;
  }

  const hpRatio = Math.max(0, Math.min(1, displayHp / p.maxHp));

  const hpRadius = layout.mobile ? barH / 2 : 2;
  const hpDrawW = layout.mobile ? barW - 112 : barW;

  if (pulsing) {
    const glowA = 0.35 + Math.sin((now - healPulse!.startAt) / 90) * 0.2;
    ctx.save();
    ctx.shadowColor = "#4ade80";
    ctx.shadowBlur = 14 * pulseScale;
    ctx.strokeStyle = `rgba(74, 222, 128, ${glowA})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 2, y - 2, hpDrawW + 4, barH + 4);
    ctx.restore();
  }

  ctx.fillStyle = "#1f2937";
  if (layout.mobile) {
    fillRoundRect(ctx, x, y, hpDrawW, barH, hpRadius);
  } else {
    ctx.fillRect(x, y, hpDrawW, barH);
  }

  if (pulsing && healPulse) {
    const oldRatio = Math.max(0, Math.min(1, healPulse.fromHp / p.maxHp));
    ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
    if (layout.mobile) {
      fillRoundRect(ctx, x, y, hpDrawW * oldRatio, barH, hpRadius);
    } else {
      ctx.fillRect(x, y, hpDrawW * oldRatio, barH);
    }
  }

  ctx.fillStyle = pulsing ? "#4ade80" : hpRatio > 0.35 ? "#22c55e" : "#ef4444";
  if (layout.mobile) {
    if (hpRatio > 0) fillRoundRect(ctx, x, y, hpDrawW * hpRatio, barH, hpRadius);
  } else {
    ctx.fillRect(x, y, hpDrawW * hpRatio, barH);
  }

  ctx.strokeStyle = pulsing ? "#bbf7d0" : layout.mobile ? "rgba(148, 163, 184, 0.35)" : "#9ca3af";
  ctx.lineWidth = pulsing ? 2 : layout.mobile ? 1 : 1;
  if (layout.mobile) {
    strokeRoundRect(ctx, x + 0.5, y + 0.5, hpDrawW - 1, barH - 1, hpRadius);
  } else {
    ctx.strokeRect(x + 0.5, y + 0.5, hpDrawW - 1, barH - 1);
  }

  const hpText = `HP ${Math.max(0, Math.ceil(displayHp))}/${p.maxHp}`;
  ctx.font = layout.fontHp;

  if (layout.mobile) {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    drawOutlinedText(ctx, hpText, x + 14, y + barH / 2, pulsing ? "#ecfdf5" : "#f8fafc", "rgba(0,0,0,0.55)", 2);
    if (pulsing) {
      ctx.font = "bold 14px ui-sans-serif, system-ui";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      drawOutlinedText(ctx, "+회복", x + hpDrawW - 8, y - 3, "#86efac", "rgba(0,0,0,0.45)", 2);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return;
  }

  ctx.fillStyle = pulsing ? "#ecfdf5" : "#e5e7eb";
  ctx.fillText(hpText, 18, 23);
  if (pulsing) {
    ctx.fillStyle = "#86efac";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText("+회복", x + barW, 23);
    ctx.textAlign = "left";
  }
}

function drawBossHealthBar(
  ctx: CanvasRenderingContext2D,
  b: Boss,
  stage: number,
  layout: HudLayout
): void {
  const barW = CANVAS_W - layout.marginX * 2;
  const barH = layout.bossBarH;
  const x = layout.marginX;
  const y = layout.bossY;
  const ratio = Math.max(0, Math.min(1, b.hp / b.maxHp));
  const labelPad = layout.mobile ? 30 : 24;

  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(x - 6, y - labelPad, barW + 12, barH + labelPad + 6);

  ctx.fillStyle = "#fca5a5";
  ctx.font = layout.fontBossTitle;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (layout.mobile) {
    drawOutlinedText(ctx, `◆ BOSS · STAGE ${stage}`, x, y - 10, "#fca5a5", "rgba(0,0,0,0.55)", 2);
  } else {
    ctx.fillText(`◆ BOSS  STAGE ${stage}`, x, y - 8);
  }

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x, y, barW, barH);
  const grad = ratio > 0.45 ? "#ef4444" : ratio > 0.2 ? "#dc2626" : "#991b1b";
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW * ratio, barH);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = layout.mobile ? 2.5 : 2;
  ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, barH - 1);

  const hpLabel = `${Math.max(0, Math.ceil(b.hp)).toLocaleString()} / ${b.maxHp.toLocaleString()}`;
  ctx.font = layout.fontBossHp;
  ctx.textAlign = "right";
  if (layout.mobile) {
    drawOutlinedText(ctx, hpLabel, x + barW, y - 10, "#e2e8f0", "rgba(0,0,0,0.55)", 2);
  } else {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(hpLabel, x + barW, y - 8);
  }
  ctx.textAlign = "left";
}

function drawPickupToast(
  ctx: CanvasRenderingContext2D,
  toast: PickupToast,
  now: number,
  layout: HudLayout
): void {
  const elapsed = now - toast.startAt;
  const dur = toast.until - toast.startAt;
  if (elapsed >= dur) return;

  const t = elapsed / dur;
  const fadeIn = Math.min(1, elapsed / (layout.mobile ? 150 : 120));
  const fadeOut = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
  const alpha = fadeIn * fadeOut;
  const floatY = CANVAS_H * layout.toastYRatio - t * (layout.mobile ? 20 : 28);
  const scale = 1 + Math.sin(elapsed / 90) * 0.04;
  const padX = layout.mobile ? 28 : 18;
  const padY = layout.mobile ? 30 : 22;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(CANVAS_W / 2, floatY);
  ctx.scale(scale, scale);

  ctx.font = layout.toastFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(toast.text).width;
  ctx.fillStyle = layout.mobile ? "rgba(2, 6, 23, 0.78)" : "rgba(0,0,0,0.55)";
  ctx.fillRect(-tw / 2 - padX, -padY, tw + padX * 2, padY * 2);
  ctx.strokeStyle = toast.color;
  ctx.lineWidth = layout.mobile ? 3 : 2;
  ctx.strokeRect(-tw / 2 - padX, -padY, tw + padX * 2, padY * 2);

  if (layout.mobile) {
    drawOutlinedText(ctx, toast.text, 0, 0, toast.color, "rgba(0,0,0,0.6)", 4);
  } else {
    ctx.fillStyle = toast.color;
    ctx.fillText(toast.text, 0, 0);
  }

  ctx.restore();
}

function drawTouchGuide(ctx: CanvasRenderingContext2D, g: GameModel): void {
  const ts = g.touchSteer;
  if (!ts.active || g.phase !== "playing" || ts.source !== "seek") return;

  const p = g.player;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ts.fingerX, ts.fingerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ts.fingerX, ts.fingerY, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, TOUCH_DEAD_ZONE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  g: GameModel,
  ranking: number[] | null,
  now: number
): void {
  if (g.healPulse && now >= g.healPulse.until) {
    g.healPulse = null;
  }
  if (g.pickupToast && now >= g.pickupToast.until) {
    g.pickupToast = null;
  }

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
    drawItem(ctx, it, now);
  }

  for (const e of g.enemies) {
    ctx.fillStyle = "#c94c4c";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#ff8a8a";
    ctx.fillRect(e.x + 6, e.y + 6, e.w - 12, 8);
  }

  if (g.boss && g.boss.hp > 0) {
    const b = g.boss;
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#c4b5fd";
    ctx.fillRect(b.x + 20, b.y + 16, b.w - 40, 24);
  }

  if (g.laserVisual) {
    drawLaserBeam(ctx, g.laserVisual);
  }

  const { w: bulletW, h: bulletH } = visualSpreadBulletDimensions(p.weaponLevel);
  for (const m of g.missiles) {
    ctx.fillStyle = m.pierce ? "#e0f2fe" : "#93c5fd";
    const bx = m.x + m.w / 2 - bulletW / 2;
    const by = m.y + m.h / 2 - bulletH / 2;
    ctx.fillRect(bx, by, bulletW, bulletH);
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

  if (isActiveSkillLive(g, now)) {
    ctx.save();
    ctx.strokeStyle = p.planeType === "laser" ? "rgba(192, 132, 252, 0.55)" : "rgba(56, 189, 248, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTouchGuide(ctx, g);

  const layout = getHudLayout(g.hudMobile);
  drawHudBackdrop(ctx, g, layout);

  drawPlayerHpBar(ctx, p, g.healPulse, now, layout);

  if (layout.mobile) {
    drawMobileScoreBadge(ctx, g.score, layout);
  }

  const need = expToNextLevel(p.level);
  const expRatio = Math.min(1, p.exp / need);
  const expX = layout.marginX;
  const expY = layout.expY;
  const expRadius = layout.mobile ? layout.expBarH / 2 : 0;

  ctx.fillStyle = layout.mobile ? "rgba(15, 23, 42, 0.72)" : "#1f2937";
  if (layout.mobile) {
    fillRoundRect(ctx, expX, expY, layout.barW, layout.expBarH, expRadius);
  } else {
    ctx.fillRect(expX, expY, layout.barW, layout.expBarH);
  }

  ctx.fillStyle = layout.mobile ? "#818cf8" : "#6366f1";
  if (layout.mobile) {
    if (expRatio > 0) fillRoundRect(ctx, expX, expY, layout.barW * expRatio, layout.expBarH, expRadius);
  } else {
    ctx.fillRect(expX, expY, layout.barW * expRatio, layout.expBarH);
  }

  if (!layout.mobile) {
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.strokeRect(expX, expY, layout.barW, layout.expBarH);
  }

  const expText = `EXP ${Math.floor(p.exp)}/${need}`;
  ctx.font = layout.fontExp;
  if (layout.mobile) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    drawOutlinedText(ctx, expText, expX, expY - 3, "#a5b4fc", "rgba(0,0,0,0.45)", 2);
  } else {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(expText, 18, 41);
  }

  const planeLabel = p.planeType === "spread" ? "Spr" : "Lsr";
  const weaponStat =
    p.planeType === "spread"
      ? `탄 ${Math.floor(p.missileCount)}`
      : `ATK ${p.attack}`;

  if (layout.mobile) {
    ctx.font = layout.fontStat;
    const lifePart = g.extraLives > 0 ? ` · ♥${g.extraLives}` : "";
    const row1 = `St.${g.stage} · Lv.${p.level} · ${planeLabel} W${p.weaponLevel} · ${weaponStat}${lifePart}`;
    drawOutlinedText(ctx, row1, layout.marginX, layout.statY1, "#cbd5e1", "rgba(0,0,0,0.4)", 2);
  } else {
    ctx.fillStyle = "#f9fafb";
    ctx.font = layout.fontStat;
    ctx.fillText(`St ${g.stage}`, 12, layout.statY1);
    ctx.fillText(`Lv ${p.level}`, 56, layout.statY1);
    ctx.fillText(`${planeLabel} W${p.weaponLevel}`, 108, layout.statY1);
    ctx.fillText(`Score ${g.score}`, 220, layout.statY1);
    if (g.extraLives > 0) {
      ctx.fillStyle = "#f472b6";
      ctx.fillText(`Life ${g.extraLives}`, 320, layout.statY1);
    }
    if (p.planeType === "spread") {
      ctx.fillText(`Shots ${Math.floor(p.missileCount)}`, 360, layout.statY1);
    } else {
      ctx.fillText(`ATK ${p.attack}`, 360, layout.statY1);
    }
  }

  if (layout.showVersion) {
    ctx.fillStyle = "#64748b";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Sky Strike · v${GAME_VERSION}`, CANVAS_W / 2, CANVAS_H - 8);
    ctx.textAlign = "left";
  }

  drawItemLegend(ctx, p.planeType, layout);
  drawComboBadge(ctx, g, now, layout);
  drawStageObjectiveHud(ctx, g, layout);

  if (g.boss && g.boss.hp > 0) {
    drawBossHealthBar(ctx, g.boss, g.stage, layout);
  }

  if (g.pickupToast) {
    drawPickupToast(ctx, g.pickupToast, now, layout);
  }

  drawBombFlash(ctx, g, now);

  if (g.phase === "playing" && now < g.stageIntroUntil) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#a7f3d0";
    ctx.font = layout.mobile ? "bold 40px ui-sans-serif, system-ui" : "bold 28px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    if (layout.mobile) {
      drawOutlinedText(ctx, `STAGE ${g.stage}`, CANVAS_W / 2, CANVAS_H / 2 - 12, "#a7f3d0", "rgba(0,0,0,0.55)", 3);
    } else {
      ctx.fillText(`STAGE ${g.stage}`, CANVAS_W / 2, CANVAS_H / 2 - 8);
    }
    const objLine = g.stageObjective ? `보너스: ${g.stageObjective.label}` : "적이 더 강해졌습니다";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = layout.mobile ? "18px ui-sans-serif, system-ui" : "14px ui-monospace, monospace";
    if (layout.mobile) {
      drawOutlinedText(ctx, objLine, CANVAS_W / 2, CANVAS_H / 2 + 28, "#fde68a", "rgba(0,0,0,0.55)", 2);
      drawOutlinedText(ctx, "적이 더 강해졌습니다", CANVAS_W / 2, CANVAS_H / 2 + 58, "#cbd5e1", "rgba(0,0,0,0.55)", 2);
    } else {
      ctx.fillStyle = "#fde68a";
      ctx.fillText(objLine, CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "15px ui-monospace, monospace";
      ctx.fillText("적이 더 강해졌습니다", CANVAS_W / 2, CANVAS_H / 2 + 44);
    }
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

  updateStageBombDrops(g, now);
  updateStageLifeDrop(g, now);

  const p = g.player;
  const canTakeDamage = now >= g.playerInvulnerableUntil;

  const { mx, my } = readCombinedMovement(g.kbMove, g.padMove, g.touchSteer);

  p.x += mx * PLAYER_SPEED_PX * dt;
  p.y += my * PLAYER_SPEED_PX * dt;
  p.x = Math.max(0, Math.min(CANVAS_W - p.w, p.x));
  p.y = Math.max(0, Math.min(CANVAS_H - p.h, p.y));

  const bossActive = g.boss !== null && g.boss.hp > 0;

  if (!bossActive && now >= g.stageIntroUntil && now >= g.nextEnemySpawnAt) {
    const wave = waveSizeForLevel(p.level);
    for (let i = 0; i < wave; i++) {
      if (g.enemies.length >= MAX_ENEMIES) break;
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
      spawnSpreadBullets(g, p, now);
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
      if (!m.pierce) m.y = -9999;
      if (e.hp <= 0) {
        killEnemy(g, e, i, now);
      } else {
        playEnemyHitSound(now, false);
      }
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
      if (!m.pierce) m.y = -9999;
      if (b.hp <= 0) {
        defeatBoss(g, now);
        return;
      }
      playBossHitSound(now);
    }
    g.missiles = g.missiles.filter((m) => m.y > -500);
  }

  if (canTakeDamage) {
    for (const e of g.enemies) {
      if (!rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
      const dmg = e.damage * dt;
      if (dmg > 0) notePlayerDamage(g, dmg);
      p.hp -= dmg;
      playPlayerContactSound(now);
    }
  }

  for (const eb of g.enemyBullets) {
    if (now < eb.armedAfter) continue;
    if (!canTakeDamage) continue;
    if (!rectsOverlap(p.x, p.y, p.w, p.h, eb.x, eb.y, eb.w, eb.h)) continue;
    notePlayerDamage(g, eb.damage);
    p.hp -= eb.damage;
    playPlayerHitSound(now);
    eb.y = CANVAS_H + 999;
  }
  g.enemyBullets = g.enemyBullets.filter((eb) => eb.y < CANVAS_H + 100);

  for (let i = g.items.length - 1; i >= 0; i--) {
    const it = g.items[i];
    if (!rectsOverlap(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) continue;
    applyItemPickup(g, p, it.type, now);
    g.items.splice(i, 1);
  }

  if (canTakeDamage && g.boss && g.boss.hp > 0) {
    const b = g.boss;
    if (rectsOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
      const dmg = b.damage * BOSS_CONTACT_DPS_SCALE * dt;
      if (dmg > 0) notePlayerDamage(g, dmg);
      p.hp -= dmg;
      playPlayerContactSound(now);
    }
  }

  if (p.hp <= 0) {
    p.hp = 0;
    if (tryConsumeExtraLife(g, now)) return;
    if (g.phase === "playing") playGameOverSound();
    g.phase = "gameover";
    g.laserVisual = null;
  }

  trimEntityCounts(g);
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
  const mainRef = useRef<HTMLElement | null>(null);
  const gameRef = useRef<GameModel>(createGameModel());
  const rankingRef = useRef<number[] | null>(null);
  const endedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const tickRef = useRef<(ts: number) => void>(() => {});
  const [gameOver, setGameOver] = useState<{
    score: number;
    stage: number;
    plane: SharePlane;
    durationMs: number;
  } | null>(null);
  const [uiPhase, setUiPhase] = useState<GamePhase>("select");
  const [playingPlane, setPlayingPlane] = useState<SharePlane>("spread");
  const [bombCount, setBombCount] = useState(STARTING_BOMBS);
  const bombsRef = useRef(STARTING_BOMBS);
  const [skillReady, setSkillReady] = useState(true);
  const [skillActive, setSkillActive] = useState(false);
  const [skillCooldownSec, setSkillCooldownSec] = useState(0);
  const skillUiRef = useRef({ ready: true, active: false, cooldownSec: 0 });
  const touchSteerRef = useRef<{ active: boolean; pointerId: number | null }>({
    active: false,
    pointerId: null,
  });
  const uiPhaseRef = useRef<GamePhase>("select");
  const isMobileRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => {
      isMobileRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  tickRef.current = (ts: number) => {
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(tickRef.current);
        return;
      }

      const g = gameRef.current;
      g.hudMobile = isMobileRef.current;
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const rawDt = (ts - lastTsRef.current) / 1000;
      /** 탭 전환·절전 복귀 시 dt 폭주로 프레임 멈춤처럼 보이는 현상 완화 */
      const dt = rawDt > 0.2 ? 0.016 : Math.min(0.05, Math.max(0, rawDt));
      lastTsRef.current = ts;

      if (g.phase === "playing") {
        updateGame(g, dt, ts);
      }

      if (g.bombs !== bombsRef.current) {
        bombsRef.current = g.bombs;
        queueMicrotask(() => setBombCount(g.bombs));
      }

      const now = ts;
      const nextSkillReady = now >= g.activeSkillCooldownUntil;
      const nextSkillActive = isActiveSkillLive(g, now);
      const nextSkillCooldownSec = nextSkillReady
        ? 0
        : Math.max(1, Math.ceil((g.activeSkillCooldownUntil - now) / 1000));
      const skillUi = skillUiRef.current;
      if (
        nextSkillReady !== skillUi.ready ||
        nextSkillActive !== skillUi.active ||
        nextSkillCooldownSec !== skillUi.cooldownSec
      ) {
        skillUiRef.current = {
          ready: nextSkillReady,
          active: nextSkillActive,
          cooldownSec: nextSkillCooldownSec,
        };
        queueMicrotask(() => {
          setSkillReady(nextSkillReady);
          setSkillActive(nextSkillActive);
          setSkillCooldownSec(nextSkillCooldownSec);
        });
      }

      if (g.phase !== uiPhaseRef.current) {
        uiPhaseRef.current = g.phase;
        queueMicrotask(() => setUiPhase(g.phase));
      }

      if (g.phase === "gameover" && !endedRef.current) {
        endedRef.current = true;
        rankingRef.current = saveRankingScore(g.score);
        const durationMs =
          g.playStartedAt > 0 ? Math.max(0, Math.round(ts - g.playStartedAt)) : 0;
        const summary = {
          score: g.score,
          stage: g.stage,
          plane: g.player.planeType as SharePlane,
          durationMs,
        };
        queueMicrotask(() => setGameOver(summary));
      }

      drawGame(ctx, g, rankingRef.current, ts);
    } catch (err) {
      console.error("[Sky Strike] game loop error:", err);
    }

    rafRef.current = requestAnimationFrame(tickRef.current);
  };

  useEffect(() => {
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(tickRef.current);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const bindPadKey = useCallback((dir: keyof MovementInput) => {
    const setPad = (down: boolean) => {
      if (down) resumeGameAudio();
      gameRef.current.padMove[dir] = down;
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setPad(true);
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setPad(false);
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
        setPad(false);
      },
      onLostPointerCapture: () => {
        setPad(false);
      },
    };
  }, []);

  const updateSteerFromPointer = useCallback((clientX: number, clientY: number) => {
    const g = gameRef.current;
    if (g.phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pt = canvasPointFromEvent(canvas, clientX, clientY);
    const p = g.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const { mx, my } = computeTouchSteerVector(pt.x, pt.y, cx, cy);

    g.touchSteer.active = true;
    g.touchSteer.fingerX = pt.x;
    g.touchSteer.fingerY = pt.y;
    g.touchSteer.mx = mx;
    g.touchSteer.my = my;
    g.touchSteer.source = "seek";
  }, []);

  const focusGame = useCallback(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const applyActiveSkill = useCallback(() => {
    const g = gameRef.current;
    if (useActiveSkill(g, performance.now())) {
      resumeGameAudio();
    }
  }, []);

  const applyBomb = useCallback(() => {
    const g = gameRef.current;
    if (useBomb(g, performance.now())) {
      bombsRef.current = g.bombs;
      setBombCount(g.bombs);
      resumeGameAudio();
    }
  }, []);

  const applyJoystickMove = useCallback((mx: number, my: number) => {
    const g = gameRef.current;
    g.touchSteer.active = true;
    g.touchSteer.mx = mx;
    g.touchSteer.my = my;
    g.touchSteer.fingerX = 0;
    g.touchSteer.fingerY = 0;
    g.touchSteer.source = "joystick";
    resumeGameAudio();
  }, []);

  const applyJoystickEnd = useCallback(() => {
    clearTouchSteer(gameRef.current.touchSteer);
  }, []);

  const onCanvasPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const g = gameRef.current;

      if (g.phase === "select") return;

      if (g.phase === "playing") {
        if (isMobileRef.current) return;
        canvas.setPointerCapture(e.pointerId);
        touchSteerRef.current = { active: true, pointerId: e.pointerId };
        updateSteerFromPointer(e.clientX, e.clientY);
        resumeGameAudio();
      }
    },
    [updateSteerFromPointer]
  );

  const onCanvasPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (
        touchSteerRef.current.active &&
        touchSteerRef.current.pointerId === e.pointerId
      ) {
        updateSteerFromPointer(e.clientX, e.clientY);
      }
    },
    [updateSteerFromPointer]
  );

  const releaseTouchSteer = useCallback((pointerId: number) => {
    if (touchSteerRef.current.pointerId !== pointerId) return;
    touchSteerRef.current = { active: false, pointerId: null };
    clearTouchSteer(gameRef.current.touchSteer);
  }, []);

  const onCanvasPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      releaseTouchSteer(e.pointerId);
    },
    [releaseTouchSteer]
  );

  const onCanvasPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      releaseTouchSteer(e.pointerId);
    },
    [releaseTouchSteer]
  );

  const handleSelectPlane = useCallback(
    (plane: PlaneType) => {
      setPlayingPlane(plane);
      setBombCount(STARTING_BOMBS);
      bombsRef.current = STARTING_BOMBS;
      skillUiRef.current = { ready: true, active: false, cooldownSec: 0 };
      setSkillReady(true);
      setSkillActive(false);
      setSkillCooldownSec(0);
      beginPlaying(gameRef.current, plane, performance.now());
      uiPhaseRef.current = "playing";
      setUiPhase("playing");
      focusGame();
    },
    [focusGame]
  );

  useEffect(() => {
    const releasePad = () => {
      clearMovement(gameRef.current.padMove);
    };
    const releaseAll = () => {
      clearMovement(gameRef.current.kbMove);
      clearMovement(gameRef.current.padMove);
      clearTouchSteer(gameRef.current.touchSteer);
      touchSteerRef.current = { active: false, pointerId: null };
    };

    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (g.phase === "select") {
        if (e.key === "1" || e.code === "Digit1") {
          handleSelectPlane("spread");
          return;
        }
        if (e.key === "2" || e.code === "Digit2") {
          handleSelectPlane("laser");
          return;
        }
      }
      if (
        g.phase === "playing" &&
        (e.key === "b" || e.key === "B" || e.code === "KeyB")
      ) {
        if (useBomb(g, performance.now())) {
          bombsRef.current = g.bombs;
          setBombCount(g.bombs);
          resumeGameAudio();
        }
        e.preventDefault();
        return;
      }
      if (
        g.phase === "playing" &&
        (e.key === "q" || e.key === "Q" || e.code === "KeyQ")
      ) {
        if (useActiveSkill(g, performance.now())) {
          resumeGameAudio();
        }
        e.preventDefault();
        return;
      }
      if (applyKeyboardMove(e, true, g.kbMove)) {
        resumeGameAudio();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (applyKeyboardMove(e, false, gameRef.current.kbMove)) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mouseup", releasePad);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        lastTsRef.current = null;
        releaseAll();
      }
    });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mouseup", releasePad);
      window.removeEventListener("blur", releaseAll);
    };
  }, [focusGame, handleSelectPlane]);

  const handleGoHome = useCallback(() => {
    endedRef.current = false;
    rankingRef.current = loadRanking();
    gameRef.current = createGameModel();
    uiPhaseRef.current = "select";
    setUiPhase("select");
    setGameOver(null);
    touchSteerRef.current = { active: false, pointerId: null };
    clearTouchSteer(gameRef.current.touchSteer);
    focusGame();
  }, [focusGame]);

  const handleRestart = useCallback(() => {
    const plane = gameOver?.plane ?? gameRef.current.player.planeType;
    setPlayingPlane(plane);
    setBombCount(STARTING_BOMBS);
    bombsRef.current = STARTING_BOMBS;
    skillUiRef.current = { ready: true, active: false, cooldownSec: 0 };
    setSkillReady(true);
    setSkillActive(false);
    setSkillCooldownSec(0);
    endedRef.current = false;
    rankingRef.current = loadRanking();
    const g = createGameModel();
    gameRef.current = g;
    beginPlaying(g, plane, performance.now());
    uiPhaseRef.current = "playing";
    setUiPhase("playing");
    setGameOver(null);
    touchSteerRef.current = { active: false, pointerId: null };
    focusGame();
  }, [focusGame, gameOver?.plane]);

  const pageClassName =
    uiPhase === "playing"
      ? "game-page game-page--playing"
      : uiPhase === "select"
        ? "game-page game-page--lobby"
        : "game-page game-page--gameover";

  const inGame = uiPhase === "playing" || uiPhase === "gameover";

  const padBtn = (dir: keyof MovementInput, label: string, glyph: string) => (
    <button type="button" className="pad-btn" aria-label={label} {...bindPadKey(dir)}>
      {glyph}
    </button>
  );

  return (
    <main className={pageClassName} tabIndex={0} ref={mainRef}>
      {uiPhase === "select" && (
        <LobbyScreen version={GAME_VERSION} onSelectPlane={handleSelectPlane} />
      )}

      {inGame && (
        <>
          <div className="game-page__canvas-wrap">
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerCancel}
            />
            {gameOver && (
              <GameOverPanel
                score={gameOver.score}
                stage={gameOver.stage}
                plane={gameOver.plane}
                durationMs={gameOver.durationMs}
                onRestart={handleRestart}
                onGoHome={handleGoHome}
              />
            )}
          </div>

          {uiPhase === "playing" && (
            <div className="game-page__bottom game-page__bottom--joystick">
              <div className="game-page__bottom-dock">
                <ItemLegendDock plane={playingPlane} />
                <VirtualJoystick onMove={applyJoystickMove} onEnd={applyJoystickEnd} />
                <div className="game-page__right-dock">
                  <ActiveSkillButton
                    plane={playingPlane}
                    ready={skillReady}
                    active={skillActive}
                    cooldownSec={skillCooldownSec}
                    onActivate={applyActiveSkill}
                  />
                  <BombButton count={bombCount} onBomb={applyBomb} />
                </div>
              </div>
            </div>
          )}

          <div className="game-page__bottom game-page__bottom--keypad">
            <div className="mobile-pad" aria-label="이동 버튼">
              {padBtn("left", "왼쪽", "←")}
              {padBtn("up", "위", "↑")}
              {padBtn("down", "아래", "↓")}
              {padBtn("right", "오른쪽", "→")}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
