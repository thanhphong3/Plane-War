import { BossEntity, BossKind, BossPart, BulletEntity, HazardEntity, PowerupEntity } from '../types/game';
import { SoundType } from '../utils/audio';
import { SpeakerId } from './campaign';

// ---------------------------------------------------------------------------
// Boss behaviours. The engine owns entity lists and FX; each boss only talks
// to the world through BossApi, so new bosses never need engine changes.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

export interface BossPlayer {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  dashTimer: number;
  invulnTimer: number;
  bossContactCd: number;
}

export interface ShotOpts {
  r?: number;
  color?: string;
  ghost?: boolean;
  glitch?: boolean;
  ay?: number;
}

export interface BossApi {
  readonly W: number;
  readonly H: number;
  readonly hard: boolean;
  readonly fever: boolean;
  readonly alive: boolean;
  readonly player: BossPlayer;
  readonly hazards: HazardEntity[];
  readonly bullets: BulletEntity[];
  readonly powerups: PowerupEntity[];
  nextId(): number;
  shot(x: number, y: number, angle: number, speed: number, opts?: ShotOpts): void;
  orb(x: number, y: number, angle: number, speed: number): void;
  laser(pos: number, orient?: 'v' | 'h', warn?: number): void;
  drone(x: number, y: number, vx: number, vy: number): void;
  /** Drag the player (keeps touch-drag offsets consistent). */
  pullPlayer(dx: number, dy: number): void;
  particles(x: number, y: number, color: string, n?: number, speed?: number, streak?: boolean): void;
  shockwave(x: number, y: number, color: string, maxR: number, width?: number): void;
  text(x: number, y: number, text: string, color?: string, size?: number): void;
  flash(color: string, alpha: number): void;
  shake(amount: number): void;
  slowmo(factor: number, time: number): void;
  banner(text: string, colorClass?: string): void;
  comm(who: SpeakerId, text: string): void;
  sfx(name: SoundType, param?: number): void;
  /** Returns true if the hit destroyed the player. */
  hurtPlayer(): boolean;
  defeat(): void;
  clearShots(): void;
}

export type BulletResult = 'hit' | 'block' | null;

export interface BossBehavior {
  setup(b: BossEntity, api: BossApi): void;
  /** Called every frame. `ready` is false while the boss is still flying in. */
  update(b: BossEntity, api: BossApi, dt: number, ready: boolean): void;
  bullet(b: BossEntity, api: BossApi, bl: BulletEntity): BulletResult;
  contact(b: BossEntity, api: BossApi, dashing: boolean): void;
  emp(b: BossEntity, api: BossApi): void;
  /** A deflected plasma core reached the boss. */
  orbReturn?(b: BossEntity, api: BossApi, h: HazardEntity): void;
  /** The player grazed something (1 = bullet, 2+ = near-miss / laser). */
  graze?(b: BossEntity, api: BossApi, amount: number): void;
  /** The player picked up a Root Key. */
  key?(b: BossEntity, api: BossApi): void;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return dist(px, py, ax + dx * k, ay + dy * k);
}

function aimAt(api: BossApi, x: number, y: number): number {
  return Math.atan2(api.player.y - y, api.player.x - x);
}

function isDashing(api: BossApi): boolean {
  return api.player.dashTimer > 0 || api.fever;
}

/** Applies damage, respecting a per-phase HP floor (`v.floor`) and lock (`v.lock`). */
function damage(b: BossEntity, api: BossApi, amount: number) {
  if (b.hp <= 0 || b.v.lock) return;
  b.hp = Math.max(b.v.floor || 0, b.hp - amount);
  b.hitFlash = 0.06;
  if (b.hp <= 0) api.defeat();
}

function ring(api: BossApi, x: number, y: number, n: number, speed: number, offset = 0, opts?: ShotOpts, skip?: (a: number) => boolean) {
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * TAU;
    if (skip && skip(a)) continue;
    api.shot(x, y, a, speed, opts);
  }
}

function fan(api: BossApi, x: number, y: number, aim: number, n: number, spread: number, speed: number, opts?: ShotOpts) {
  for (let i = 0; i < n; i++) api.shot(x, y, aim + (i - (n - 1) / 2) * spread, speed, opts);
}

function strikeFx(api: BossApi, label: string, color = '#67e8f9') {
  const p = api.player;
  api.sfx('boom');
  api.shake(12);
  api.shockwave(p.x, p.y, '#22d3ee', 90, 4);
  api.particles(p.x, p.y, '#e879f9', 20, 260, true);
  api.text(p.x, p.y - 24, label, color, 16);
}

/** Dash into something solid that can't be hurt right now. */
function bounce(api: BossApi, fromX: number, fromY: number, label = 'CLANK!') {
  const p = api.player;
  if (p.bossContactCd > 0) return;
  p.bossContactCd = 0.35;
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  api.pullPlayer(Math.cos(a) * 80, Math.sin(a) * 80);
  api.sfx('block');
  api.shake(6);
  api.particles(p.x, p.y, '#e2e8f0', 12, 220, true);
  api.text(p.x, p.y - 24, label, '#cbd5e1', 14);
}

/** Generic body contact: dash strikes deal `dmg`, anything else hurts the player. */
function bodyContact(b: BossEntity, api: BossApi, dashing: boolean, x: number, y: number, r: number, dmg: number, label = 'CORE STRIKE!') {
  const p = api.player;
  if (dist(p.x, p.y, x, y) >= r * 0.8 + p.radius) return false;
  if (dashing) {
    if (p.bossContactCd <= 0) {
      p.bossContactCd = 0.35;
      strikeFx(api, label);
      damage(b, api, dmg);
      api.pullPlayer(0, 70);
    }
  } else {
    api.hurtPlayer();
  }
  return true;
}

/** Shield ring with a rotating gap. Returns true if the bullet is blocked. */
function gateBlocks(bl: BulletEntity, cx: number, cy: number, R: number, gapAngle: number, gapWidth: number): boolean {
  if (bl.passed) return false;
  if (dist(bl.x, bl.y, cx, cy) > R + 5) return false;
  const a = Math.atan2(bl.y - cy, bl.x - cx);
  if (Math.abs(angDiff(a, gapAngle)) < gapWidth / 2) {
    bl.passed = true;
    return false;
  }
  return true;
}

/** Pulls (sign 1) or pushes (sign -1) the player, bullets and enemy shots. */
function applyGravity(api: BossApi, cx: number, cy: number, dt: number, playerPull: number, sign: number, absorbR: number) {
  const p = api.player;
  if (api.alive && playerPull !== 0) {
    const d = Math.max(1, dist(p.x, p.y, cx, cy));
    api.pullPlayer(((cx - p.x) / d) * playerPull * dt, ((cy - p.y) / d) * playerPull * dt);
  }
  for (const bl of api.bullets) {
    const d = Math.max(60, dist(bl.x, bl.y, cx, cy));
    const acc = (sign * 52000) / d;
    bl.vx += ((cx - bl.x) / d) * acc * dt;
    bl.vy += ((cy - bl.y) / d) * acc * dt;
  }
  for (let i = api.hazards.length - 1; i >= 0; i--) {
    const h = api.hazards[i];
    if (h.type === 'turret') continue;
    const d = Math.max(1, dist(h.x, h.y, cx, cy));
    if (sign > 0 && d < absorbR && (h.type === 'shot' || h.type === 'drone')) {
      api.particles(h.x, h.y, '#818cf8', 3, 80);
      api.hazards.splice(i, 1);
      continue;
    }
    const acc = (sign * 30000) / Math.max(70, d);
    h.vx += ((cx - h.x) / d) * acc * dt;
    h.vy += ((cy - h.y) / d) * acc * dt;
    if (h.type === 'shot') h.angle = Math.atan2(h.vy, h.vx);
  }
}

/** Lethal energy tether between two points. Dashing through it snaps it. */
function tetherTouch(api: BossApi, ax: number, ay: number, bx: number, by: number): 'snap' | 'hit' | null {
  if (!api.alive) return null;
  const p = api.player;
  if (segDist(p.x, p.y, ax, ay, bx, by) > 7 + p.radius * 0.55) return null;
  return isDashing(api) ? 'snap' : 'hit';
}

function makePart(x: number, y: number, r: number, hp: number): BossPart {
  return { x, y, tx: x, ty: y, r, hp, maxHp: hp, alive: true, timer: 0, hitFlash: 0 };
}

/** The engine fades the main body's hit flash; parts fade here. */
function decayFlashes(b: BossEntity, dt: number) {
  for (const pt of b.parts) pt.hitFlash = Math.max(0, pt.hitFlash - dt);
}

// ---------------------------------------------------------------------------
// SENTINEL — the endless-mode boss
// ---------------------------------------------------------------------------
const sentinel: BossBehavior = {
  setup() {},
  update(b, api, dt, ready) {
    const rage = b.hp / b.maxHp < 0.4;
    b.angle += dt * (rage ? 1.5 : 0.8);
    b.status = b.timeLeft < 99 ? `Escapes in ${Math.ceil(Math.max(0, b.timeLeft))}s` : '';
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.55) * api.W * 0.3;
    b.y = b.targetY + Math.sin(b.t * 1.3) * 14;
    if (!api.alive) return;

    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = Math.max(0.9, 1.9 - b.level * 0.15) * (rage ? 0.7 : 1);

    const p = api.player;
    const aim = aimAt(api, b.x, b.y);
    const pattern = b.attackIndex++ % 4;
    api.sfx('enemy_shot');
    if (pattern === 0) {
      ring(api, b.x, b.y, 12 + b.level * 2 + (rage ? 4 : 0), 140 + b.level * 10, b.t);
    } else if (pattern === 1) {
      fan(api, b.x, b.y, aim, rage ? 7 : 5, 0.17, 220 + b.level * 12);
    } else if (pattern === 2) {
      api.laser(p.x);
      if (rage) {
        api.laser(p.x - 150);
        api.laser(p.x + 150);
      }
    } else {
      fan(api, b.x, b.y, Math.PI / 2, 9 + (rage ? 4 : 0), 0.16, 170 + b.level * 10);
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    damage(b, api, 1);
    return 'hit';
  },
  contact(b, api, dashing) {
    bodyContact(b, api, dashing, b.x, b.y, b.r, 8);
  },
  emp(b, api) {
    damage(b, api, b.maxHp * 0.12);
  },
};

// ---------------------------------------------------------------------------
// GATEKEEPER — shots only get through the gap in its spinning shield
// ---------------------------------------------------------------------------
const gatekeeper: BossBehavior = {
  setup(b) {
    b.v.R = b.r * 1.35;
    b.v.shield = -Math.PI / 2;
    b.v.gap = 1.35;
    b.v.dir = 1;
    b.v.flip = 6;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.4;
    b.v.gap = rage ? 1.1 : 1.35;
    b.angle += dt * 0.6;
    b.v.shield = (b.v.shield + (rage ? 1.25 : 0.85) * b.v.dir * dt) % TAU;
    if (rage) {
      b.v.flip -= dt;
      if (b.v.flip <= 0) {
        b.v.dir *= -1;
        b.v.flip = 3.5 + Math.random() * 3;
      }
    }
    const facing = Math.abs(angDiff(b.v.shield, Math.PI / 2)) < 1.05;
    b.status = facing ? 'GAP OPEN ▼ FIRE NOW!' : 'Shield sealed — wait for the gap';
    if (!ready) return;

    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.4) * api.W * 0.22;
    b.y = b.targetY + Math.sin(b.t * 1.1) * 10;
    if (!api.alive) return;

    // Turnstile burst in progress
    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.11;
        b.v.burst--;
        for (let k = 0; k < 4; k++) {
          const a = b.v.shield + k * (Math.PI / 2) + Math.PI / 4;
          api.shot(b.x + Math.cos(a) * b.v.R, b.y + Math.sin(a) * b.v.R, a, 200, { color: '#7dd3fc' });
        }
      }
    }

    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.35 : 1.8;
    const pattern = [0, 1, 0, 2][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    if (pattern === 0) {
      // Gate Pulse: a full ring with a hole exactly where the shield gap is
      const gapW = b.v.gap * 1.05;
      ring(api, b.x, b.y, rage ? 32 : 26, rage ? 170 : 150, 0, { color: '#7dd3fc' }, (a) => Math.abs(angDiff(a, b.v.shield)) < gapW / 2);
    } else if (pattern === 1) {
      b.v.burst = rage ? 16 : 12;
      b.v.burstT = 0;
    } else {
      // Lockdown: two pillars box the pilot in, then an aimed spread
      const p = api.player;
      api.laser(p.x - 130);
      api.laser(p.x + 130);
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 210, { color: '#7dd3fc' });
    }
  },
  bullet(b, api, bl) {
    if (gateBlocks(bl, b.x, b.y, b.v.R, b.v.shield, b.v.gap)) return 'block';
    if (!bl.passed || dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.75) return null;
    damage(b, api, 1);
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) > b.v.R + p.radius * 0.7) return;
    if (!dashing) {
      api.hurtPlayer();
      return;
    }
    if (p.bossContactCd > 0) return;
    const a = Math.atan2(p.y - b.y, p.x - b.x);
    if (Math.abs(angDiff(a, b.v.shield)) < b.v.gap / 2 + 0.15) {
      p.bossContactCd = 0.35;
      strikeFx(api, 'GATE BREACH!');
      damage(b, api, 10);
      api.pullPlayer(0, 80);
    } else {
      bounce(api, b.x, b.y);
    }
  },
  emp(b, api) {
    damage(b, api, b.maxHp * 0.08);
    b.v.dir *= -1;
  },
};

// ---------------------------------------------------------------------------
// CASTOR & POLLUX — linked twins. Snap the tether, kill both together.
// ---------------------------------------------------------------------------
const TWIN_NAMES = ['CASTOR', 'POLLUX'];
const TWIN_MODES = ['orbit', 'cross', 'orbit', 'scissor'] as const;
const TWIN_MODE_TIME = [7, 6.5, 6, 5.5];

function twinDamage(b: BossEntity, api: BossApi, i: number, amount: number) {
  const part = b.parts[i];
  if (!part.alive) return;
  part.hp -= amount * (b.v.stun > 0 ? 2 : 1);
  part.hitFlash = 0.06;
  if (part.hp <= 0) {
    part.hp = 0;
    part.alive = false;
    part.timer = api.hard ? 4 : 5;
    api.sfx('boom');
    api.shake(14);
    api.shockwave(part.x, part.y, i ? '#f472b6' : '#22d3ee', 160, 4);
    api.particles(part.x, part.y, i ? '#f472b6' : '#22d3ee', 40, 320, true);
    const other = b.parts[1 - i];
    if (!other.alive) {
      b.hp = 0;
      api.defeat();
      return;
    }
    api.banner(`${TWIN_NAMES[i]} DOWN — FINISH ${TWIN_NAMES[1 - i]}!`, 'neon-glow-amber');
    api.comm(i ? 'castor' : 'pollux', i ? 'Pollux! Hold on, I’m rebuilding you!' : 'Castor! I’ll bring you back!');
  }
  b.hp = b.parts.reduce((s, pt) => s + (pt.alive ? pt.hp : 0), 0);
}

const twins: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(40, api.W * 0.09);
    const hp = b.maxHp / 2;
    b.parts = [makePart(b.x - 90, b.y, b.r, hp), makePart(b.x + 90, b.y, b.r, hp)];
    b.v.mode = 0;
    b.v.modeT = 0;
    b.v.rot = 0;
    b.v.stun = 0;
    b.v.tetherOff = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const [A, B] = b.parts;
    const rage = b.hp / b.maxHp < 0.45;
    b.angle += dt;
    if (b.v.stun > 0) b.v.stun -= dt;
    if (b.v.tetherOff > 0) b.v.tetherOff -= dt;

    // Revive countdown
    b.parts.forEach((pt, i) => {
      if (pt.alive) return;
      pt.timer -= dt;
      if (pt.timer <= 0 && b.parts[1 - i].alive) {
        pt.alive = true;
        pt.hp = pt.maxHp * 0.5;
        api.sfx('powerup');
        api.shockwave(pt.x, pt.y, '#ffffff', 140, 3);
        api.banner(`${TWIN_NAMES[i]} REVIVED!`, 'neon-glow-pink');
      }
    });
    b.hp = b.parts.reduce((s, pt) => s + (pt.alive ? pt.hp : 0), 0);

    if (!ready) {
      A.x = b.x - 90;
      B.x = b.x + 90;
      A.y = B.y = b.y;
      return;
    }

    b.t += dt;
    b.v.modeT += dt;
    const modeIdx = b.v.mode % TWIN_MODES.length;
    if (b.v.modeT > TWIN_MODE_TIME[modeIdx]) {
      b.v.mode++;
      b.v.modeT = 0;
      const next = TWIN_MODES[b.v.mode % TWIN_MODES.length];
      if (next === 'cross') api.banner('TETHER DESCENDING!', 'neon-glow-pink');
      if (next === 'scissor') api.banner('TETHER SWEEP!', 'neon-glow-pink');
    }
    const mode = TWIN_MODES[b.v.mode % TWIN_MODES.length];
    const { W, H } = api;

    if (mode === 'orbit') {
      b.v.rot += dt * (rage ? 0.9 : 0.6);
      const cx = W / 2 + Math.sin(b.t * 0.35) * W * 0.12;
      const rad = Math.min(W * 0.3, 170);
      A.tx = cx + Math.cos(b.v.rot) * rad;
      A.ty = b.targetY + Math.sin(b.v.rot) * rad * 0.45;
      B.tx = cx - Math.cos(b.v.rot) * rad;
      B.ty = b.targetY - Math.sin(b.v.rot) * rad * 0.45;
    } else if (mode === 'cross') {
      const k = Math.min(1, b.v.modeT / TWIN_MODE_TIME[modeIdx]);
      const ly = H * 0.14 + H * 0.68 * Math.sin(Math.PI * k);
      A.tx = 34;
      B.tx = W - 34;
      A.ty = B.ty = ly;
    } else {
      b.v.rot += dt * (rage ? 1.5 : 1.15);
      const rad = Math.min(W * 0.46, 300);
      const cy = H * 0.48;
      A.tx = W / 2 + Math.cos(b.v.rot) * rad;
      A.ty = cy + Math.sin(b.v.rot) * rad;
      B.tx = W / 2 - Math.cos(b.v.rot) * rad;
      B.ty = cy - Math.sin(b.v.rot) * rad;
    }
    const lerp = Math.min(1, (b.v.stun > 0 ? 0.8 : 5) * dt);
    for (const pt of b.parts) {
      pt.x += (pt.tx - pt.x) * lerp;
      pt.y += (pt.ty - pt.y) * lerp;
    }
    b.x = (A.x + B.x) / 2;
    b.y = (A.y + B.y) / 2;

    // Tether
    b.v.tether = A.alive && B.alive && b.v.stun <= 0 && b.v.tetherOff <= 0 ? 1 : 0;
    if (b.v.tether) {
      const touch = tetherTouch(api, A.x, A.y, B.x, B.y);
      if (touch === 'snap') {
        b.v.stun = api.hard ? 2.6 : 3.4;
        b.v.tetherOff = b.v.stun + 1.5;
        const p = api.player;
        api.sfx('parry');
        api.slowmo(0.4, 0.35);
        api.flash('#ffffff', 0.3);
        api.shockwave(p.x, p.y, '#ffffff', 200, 5);
        api.particles(p.x, p.y, '#22d3ee', 20, 300, true);
        api.particles(p.x, p.y, '#f472b6', 20, 300, true);
        api.text(p.x, p.y - 26, 'TETHER SNAPPED!', '#fde047', 18);
        api.banner('TWINS STUNNED — x2 DAMAGE!', 'neon-glow-amber');
      } else if (touch === 'hit') {
        api.hurtPlayer();
      }
    }

    const dead = b.parts.findIndex((pt) => !pt.alive);
    if (dead >= 0) b.status = `${TWIN_NAMES[dead]} DOWN — kill ${TWIN_NAMES[1 - dead]} in ${Math.max(0, b.parts[dead].timer).toFixed(1)}s!`;
    else if (b.v.stun > 0) b.status = `STUNNED ${b.v.stun.toFixed(1)}s — x2 DAMAGE!`;
    else if (mode === 'cross') b.status = 'Tether descending — dash through or stay low!';
    else if (mode === 'scissor') b.status = 'Tether sweep — dash through to snap it!';
    else b.status = 'Dash through the tether to stun both';

    if (!api.alive || b.v.stun > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    const shooter = b.parts[b.attackIndex % 2].alive ? b.parts[b.attackIndex % 2] : b.parts[1 - (b.attackIndex % 2)];
    const col = shooter === A ? '#67e8f9' : '#f9a8d4';
    b.attackIndex++;
    if (mode === 'orbit') {
      b.attackTimer = rage ? 0.75 : 1.0;
      api.sfx('enemy_shot');
      fan(api, shooter.x, shooter.y, aimAt(api, shooter.x, shooter.y), rage ? 5 : 3, 0.2, 210, { color: col });
      if (b.attackIndex % 3 === 0) {
        for (const pt of b.parts) if (pt.alive) ring(api, pt.x, pt.y, 12, 130, b.t, { color: pt === A ? '#67e8f9' : '#f9a8d4' });
      }
    } else if (mode === 'cross') {
      b.attackTimer = rage ? 0.4 : 0.55;
      api.sfx('enemy_shot');
      fan(api, shooter.x, shooter.y, aimAt(api, shooter.x, shooter.y), 2, 0.12, 260, { color: col });
    } else {
      b.attackTimer = 1.6;
      if (rage) ring(api, W / 2, H * 0.48, 10, 120, b.t, { color: '#e879f9' });
    }
  },
  bullet(b, api, bl) {
    for (let i = 0; i < 2; i++) {
      const pt = b.parts[i];
      if (pt.alive && dist(bl.x, bl.y, pt.x, pt.y) < pt.r * 0.95) {
        twinDamage(b, api, i, 1);
        return 'hit';
      }
    }
    return null;
  },
  contact(b, api, dashing) {
    const p = api.player;
    b.parts.forEach((pt, i) => {
      if (!pt.alive || dist(p.x, p.y, pt.x, pt.y) >= pt.r * 0.8 + p.radius) return;
      if (!dashing) {
        api.hurtPlayer();
      } else if (p.bossContactCd <= 0) {
        p.bossContactCd = 0.35;
        strikeFx(api, `${TWIN_NAMES[i]} STRIKE!`);
        twinDamage(b, api, i, 8);
        api.pullPlayer(0, 70);
      }
    });
  },
  emp(b, api) {
    b.parts.forEach((pt, i) => pt.alive && twinDamage(b, api, i, pt.maxHp * 0.1));
    b.v.stun = Math.max(b.v.stun, 1.5);
  },
};

// ---------------------------------------------------------------------------
// FURNACE — armored; parry its plasma cores back to open the vents
// ---------------------------------------------------------------------------
function furnaceAttack(b: BossEntity, api: BossApi, rage: boolean) {
  const p = api.player;
  const pattern = ['orb', 'wall', 'orb', 'embers'][b.attackIndex++ % 4];
  if (pattern === 'orb') {
    const n = rage ? 2 : 1;
    const aim = aimAt(api, b.x, b.y);
    for (let k = 0; k < n; k++) api.orb(b.x, b.y + b.r * 0.5, aim + (k - (n - 1) / 2) * 0.55, 125);
    api.sfx('laser_warn');
  } else if (pattern === 'wall') {
    const { H } = api;
    const y1 = Math.max(H * 0.42, Math.min(H * 0.9, p.y + (Math.random() - 0.5) * 120));
    api.laser(y1, 'h', 1.3);
    if (rage) {
      const y2 = y1 > H * 0.65 ? y1 - 170 : y1 + 170;
      api.laser(y2, 'h', 1.6);
    }
  } else {
    const n = rage ? 18 : 12;
    api.sfx('enemy_shot');
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.85 + (i / (n - 1)) * Math.PI * 0.7;
      api.shot(b.x, b.y, a, 230 + Math.random() * 100, { color: '#fdba74', r: 5, ay: 240 });
    }
  }
}

const furnace: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(66, api.W * 0.15);
    b.v.vent = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.4;
    b.angle += dt * 0.5;
    if (b.v.vent > 0) {
      b.v.vent -= dt;
      if (b.v.vent <= 0) {
        api.sfx('block');
        api.text(b.x, b.y + b.r + 10, 'VENTS SEALED', '#fdba74', 14);
      }
    }
    b.status = b.v.vent > 0 ? `VENTS OPEN ${b.v.vent.toFixed(1)}s — FIRE AT THE CORE!` : 'Armored — dash INTO a Plasma Core to deflect it';
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.3) * api.W * 0.2;
    b.y = b.targetY + Math.sin(b.t * 0.9) * 8;
    if (!api.alive) return;
    b.attackTimer -= dt * (b.v.vent > 0 ? 0.6 : 1);
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.7 : 2.2;
    furnaceAttack(b, api, rage);
  },
  bullet(b, api, bl) {
    const d = dist(bl.x, bl.y, b.x, b.y);
    if (d >= b.r * 0.95) return null;
    if (b.v.vent > 0 && d < b.r * 0.75) {
      damage(b, api, 1.4);
      return 'hit';
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.85 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.vent > 0) bodyContact(b, api, true, b.x, b.y, b.r, 14, 'MELTDOWN STRIKE!');
    else bounce(api, b.x, b.y);
  },
  emp(b, api) {
    if (b.v.vent > 0) damage(b, api, b.maxHp * 0.06);
    else {
      b.v.vent = 2.5;
      api.text(b.x, b.y + b.r + 12, 'EMP SHORTED THE ARMOR!', '#fde047', 15);
    }
  },
  orbReturn(b, api) {
    b.v.vent = Math.min(7, b.v.vent + 5.5);
    damage(b, api, 6);
    api.sfx('boom');
    api.shake(16);
    api.flash('#fb923c', 0.35);
    api.slowmo(0.45, 0.3);
    api.shockwave(b.x, b.y, '#fb923c', 220, 6);
    api.particles(b.x, b.y, '#fdba74', 40, 340, true);
    api.banner('VENTS OPEN — FIRE AT THE CORE!', 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// WRAITH — one real body among decoys
// ---------------------------------------------------------------------------
function wraithLayout(b: BossEntity, api: BossApi) {
  const rage = b.hp / b.maxHp < 0.45;
  const n = rage ? 4 : 3;
  const realIdx = Math.floor(Math.random() * n);
  const cx = b.x;
  const cy = b.y;
  b.parts = [];
  for (let i = 0; i < n; i++) {
    const pt = makePart(cx, cy, b.r, 1);
    pt.tx = (api.W * (i + 1)) / (n + 1);
    pt.ty = b.targetY + (i % 2 ? 46 : -6);
    pt.real = i === realIdx;
    b.parts.push(pt);
  }
}

function wraithShuffle(b: BossEntity, api: BossApi) {
  b.v.shuffle = 0.9;
  b.v.shuffleT = 0;
  b.v.lunge = 0;
  for (const pt of b.parts) {
    pt.tx = api.W / 2;
    pt.ty = b.targetY;
  }
  api.sfx('glitch');
}

function wraithPop(b: BossEntity, api: BossApi, pt: BossPart, burst: boolean) {
  pt.alive = false;
  api.sfx('glitch');
  api.particles(pt.x, pt.y, '#c4b5fd', 24, 260, true);
  api.shockwave(pt.x, pt.y, '#a78bfa', 90, 3);
  api.text(pt.x, pt.y - 20, burst ? 'DECOY!' : 'DECOY POPPED', '#ddd6fe', 15);
  if (burst) ring(api, pt.x, pt.y, 12, 140, Math.random(), { color: '#c4b5fd', ghost: true });
}

const wraith: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(44, api.W * 0.1);
    b.v.scan = 0;
    b.v.reveal = 0;
    b.v.shuffle = 0;
    b.v.shuffleT = 0;
    b.v.chunk = 0;
    b.v.lunge = 0;
    wraithLayout(b, api);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.45;
    b.angle += dt;
    if (b.v.reveal > 0) b.v.reveal -= dt;

    if (!ready) {
      b.parts.forEach((pt, i) => {
        pt.x = b.x + (i - (b.parts.length - 1) / 2) * 30;
        pt.y = b.y;
      });
      b.status = '';
      return;
    }
    b.t += dt;

    // Shuffle: merge into one blur, then split with a new real body
    if (b.v.shuffle > 0) {
      const before = b.v.shuffle;
      b.v.shuffle -= dt;
      if (before > 0.45 && b.v.shuffle <= 0.45) {
        const keepX = api.W / 2;
        b.x = keepX;
        b.y = b.targetY;
        wraithLayout(b, api);
      }
    } else {
      b.v.shuffleT += dt;
      if (b.v.shuffleT > 13 && b.v.lunge === 0) wraithShuffle(b, api);
    }

    const real = b.parts.find((pt) => pt.real) || b.parts[0];
    b.parts.forEach((pt, i) => {
      if (pt === real && b.v.lunge > 0) return;
      const bobX = b.v.shuffle > 0 ? 0 : Math.sin(b.t * 0.8 + i * 2.1) * 26;
      const bobY = b.v.shuffle > 0 ? 0 : Math.sin(b.t * 1.4 + i) * 12;
      const k = Math.min(1, 4 * dt);
      pt.x += (pt.tx + bobX - pt.x) * k;
      pt.y += (pt.ty + bobY - pt.y) * k;
    });

    // Lunge: only the real Wraith hunts you
    if (b.v.lunge === 1) {
      b.v.lungeT -= dt;
      if (b.v.lungeT <= 0) {
        b.v.lunge = 2;
        api.sfx('dash');
      }
    } else if (b.v.lunge === 2) {
      const a = Math.atan2(b.v.ly - real.y, b.v.lx - real.x);
      real.x += Math.cos(a) * 820 * dt;
      real.y += Math.sin(a) * 820 * dt;
      if (dist(real.x, real.y, b.v.lx, b.v.ly) < 20) {
        b.v.lunge = 3;
        api.shockwave(real.x, real.y, '#a78bfa', 120, 3);
        ring(api, real.x, real.y, 8, 120, b.t, { color: '#c4b5fd', ghost: true });
      }
    } else if (b.v.lunge === 3) {
      const a = Math.atan2(real.ty - real.y, real.tx - real.x);
      real.x += Math.cos(a) * 520 * dt;
      real.y += Math.sin(a) * 520 * dt;
      if (dist(real.x, real.y, real.tx, real.ty) < 16) b.v.lunge = 0;
    }
    b.x = real.x;
    b.y = real.y;

    b.status =
      b.v.reveal > 0
        ? `TRUE SIGNAL LOCKED ${b.v.reveal.toFixed(1)}s`
        : `SCAN ${Math.floor(b.v.scan)}% — graze shots to reveal the real one`;

    if (!api.alive || b.v.shuffle > 0 || b.v.lunge > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.5 : 1.9;
    const pattern = ['volley', 'wail', 'volley', 'lunge'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    const ghost = { color: '#c4b5fd', ghost: true };
    if (pattern === 'volley') {
      for (const pt of b.parts) if (pt.alive) fan(api, pt.x, pt.y, aimAt(api, pt.x, pt.y), rage ? 5 : 3, 0.22, 190, ghost);
    } else if (pattern === 'wail') {
      for (const pt of b.parts) if (pt.alive) ring(api, pt.x, pt.y, 9, 120, b.t, ghost);
    } else {
      b.v.lunge = 1;
      b.v.lungeT = 0.8;
      b.v.lx = api.player.x;
      b.v.ly = api.player.y;
      api.sfx('glitch');
    }
  },
  bullet(b, api, bl) {
    if (b.v.shuffle > 0) return null;
    for (const pt of b.parts) {
      if (!pt.alive || dist(bl.x, bl.y, pt.x, pt.y) >= pt.r * 0.9) continue;
      if (!pt.real) {
        wraithPop(b, api, pt, true);
        return 'block';
      }
      pt.hitFlash = 0.06;
      damage(b, api, b.v.reveal > 0 ? 1.5 : 1);
      b.v.chunk += 1;
      if (b.v.chunk >= b.maxHp * 0.18 && b.hp > 0) {
        b.v.chunk = 0;
        api.text(pt.x, pt.y - 30, 'IT SHIFTS!', '#c4b5fd', 16);
        wraithShuffle(b, api);
      }
      return 'hit';
    }
    return null;
  },
  contact(b, api, dashing) {
    if (b.v.shuffle > 0) return;
    const p = api.player;
    for (const pt of b.parts) {
      if (!pt.alive || dist(p.x, p.y, pt.x, pt.y) >= pt.r * 0.8 + p.radius) continue;
      if (!dashing) {
        api.hurtPlayer();
      } else if (!pt.real) {
        wraithPop(b, api, pt, false);
      } else if (p.bossContactCd <= 0) {
        p.bossContactCd = 0.35;
        strikeFx(api, 'SOUL STRIKE!');
        damage(b, api, 10);
        b.v.reveal = Math.max(b.v.reveal, 2);
        api.pullPlayer(0, 70);
      }
    }
  },
  emp(b, api) {
    b.v.reveal = 6;
    damage(b, api, b.maxHp * 0.06);
  },
  graze(b, api, amount) {
    if (b.v.reveal > 0) return;
    b.v.scan = Math.min(100, b.v.scan + amount * 7);
    if (b.v.scan >= 100) {
      b.v.scan = 0;
      b.v.reveal = 6;
      api.sfx('powerup');
      api.banner('TRUE SIGNAL LOCKED!', 'neon-glow-amber');
      api.comm('iris', 'Got it! The marked one is real. Hit it!');
    }
  },
};

// ---------------------------------------------------------------------------
// SINGULARITY — gravity well guarded by orbiting stabilizers
// ---------------------------------------------------------------------------
function singularityNodes(b: BossEntity) {
  const hp = 12 + (b.v.rebuilds || 0) * 4;
  b.parts = [0, 1, 2, 3].map(() => makePart(b.x, b.y, 15, hp));
}

function singularityNodeDown(b: BossEntity, api: BossApi, pt: BossPart) {
  pt.alive = false;
  api.sfx('boom');
  api.shake(8);
  api.shockwave(pt.x, pt.y, '#a5b4fc', 90, 3);
  api.particles(pt.x, pt.y, '#a5b4fc', 22, 260, true);
  const left = b.parts.filter((n) => n.alive).length;
  api.text(pt.x, pt.y - 20, left ? `STABILIZER DOWN ${4 - left}/4` : 'ALL STABILIZERS DOWN!', '#c7d2fe', 15);
  if (left === 0) {
    b.v.collapse = api.hard ? 6 : 7;
    b.v.surge = 0;
    b.v.surgeWarn = 0;
    b.v.burst = 0;
    api.sfx('fever');
    api.flash('#818cf8', 0.45);
    api.slowmo(0.4, 0.4);
    api.shockwave(b.x, b.y, '#ffffff', 300, 6);
    api.banner('COLLAPSE — CORE EXPOSED!', 'neon-glow-amber');
  }
}

const singularity: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(50, api.W * 0.11);
    b.targetY = Math.max(190, api.H * 0.3);
    b.v.R = b.r * 2.5;
    b.v.orbit = 0;
    b.v.collapse = 0;
    b.v.surge = 0;
    b.v.surgeWarn = 0;
    b.v.rebuilds = 0;
    singularityNodes(b);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.45;
    const collapsed = b.v.collapse > 0;
    b.angle += dt * (collapsed ? -3 : 1.4);
    b.v.orbit += dt * (rage ? 1.0 : 0.75);
    b.parts.forEach((pt, i) => {
      const a = b.v.orbit + (i * Math.PI) / 2;
      pt.x = b.x + Math.cos(a) * b.v.R;
      pt.y = b.y + Math.sin(a) * b.v.R * 0.8;
    });

    const alive = b.parts.filter((n) => n.alive).length;
    b.status = collapsed
      ? `COLLAPSE ${b.v.collapse.toFixed(1)}s — CORE EXPOSED, FIRE!`
      : b.v.surgeWarn > 0 || b.v.surge > 0
      ? 'GRAVITY SURGE — fight the pull!'
      : `Stabilizers ${alive}/4 — shoot them (your shots bend!)`;
    if (!ready) return;

    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.22) * api.W * 0.14;
    b.y = b.targetY + Math.sin(b.t * 0.7) * 12;

    if (collapsed) {
      b.v.collapse -= dt;
      if (b.v.collapse <= 0) {
        b.v.rebuilds++;
        singularityNodes(b);
        api.sfx('boss_alarm');
        api.banner('STABILIZERS REBUILT', 'neon-glow-pink');
      }
    }
    if (b.v.surgeWarn > 0) {
      b.v.surgeWarn -= dt;
      if (b.v.surgeWarn <= 0) b.v.surge = 2.4;
    }
    if (b.v.surge > 0) b.v.surge -= dt;

    const pull = collapsed ? -140 : b.v.surge > 0 ? 330 : 95;
    applyGravity(api, b.x, b.y, dt, pull, collapsed ? -0.5 : 1, b.r * 0.9);

    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.1;
        b.v.burst--;
        b.v.burstA += 0.32;
        for (let k = 0; k < 3; k++) {
          const a = b.v.burstA + (k * TAU) / 3;
          api.shot(b.x + Math.cos(a) * (b.r + 10), b.y + Math.sin(a) * (b.r + 10), a + 0.5, 190, { color: '#a5b4fc' });
        }
      }
    }

    if (!api.alive || collapsed) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.7 : 2.2;
    const pattern = ['spiral', 'jets', 'spiral', 'surge'][b.attackIndex++ % 4];
    if (pattern === 'spiral') {
      b.v.burst = rage ? 16 : 12;
      b.v.burstT = 0;
      b.v.burstA = b.t;
    } else if (pattern === 'jets') {
      api.laser(b.x, 'v', 1.1);
      api.sfx('enemy_shot');
      for (const n of b.parts) if (n.alive) api.shot(n.x, n.y, aimAt(api, n.x, n.y), 200, { color: '#a5b4fc' });
    } else {
      b.v.surgeWarn = 1.2;
      api.sfx('boss_alarm');
      api.banner('GRAVITY SURGE!', 'neon-glow-pink');
      for (let i = 0; i < 6; i++) api.drone(40 + Math.random() * (api.W - 80), -30 - i * 30, (Math.random() - 0.5) * 60, 120);
    }
  },
  bullet(b, api, bl) {
    const d = dist(bl.x, bl.y, b.x, b.y);
    if (b.v.collapse > 0) {
      if (d < b.r * 0.85) {
        damage(b, api, 1.5);
        return 'hit';
      }
    } else if (d < b.r * 0.95) {
      return 'block';
    }
    for (const n of b.parts) {
      if (!n.alive || dist(bl.x, bl.y, n.x, n.y) >= n.r + 4) continue;
      n.hp -= 1;
      n.hitFlash = 0.06;
      if (n.hp <= 0) singularityNodeDown(b, api, n);
      return 'hit';
    }
    return null;
  },
  contact(b, api, dashing) {
    const p = api.player;
    for (const n of b.parts) {
      if (!n.alive || dist(p.x, p.y, n.x, n.y) >= n.r + p.radius * 0.8) continue;
      if (dashing) singularityNodeDown(b, api, n);
      else api.hurtPlayer();
    }
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.9 + p.radius * 0.6) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.collapse > 0) bodyContact(b, api, true, b.x, b.y, b.r * 1.3, 12, 'CORE STRIKE!');
    else bounce(api, b.x, b.y, 'REPELLED!');
  },
  emp(b, api) {
    if (b.v.collapse > 0) {
      damage(b, api, b.maxHp * 0.06);
      return;
    }
    let n = 2;
    for (const pt of b.parts) {
      if (n > 0 && pt.alive) {
        n--;
        singularityNodeDown(b, api, pt);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// NULL — the final boss. Three phases that remix every Warden.
// ---------------------------------------------------------------------------
const ECHOES = ['gate', 'twins', 'forge', 'gravity', 'wraith'] as const;
const ECHO_LINES: Record<(typeof ECHOES)[number], string> = {
  gate: 'Remember the Gatekeeper? I built its gate.',
  twins: 'Two signals, one will. Mine.',
  forge: 'Fuel for the fire. You.',
  gravity: 'Everything falls toward me.',
  wraith: 'Which of me is real, pilot?',
};

function nullEnterPhase(b: BossEntity, api: BossApi, phase: number) {
  b.phase = phase;
  b.v.trans = 1.6;
  b.attackTimer = 2;
  b.v.burst = 0;
  api.clearShots();
  api.sfx('boss_alarm');
  api.flash('#f87171', 0.45);
  api.shake(18);
  api.shockwave(b.x, b.y, '#f87171', 320, 6);
  api.shockwave(b.x, b.y, '#ffffff', 200, 3);
  if (phase === 2) {
    b.v.floor = b.maxHp * 0.25;
    b.v.echo = 0;
    b.v.echoT = 0;
    b.v.announce = 1;
    api.banner('PHASE 2 — ECHOES', 'neon-glow-pink');
    api.comm('null', 'Fine. Let me show you your victories... in reverse.');
  } else {
    b.hp = b.maxHp * 0.25;
    b.v.lock = 1;
    b.v.keys = 5;
    b.v.keyDmg = b.hp / 5;
    b.v.curtainA = 0;
    api.banner('PHASE 3 — DEFRAGMENT', 'neon-glow-pink');
    api.comm('null', 'You brought me the Root Keys. How thoughtful.');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.random() * 0.4;
      const s = 110 + Math.random() * 40;
      api.powerups.push({
        id: api.nextId(),
        kind: 'key',
        color: '#fde047',
        label: 'ROOT KEY',
        x: b.x,
        y: b.y + 40,
        vx: Math.cos(a) * s,
        vy: Math.abs(Math.sin(a)) * s + 30,
        r: 16,
        pulse: i,
        // Not collectable until the phase transition ends, so they can't be lost mid-rewrite
        armTime: 2,
      });
    }
  }
}

function nullEcho(b: BossEntity): (typeof ECHOES)[number] {
  return ECHOES[(b.v.echo || 0) % ECHOES.length];
}

const nullBoss: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(60, api.W * 0.13);
    b.phase = 1;
    b.v.floor = b.maxHp * 0.6;
    b.v.fieldOff = 0;
    b.v.nullText = 0;
    b.v.R = b.r * 1.4;
    b.v.shield = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    b.angle += dt * (b.phase + 0.5);
    if (b.v.fieldOff > 0) b.v.fieldOff -= dt;
    if (b.v.nullText > 0) b.v.nullText -= dt;
    if (b.v.stun > 0) b.v.stun -= dt;
    if (b.v.tetherOff > 0) b.v.tetherOff -= dt;
    if (!ready) {
      b.status = '';
      return;
    }
    b.t += dt;

    if (b.phase === 1 && b.hp <= b.maxHp * 0.6) nullEnterPhase(b, api, 2);
    else if (b.phase === 2 && b.hp <= b.maxHp * 0.25) nullEnterPhase(b, api, 3);

    const { W, H } = api;
    if (b.phase === 3) {
      b.x += (W / 2 + Math.sin(b.t * 0.3) * W * 0.1 - b.x) * Math.min(1, 2 * dt);
      b.y += (H * 0.2 - b.y) * Math.min(1, 2 * dt);
    } else {
      b.x = W / 2 + Math.sin(b.t * 0.5) * W * 0.25;
      b.y = b.targetY + Math.sin(b.t * 1.7) * 12;
    }

    if (b.v.trans > 0) {
      b.v.trans -= dt;
      b.status = 'NULL IS REWRITING ITSELF...';
      if (b.v.trans <= 0 && b.phase === 3) {
        api.comm('iris', 'It scattered the Keys! Grab all five, each one is a reboot pulse!');
      }
      return;
    }

    if (b.phase === 1) {
      b.status = b.v.fieldOff > 0 ? `FIELD BREACHED ${b.v.fieldOff.toFixed(1)}s — FIRE!` : 'NULL FIELD — only Overdrive & Dash hurt it';
    } else if (b.phase === 2) {
      b.v.echoT += dt;
      if (b.v.echoT > 8.5) {
        b.v.echoT = 0;
        b.v.echo++;
        b.v.stun = 0;
        b.v.tetherOff = 0;
        b.v.announce = 1;
        api.sfx('glitch');
      }
      if (b.v.announce) {
        b.v.announce = 0;
        api.comm('null', ECHO_LINES[nullEcho(b)]);
      }
      const echo = nullEcho(b);
      b.status = {
        gate: 'ECHO: GATE — fire through the gap',
        twins: b.v.stun > 0 ? `STUNNED ${b.v.stun.toFixed(1)}s — x2 DAMAGE!` : 'ECHO: TETHER — dash through it!',
        forge: 'ECHO: FORGE — parry the plasma cores!',
        gravity: 'ECHO: GRAVITY — fight the pull',
        wraith: 'ECHO: WRAITH — ghost shots fade in and out',
      }[echo];
      if (echo === 'gate') b.v.shield = (b.v.shield + dt * 1.0) % TAU;
      if (echo === 'gravity') applyGravity(api, b.x, b.y, dt, 110, 1, b.r * 0.8);
      if (echo === 'twins') {
        b.v.tetherRot = (b.v.tetherRot || 0) + dt * 1.1;
        if (b.v.stun <= 0 && b.v.tetherOff <= 0) {
          const L = Math.min(W * 0.48, 320);
          const c = Math.cos(b.v.tetherRot) * L;
          const s = Math.sin(b.v.tetherRot) * L;
          const touch = tetherTouch(api, b.x - c, b.y - s, b.x + c, b.y + s);
          if (touch === 'snap') {
            b.v.stun = 3;
            b.v.tetherOff = 9;
            api.sfx('parry');
            api.slowmo(0.4, 0.35);
            api.text(api.player.x, api.player.y - 26, 'TETHER SNAPPED!', '#fde047', 18);
            api.banner('NULL STUNNED — x2 DAMAGE!', 'neon-glow-amber');
          } else if (touch === 'hit') {
            api.hurtPlayer();
          }
        }
      }
    } else {
      b.status = `DEFRAGMENT — collect the ROOT KEYS (${5 - b.v.keys}/5)`;
    }

    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.1;
        b.v.burst--;
        b.v.burstA += 0.32;
        for (let k = 0; k < 3; k++) api.shot(b.x, b.y, b.v.burstA + (k * TAU) / 3, 180, { color: '#a5b4fc' });
      }
    }

    if (!api.alive) return;

    // Phase 3: rotating bullet curtain + periodic delete beams
    if (b.phase === 3) {
      b.v.curtainT = (b.v.curtainT || 0) - dt;
      if (b.v.curtainT <= 0) {
        b.v.curtainT = 0.1;
        b.v.curtainA += 0.21;
        const arms = api.hard ? 3 : 2;
        for (let k = 0; k < arms; k++) api.shot(b.x, b.y, b.v.curtainA + (k * TAU) / arms, 150, { color: '#fca5a5', glitch: true });
      }
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) {
        b.attackTimer = 3.4;
        api.laser(api.player.x + (Math.random() - 0.5) * 60, 'v', 1.2);
        api.laser(api.player.y, 'h', 1.6);
      }
      return;
    }

    if (b.v.stun > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    const p = api.player;
    const glitch = { color: '#fca5a5', glitch: true };
    api.sfx('enemy_shot');

    if (b.phase === 1) {
      b.attackTimer = 1.5;
      const pattern = b.attackIndex++ % 4;
      if (pattern === 0) ring(api, b.x, b.y, 18, 130, b.t, glitch);
      else if (pattern === 1) {
        api.laser(p.x);
        api.laser(p.x + (Math.random() < 0.5 ? -170 : 170));
      } else if (pattern === 2) {
        for (let i = 0; i < 10; i++) api.shot(30 + Math.random() * (W - 60), -10, Math.PI / 2 + (Math.random() - 0.5) * 0.4, 160, { color: '#fecaca', ghost: true });
      } else fan(api, b.x, b.y, aimAt(api, b.x, b.y), 7, 0.16, 200, glitch);
      return;
    }

    // Phase 2: echoes of every Warden
    const echo = nullEcho(b);
    b.attackIndex++;
    if (echo === 'gate') {
      b.attackTimer = 1.6;
      const gap = 1.2;
      ring(api, b.x, b.y, 28, 155, 0, { color: '#7dd3fc' }, (a) => Math.abs(angDiff(a, b.v.shield)) < gap / 2);
    } else if (echo === 'twins') {
      b.attackTimer = 1.2;
      const L = Math.min(W * 0.48, 320);
      for (const s of [-1, 1]) {
        const ex = b.x + Math.cos(b.v.tetherRot) * L * s;
        const ey = b.y + Math.sin(b.v.tetherRot) * L * s;
        fan(api, ex, ey, aimAt(api, ex, ey), 2, 0.15, 220, { color: s < 0 ? '#67e8f9' : '#f9a8d4' });
      }
    } else if (echo === 'forge') {
      b.attackTimer = 1.9;
      const aim = aimAt(api, b.x, b.y);
      api.orb(b.x, b.y + b.r * 0.5, aim - 0.3, 130);
      api.orb(b.x, b.y + b.r * 0.5, aim + 0.3, 130);
    } else if (echo === 'gravity') {
      b.attackTimer = 2;
      b.v.burst = 12;
      b.v.burstT = 0;
      b.v.burstA = b.t;
    } else {
      b.attackTimer = 1.4;
      for (const ox of [-W * 0.28, 0, W * 0.28]) {
        fan(api, b.x + ox, b.y, aimAt(api, b.x + ox, b.y), 3, 0.22, 190, { color: '#c4b5fd', ghost: true });
      }
    }
  },
  bullet(b, api, bl) {
    const d = dist(bl.x, bl.y, b.x, b.y);
    if (b.v.trans > 0 || b.phase === 3) return d < b.r * 1.25 ? 'block' : null;
    if (b.phase === 1) {
      if (d >= b.r * 1.25) return null;
      if (bl.fever || b.v.fieldOff > 0) {
        if (d >= b.r * 0.85) return null;
        damage(b, api, 1);
        return 'hit';
      }
      if (b.v.nullText <= 0) {
        b.v.nullText = 1.2;
        api.text(bl.x, bl.y - 10, 'NULLIFIED', '#fca5a5', 13);
      }
      return 'block';
    }
    if (nullEcho(b) === 'gate' && gateBlocks(bl, b.x, b.y, b.v.R, b.v.shield, 1.2)) return 'block';
    if (d >= b.r * 0.85) return null;
    damage(b, api, b.v.stun > 0 ? 2 : 1);
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.phase === 3 || b.v.trans > 0) bounce(api, b.x, b.y, 'LOCKED!');
    else bodyContact(b, api, true, b.x, b.y, b.r, b.v.stun > 0 ? 16 : 8, 'BREACH STRIKE!');
  },
  emp(b, api) {
    if (b.phase === 1) {
      b.v.fieldOff = 3.5;
      api.banner('NULL FIELD BREACHED!', 'neon-glow-amber');
    } else if (b.phase === 2) {
      damage(b, api, b.maxHp * 0.05);
    }
  },
  orbReturn(b, api) {
    if (b.phase === 3) return;
    damage(b, api, 15);
    b.v.stun = Math.max(b.v.stun || 0, 1.5);
    api.sfx('boom');
    api.shake(14);
    api.flash('#fb923c', 0.3);
    api.shockwave(b.x, b.y, '#fb923c', 200, 5);
    api.text(b.x, b.y + b.r + 14, 'OWN FIRE RETURNED!', '#fdba74', 16);
  },
  key(b, api) {
    if (b.phase !== 3) return;
    b.v.keys--;
    b.hp = Math.max(0, b.hp - b.v.keyDmg);
    b.hitFlash = 0.2;
    const n = 5 - b.v.keys;
    api.sfx('fever');
    api.shake(16);
    api.flash('#fde047', 0.4);
    api.shockwave(b.x, b.y, '#fde047', 260, 6);
    api.shockwave(api.player.x, api.player.y, '#fde047', 160, 4);
    api.particles(b.x, b.y, '#fde047', 30, 300, true);
    api.banner(`REBOOT PULSE ${n}/5`, 'neon-glow-amber');
    if (b.v.keys <= 0) {
      b.v.lock = 0;
      b.hp = 0;
      api.defeat();
    }
  },
};

export const BOSSES: Record<BossKind, BossBehavior> = {
  sentinel,
  gatekeeper,
  twins,
  furnace,
  wraith,
  singularity,
  null: nullBoss,
};

/** Twin names, exported for rendering. */
export { TWIN_NAMES };
