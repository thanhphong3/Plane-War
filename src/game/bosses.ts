import { BossEntity, BossKind, BossPart, BulletEntity, HazardEntity, PowerupEntity } from '../types/game';
import { tr } from '../i18n';
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
  /** Polarity (DYNAMO): 1 = blue, -1 = red. */
  pol?: number;
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

/** Damage carried by one player bullet (weapon level + Blaster Core). */
function bulletDmg(bl: BulletEntity): number {
  return bl.damage ?? 1;
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
function bounce(api: BossApi, fromX: number, fromY: number, label = tr('CLANK!', 'KENG!')) {
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
function bodyContact(b: BossEntity, api: BossApi, dashing: boolean, x: number, y: number, r: number, dmg: number, label = tr('CORE STRIKE!', 'ĐÒN VÀO LÕI!')) {
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
    // The escape countdown lives in the HUD (it applies to every boss that can retreat)
    b.status = rage ? tr('ENRAGED — faster volleys!', 'NỔI ĐIÊN — bắn dồn dập hơn!') : '';
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
    damage(b, api, bulletDmg(bl));
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
    b.status = facing
      ? tr('GAP OPEN ▼ FIRE NOW!', 'KHE HỞ ▼ BẮN NGAY!')
      : tr('Shield sealed — wait for the gap', 'Khiên đã khép — chờ khe hở');
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
    damage(b, api, bulletDmg(bl));
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
      strikeFx(api, tr('GATE BREACH!', 'PHÁ CỔNG!'));
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
    api.banner(
      tr(`${TWIN_NAMES[i]} DOWN — FINISH ${TWIN_NAMES[1 - i]}!`, `${TWIN_NAMES[i]} GỤC — HẠ NỐT ${TWIN_NAMES[1 - i]}!`),
      'neon-glow-amber'
    );
    api.comm(
      i ? 'castor' : 'pollux',
      i
        ? tr('Pollux! Hold on, I’m rebuilding you!', 'Pollux! Cố lên, ta đang dựng lại ngươi!')
        : tr('Castor! I’ll bring you back!', 'Castor! Ta sẽ đưa ngươi trở lại!')
    );
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
        api.banner(tr(`${TWIN_NAMES[i]} REVIVED!`, `${TWIN_NAMES[i]} HỒI SINH!`), 'neon-glow-pink');
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
      if (next === 'cross') api.banner(tr('TETHER DESCENDING!', 'DÂY NỐI HẠ XUỐNG!'), 'neon-glow-pink');
      if (next === 'scissor') api.banner(tr('TETHER SWEEP!', 'DÂY NỐI QUÉT NGANG!'), 'neon-glow-pink');
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
        api.text(p.x, p.y - 26, tr('TETHER SNAPPED!', 'ĐỨT DÂY NỐI!'), '#fde047', 18);
        api.banner(tr('TWINS STUNNED — x2 DAMAGE!', 'SONG SINH BỊ CHOÁNG — x2 SÁT THƯƠNG!'), 'neon-glow-amber');
      } else if (touch === 'hit') {
        api.hurtPlayer();
      }
    }

    const dead = b.parts.findIndex((pt) => !pt.alive);
    if (dead >= 0) {
      const left = Math.max(0, b.parts[dead].timer).toFixed(1);
      b.status = tr(
        `${TWIN_NAMES[dead]} DOWN — kill ${TWIN_NAMES[1 - dead]} in ${left}s!`,
        `${TWIN_NAMES[dead]} GỤC — hạ ${TWIN_NAMES[1 - dead]} trong ${left}s!`
      );
    } else if (b.v.stun > 0) b.status = stunnedStatus(b.v.stun);
    else if (mode === 'cross') b.status = tr('Tether descending — dash through or stay low!', 'Dây nối hạ xuống — lướt xuyên qua hoặc bay thấp!');
    else if (mode === 'scissor') b.status = tr('Tether sweep — dash through to snap it!', 'Dây nối quét ngang — lướt xuyên qua để bẻ gãy!');
    else b.status = tr('Dash through the tether to stun both', 'Lướt xuyên dây nối để làm choáng cả hai');

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
        twinDamage(b, api, i, bulletDmg(bl));
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
        strikeFx(api, tr(`${TWIN_NAMES[i]} STRIKE!`, `ĐÁNH TRÚNG ${TWIN_NAMES[i]}!`));
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
        api.text(b.x, b.y + b.r + 10, tr('VENTS SEALED', 'LỖ THÔNG HƠI ĐÃ ĐÓNG'), '#fdba74', 14);
      }
    }
    b.status =
      b.v.vent > 0
        ? tr(`VENTS OPEN ${b.v.vent.toFixed(1)}s — FIRE AT THE CORE!`, `LỖ THÔNG HƠI MỞ ${b.v.vent.toFixed(1)}s — BẮN VÀO LÕI!`)
        : tr('Armored — dash INTO a Plasma Core to deflect it', 'Bọc giáp — lướt VÀO Lõi Plasma để phản nó lại');
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
      damage(b, api, 1.4 * bulletDmg(bl));
      return 'hit';
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.85 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.vent > 0) bodyContact(b, api, true, b.x, b.y, b.r, 14, tr('MELTDOWN STRIKE!', 'ĐÒN NÓNG CHẢY!'));
    else bounce(api, b.x, b.y);
  },
  emp(b, api) {
    if (b.v.vent > 0) damage(b, api, b.maxHp * 0.06);
    else {
      b.v.vent = 2.5;
      api.text(b.x, b.y + b.r + 12, tr('EMP SHORTED THE ARMOR!', 'EMP LÀM CHẬP GIÁP!'), '#fde047', 15);
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
    api.banner(tr('VENTS OPEN — FIRE AT THE CORE!', 'LỖ THÔNG HƠI MỞ — BẮN VÀO LÕI!'), 'neon-glow-amber');
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
  api.text(pt.x, pt.y - 20, burst ? tr('DECOY!', 'BẢN GIẢ!') : tr('DECOY POPPED', 'BẢN GIẢ ĐÃ VỠ'), '#ddd6fe', 15);
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
        ? tr(`TRUE SIGNAL LOCKED ${b.v.reveal.toFixed(1)}s`, `ĐÃ KHÓA TÍN HIỆU THẬT ${b.v.reveal.toFixed(1)}s`)
        : tr(
            `SCAN ${Math.floor(b.v.scan)}% — graze shots to reveal the real one`,
            `QUÉT ${Math.floor(b.v.scan)}% — sượt qua đạn để lộ bản thật`
          );

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
      const dmg = (b.v.reveal > 0 ? 1.5 : 1) * bulletDmg(bl);
      damage(b, api, dmg);
      b.v.chunk += dmg;
      if (b.v.chunk >= b.maxHp * 0.18 && b.hp > 0) {
        b.v.chunk = 0;
        api.text(pt.x, pt.y - 30, tr('IT SHIFTS!', 'NÓ ĐỔI CHỖ!'), '#c4b5fd', 16);
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
        strikeFx(api, tr('SOUL STRIKE!', 'ĐÒN LINH HỒN!'));
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
      api.banner(tr('TRUE SIGNAL LOCKED!', 'ĐÃ KHÓA TÍN HIỆU THẬT!'), 'neon-glow-amber');
      api.comm('iris', tr('Got it! The marked one is real. Hit it!', 'Bắt được rồi! Cái bị đánh dấu là thật. Bắn nó!'));
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
  const downLabel = left
    ? tr(`STABILIZER DOWN ${4 - left}/4`, `HẠ BỘ ỔN ĐỊNH ${4 - left}/4`)
    : tr('ALL STABILIZERS DOWN!', 'ĐÃ HẠ CẢ 4 BỘ ỔN ĐỊNH!');
  api.text(pt.x, pt.y - 20, downLabel, '#c7d2fe', 15);
  if (left === 0) {
    b.v.collapse = api.hard ? 6 : 7;
    b.v.surge = 0;
    b.v.surgeWarn = 0;
    b.v.burst = 0;
    api.sfx('fever');
    api.flash('#818cf8', 0.45);
    api.slowmo(0.4, 0.4);
    api.shockwave(b.x, b.y, '#ffffff', 300, 6);
    api.banner(tr('COLLAPSE — CORE EXPOSED!', 'SỤP ĐỔ — LÕI LỘ RA!'), 'neon-glow-amber');
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
      ? tr(`COLLAPSE ${b.v.collapse.toFixed(1)}s — CORE EXPOSED, FIRE!`, `SỤP ĐỔ ${b.v.collapse.toFixed(1)}s — LÕI LỘ RA, BẮN!`)
      : b.v.surgeWarn > 0 || b.v.surge > 0
      ? tr('GRAVITY SURGE — fight the pull!', 'TRỌNG LỰC DÂNG TRÀO — chống lại lực hút!')
      : tr(`Stabilizers ${alive}/4 — shoot them (your shots bend!)`, `Bộ Ổn Định ${alive}/4 — bắn chúng (đạn sẽ bị bẻ cong!)`);
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
        api.banner(tr('STABILIZERS REBUILT', 'BỘ ỔN ĐỊNH ĐÃ TÁI TẠO'), 'neon-glow-pink');
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
      api.banner(tr('GRAVITY SURGE!', 'TRỌNG LỰC DÂNG TRÀO!'), 'neon-glow-pink');
      for (let i = 0; i < 6; i++) api.drone(40 + Math.random() * (api.W - 80), -30 - i * 30, (Math.random() - 0.5) * 60, 120);
    }
  },
  bullet(b, api, bl) {
    const d = dist(bl.x, bl.y, b.x, b.y);
    if (b.v.collapse > 0) {
      if (d < b.r * 0.85) {
        damage(b, api, 1.5 * bulletDmg(bl));
        return 'hit';
      }
    } else if (d < b.r * 0.95) {
      return 'block';
    }
    for (const n of b.parts) {
      if (!n.alive || dist(bl.x, bl.y, n.x, n.y) >= n.r + 4) continue;
      n.hp -= bulletDmg(bl);
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
    else if (b.v.collapse > 0) bodyContact(b, api, true, b.x, b.y, b.r * 1.3, 12);
    else bounce(api, b.x, b.y, tr('REPELLED!', 'BỊ ĐẨY LÙI!'));
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
const ECHO_LINES: Record<(typeof ECHOES)[number], [en: string, vi: string]> = {
  gate: ['Remember the Gatekeeper? I built its gate.', 'Nhớ Gatekeeper chứ? Chính ta dựng cánh cổng của nó.'],
  twins: ['Two signals, one will. Mine.', 'Hai tín hiệu, một ý chí. Của ta.'],
  forge: ['Fuel for the fire. You.', 'Nhiên liệu cho ngọn lửa. Là ngươi.'],
  gravity: ['Everything falls toward me.', 'Mọi thứ đều rơi về phía ta.'],
  wraith: ['Which of me is real, pilot?', 'Ta nào mới là thật, phi công?'],
};

const stunnedStatus = (stun: number) =>
  tr(`STUNNED ${stun.toFixed(1)}s — x2 DAMAGE!`, `CHOÁNG ${stun.toFixed(1)}s — x2 SÁT THƯƠNG!`);

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
    api.banner(tr('PHASE 2 — ECHOES', 'GIAI ĐOẠN 2 — TIẾNG VỌNG'), 'neon-glow-pink');
    api.comm('null', tr('Fine. Let me show you your victories... in reverse.', 'Được thôi. Để ta cho ngươi xem lại các chiến thắng của mình... theo chiều ngược lại.'));
  } else {
    b.hp = b.maxHp * 0.25;
    b.v.lock = 1;
    b.v.keys = 5;
    b.v.keyDmg = b.hp / 5;
    b.v.curtainA = 0;
    api.banner(tr('PHASE 3 — DEFRAGMENT', 'GIAI ĐOẠN 3 — CHỐNG PHÂN MẢNH'), 'neon-glow-pink');
    api.comm('null', tr('You brought me the Root Keys. How thoughtful.', 'Ngươi mang Khóa Gốc đến cho ta. Chu đáo thật.'));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.random() * 0.4;
      const s = 110 + Math.random() * 40;
      api.powerups.push({
        id: api.nextId(),
        kind: 'key',
        color: '#fde047',
        label: tr('ROOT KEY', 'KHÓA GỐC'),
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
      b.status = tr('NULL IS REWRITING ITSELF...', 'NULL ĐANG TỰ VIẾT LẠI...');
      if (b.v.trans <= 0 && b.phase === 3) {
        api.comm('iris', tr('It scattered the Keys! Grab all five, each one is a reboot pulse!', 'Nó rải các Khóa ra rồi! Nhặt đủ năm chiếc, mỗi chiếc là một xung khởi động lại!'));
      }
      return;
    }

    if (b.phase === 1) {
      b.status =
        b.v.fieldOff > 0
          ? tr(`FIELD BREACHED ${b.v.fieldOff.toFixed(1)}s — FIRE!`, `TRƯỜNG ĐÃ THỦNG ${b.v.fieldOff.toFixed(1)}s — BẮN!`)
          : tr('NULL FIELD — only Overdrive & Dash hurt it', 'TRƯỜNG NULL — chỉ Quá Tải & Lướt gây sát thương');
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
        api.comm('null', tr(...ECHO_LINES[nullEcho(b)]));
      }
      const echo = nullEcho(b);
      b.status = {
        gate: tr('ECHO: GATE — fire through the gap', 'VỌNG: CỔNG — bắn qua khe hở'),
        twins: b.v.stun > 0 ? stunnedStatus(b.v.stun) : tr('ECHO: TETHER — dash through it!', 'VỌNG: DÂY NỐI — lướt xuyên qua!'),
        forge: tr('ECHO: FORGE — parry the plasma cores!', 'VỌNG: LÒ RÈN — phản lại lõi plasma!'),
        gravity: tr('ECHO: GRAVITY — fight the pull', 'VỌNG: TRỌNG LỰC — chống lại lực hút'),
        wraith: tr('ECHO: WRAITH — ghost shots fade in and out', 'VỌNG: WRAITH — đạn ma lúc ẩn lúc hiện'),
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
            api.text(api.player.x, api.player.y - 26, tr('TETHER SNAPPED!', 'ĐỨT DÂY NỐI!'), '#fde047', 18);
            api.banner(tr('NULL STUNNED — x2 DAMAGE!', 'NULL BỊ CHOÁNG — x2 SÁT THƯƠNG!'), 'neon-glow-amber');
          } else if (touch === 'hit') {
            api.hurtPlayer();
          }
        }
      }
    } else {
      b.status = tr(
        `DEFRAGMENT — collect the ROOT KEYS (${5 - b.v.keys}/5)`,
        `CHỐNG PHÂN MẢNH — thu thập KHÓA GỐC (${5 - b.v.keys}/5)`
      );
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
        damage(b, api, bulletDmg(bl));
        return 'hit';
      }
      if (b.v.nullText <= 0) {
        b.v.nullText = 1.2;
        api.text(bl.x, bl.y - 10, tr('NULLIFIED', 'BỊ VÔ HIỆU'), '#fca5a5', 13);
      }
      return 'block';
    }
    if (nullEcho(b) === 'gate' && gateBlocks(bl, b.x, b.y, b.v.R, b.v.shield, 1.2)) return 'block';
    if (d >= b.r * 0.85) return null;
    damage(b, api, (b.v.stun > 0 ? 2 : 1) * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.phase === 3 || b.v.trans > 0) bounce(api, b.x, b.y, tr('LOCKED!', 'ĐÃ KHÓA!'));
    else bodyContact(b, api, true, b.x, b.y, b.r, b.v.stun > 0 ? 16 : 8, tr('BREACH STRIKE!', 'ĐÒN XUYÊN PHÁ!'));
  },
  emp(b, api) {
    if (b.phase === 1) {
      b.v.fieldOff = 3.5;
      api.banner(tr('NULL FIELD BREACHED!', 'TRƯỜNG NULL ĐÃ THỦNG!'), 'neon-glow-amber');
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
    api.text(b.x, b.y + b.r + 14, tr('OWN FIRE RETURNED!', 'GẬY ÔNG ĐẬP LƯNG ÔNG!'), '#fdba74', 16);
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
    api.banner(tr(`REBOOT PULSE ${n}/5`, `XUNG KHỞI ĐỘNG LẠI ${n}/5`), 'neon-glow-amber');
    if (b.v.keys <= 0) {
      b.v.lock = 0;
      b.hp = 0;
      api.defeat();
    }
  },
};

// ===========================================================================
// ACT II — THE DEEP ARCHIVE
// ===========================================================================

// ---------------------------------------------------------------------------
// MIMIC — a mirror image of the pilot. Bullets can't hurt a perfect copy:
// steer its reflection into its own mines instead.
// ---------------------------------------------------------------------------
const MIRROR_ABSORB = 16;
const MIMIC_COLOR = '#e2e8f0';

/** Where the reflection wants to be: the pilot mirrored through the screen centre. */
function mimicTarget(api: BossApi) {
  const p = api.player;
  return { x: api.W - p.x, y: Math.max(70, Math.min(api.H - 70, api.H - p.y)) };
}

function mimicMine(b: BossEntity, api: BossApi) {
  const { W, H } = api;
  for (let tries = 0; tries < 10; tries++) {
    const x = 40 + Math.random() * (W - 80);
    const y = H * 0.1 + Math.random() * H * 0.32;
    if (dist(x, y, b.x, b.y) < 120) continue;
    if (b.parts.some((m) => dist(x, y, m.x, m.y) < 80)) continue;
    const m = makePart(x, y, 15, 1);
    m.timer = 0.9; // arming
    m.a = Math.random() * TAU; // drift heading once the mirror starts lagging
    b.parts.push(m);
    return;
  }
}

function mimicDetonate(b: BossEntity, api: BossApi, m: BossPart, byMirror: boolean) {
  b.parts.splice(b.parts.indexOf(m), 1);
  api.sfx('boom');
  api.shake(byMirror ? 16 : 8);
  api.shockwave(m.x, m.y, MIMIC_COLOR, byMirror ? 200 : 110, byMirror ? 5 : 3);
  api.particles(m.x, m.y, MIMIC_COLOR, byMirror ? 36 : 16, 320, true);
  if (!byMirror) {
    api.text(m.x, m.y - 20, tr('MINE CLEARED', 'ĐÃ PHÁ MÌN'), '#cbd5e1', 13);
    return;
  }
  api.flash(MIMIC_COLOR, 0.3);
  api.slowmo(0.45, 0.25);
  api.text(m.x, m.y - 24, tr('MIRROR CRACKED!', 'GƯƠNG NỨT!'), '#fde047', 17);
  ring(api, m.x, m.y, 8, 130, Math.random(), { color: '#cbd5e1' });
  damage(b, api, b.maxHp * 0.075);
}

const mimic: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(34, api.W * 0.08);
    b.v.absorbed = 0;
    b.v.freeze = 0;
    b.v.mineT = 1.2;
    b.v.lagged = 0;
    b.v.burst = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    if (b.v.freeze > 0) b.v.freeze -= dt;
    b.status =
      b.v.freeze > 0
        ? tr(`MIRROR FROZEN ${b.v.freeze.toFixed(1)}s — FIRE!`, `GƯƠNG ĐÓNG BĂNG ${b.v.freeze.toFixed(1)}s — BẮN!`)
        : b.v.absorbed >= MIRROR_ABSORB * 0.6
        ? tr(`Absorbed ${b.v.absorbed}/${MIRROR_ABSORB} — it will fire them back!`, `Đã hấp thụ ${b.v.absorbed}/${MIRROR_ABSORB} — nó sắp bắn trả!`)
        : tr('It copies you — steer its reflection into the MINES', 'Nó bắt chước bạn — lái hình phản chiếu vào MÌN');
    if (!ready) return;
    b.t += dt;
    b.angle += dt;
    const { W, H } = api;
    const p = api.player;

    if (rage && !b.v.lagged) {
      b.v.lagged = 1;
      api.banner(tr('REFLECTION LAG!', 'PHẢN CHIẾU TRỄ NHỊP!'), 'neon-glow-pink');
      api.comm('iris', tr('It’s lagging behind you now, and the mines are drifting. Lead it in!', 'Giờ nó trễ nhịp so với bạn, và mìn bắt đầu trôi. Dẫn nó vào!'));
    }

    // Follow the mirror point (snappier while you dash, sluggish once enraged)
    if (b.v.freeze <= 0 && api.alive) {
      const m = mimicTarget(api);
      const rate = p.dashTimer > 0 ? 14 : rage ? 2.6 : 7;
      const k = 1 - Math.exp(-rate * dt);
      b.x += (m.x - b.x) * k;
      b.y += (m.y - b.y) * k;
    }

    // Mines: arm, drift, trigger
    b.v.mineT -= dt;
    if (b.v.mineT <= 0) {
      b.v.mineT = rage ? 1.9 : 2.4;
      if (b.parts.length < (rage ? 5 : 4)) mimicMine(b, api);
    }
    for (let i = b.parts.length - 1; i >= 0; i--) {
      const m = b.parts[i];
      if (m.timer > 0) {
        m.timer -= dt;
        continue;
      }
      if (rage) {
        const a = m.a || 0;
        m.x += Math.cos(a) * 26 * dt;
        m.y += Math.sin(a) * 26 * dt;
        if (m.x < 30 || m.x > W - 30) m.a = Math.PI - a;
        if (m.y < H * 0.08 || m.y > H * 0.45) m.a = -a;
        m.x = Math.max(30, Math.min(W - 30, m.x));
        m.y = Math.max(H * 0.08, Math.min(H * 0.45, m.y));
      }
      if (dist(b.x, b.y, m.x, m.y) < b.r * 0.8 + m.r) {
        mimicDetonate(b, api, m, true);
        if (b.hp <= 0) return;
        continue;
      }
      if (api.alive && dist(p.x, p.y, m.x, m.y) < m.r + p.radius * 0.6) {
        if (isDashing(api)) mimicDetonate(b, api, m, false);
        else {
          b.parts.splice(i, 1);
          api.particles(m.x, m.y, MIMIC_COLOR, 16, 260, true);
          api.hurtPlayer();
        }
      }
    }

    // Copies your auto-blaster: a straight stream from its own guns
    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.07;
        b.v.burst--;
        api.shot(b.x + (b.v.burst % 2 ? -9 : 9), b.y + b.r * 0.6, Math.PI / 2, 300, { color: MIMIC_COLOR, r: 4 });
      }
    }

    if (!api.alive || b.v.freeze > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.35 : 1.75;
    const pattern = ['volley', 'stream', 'volley', 'reflect'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    if (pattern === 'volley') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 220, { color: MIMIC_COLOR });
    } else if (pattern === 'stream') {
      b.v.burst = rage ? 12 : 8;
      b.v.burstT = 0;
    } else {
      // Reflection: a laser on you and one on your mirror image
      api.laser(p.x);
      if (Math.abs(W - p.x * 2) > 80) api.laser(W - p.x);
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    if (b.v.freeze > 0) {
      damage(b, api, 1.3 * bulletDmg(bl));
      return 'hit';
    }
    b.v.absorbed++;
    if (b.v.absorbed >= MIRROR_ABSORB) {
      b.v.absorbed = 0;
      api.sfx('parry');
      api.text(b.x, b.y + b.r + 14, tr('REFLECTED!', 'PHẢN XẠ!'), MIMIC_COLOR, 16);
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), 7, 0.13, 260, { color: '#f8fafc' });
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.freeze > 0) bodyContact(b, api, true, b.x, b.y, b.r, 10, tr('SHATTER STRIKE!', 'ĐÒN VỠ GƯƠNG!'));
    else bounce(api, b.x, b.y, tr('MIRRORED!', 'PHẢN CHIẾU!'));
  },
  emp(b, api) {
    b.v.freeze = 3.5;
    damage(b, api, b.maxHp * 0.04);
    api.banner(tr('MIRROR FROZEN — FIRE!', 'GƯƠNG ĐÓNG BĂNG — BẮN!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// DYNAMO — polarity. Every Dash flips the pilot's charge; same-colour shots
// are absorbed into FLUX, and only an opposite charge can hurt the shell.
// ---------------------------------------------------------------------------
const POL_BLUE = '#60a5fa';
const POL_RED = '#f43f5e';
const polColor = (pol: number) => (pol > 0 ? POL_BLUE : POL_RED);
const polName = (pol: number) => (pol > 0 ? tr('BLUE', 'XANH') : tr('RED', 'ĐỎ'));

function polShot(api: BossApi, x: number, y: number, a: number, speed: number, pol: number, r?: number) {
  api.shot(x, y, a, speed, { color: polColor(pol), pol, r });
}

/** A gapless row of one colour sweeping down the screen: match it or eat it. */
function polarWall(api: BossApi, pol: number) {
  const n = Math.ceil(api.W / 32);
  for (let i = 0; i <= n; i++) polShot(api, (i * api.W) / n, 24, Math.PI / 2, 125, pol, 7);
}

const dynamo: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(52, api.W * 0.115);
    b.v.pp = 1; // pilot charge
    b.v.bp = -1; // shell charge — starts opposite, so the pilot can open fire
    b.v.flipT = 7;
    b.v.warned = 0;
    b.v.flux = 0;
    b.v.dashWas = 0;
    b.v.repelText = 0;
    b.v.wall2 = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.45;
    const p = api.player;
    b.angle += dt * (rage ? 2.2 : 1.4) * b.v.bp;
    if (b.v.repelText > 0) b.v.repelText -= dt;

    // Every Dash flips the pilot's charge
    const dashing = p.dashTimer > 0;
    if (dashing && !b.v.dashWas && api.alive) {
      b.v.pp *= -1;
      api.text(p.x, p.y - 30, tr(`CHARGE: ${polName(b.v.pp)}`, `CỰC: ${polName(b.v.pp)}`), polColor(b.v.pp), 14);
      api.shockwave(p.x, p.y, polColor(b.v.pp), 70, 3);
    }
    b.v.dashWas = dashing ? 1 : 0;

    const opposite = b.v.pp !== b.v.bp;
    b.status = opposite
      ? tr(
          `YOU ${polName(b.v.pp)} · SHELL ${polName(b.v.bp)} — FIRE! · FLUX ${Math.floor(b.v.flux)}%`,
          `BẠN ${polName(b.v.pp)} · VỎ ${polName(b.v.bp)} — BẮN! · FLUX ${Math.floor(b.v.flux)}%`
        )
      : tr(
          `YOU ${polName(b.v.pp)} · SHELL ${polName(b.v.bp)} — DASH to flip · FLUX ${Math.floor(b.v.flux)}%`,
          `BẠN ${polName(b.v.pp)} · VỎ ${polName(b.v.bp)} — LƯỚT để đổi cực · FLUX ${Math.floor(b.v.flux)}%`
        );
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.45) * api.W * 0.22;
    b.y = b.targetY + Math.sin(b.t * 1.2) * 12;

    // Shell flip, with a warning
    b.v.flipT -= dt;
    if (b.v.flipT <= 1.2 && !b.v.warned) {
      b.v.warned = 1;
      api.sfx('laser_warn');
      api.banner(tr('POLARITY SHIFT INCOMING', 'SẮP ĐẢO CỰC'), 'neon-glow-pink');
    }
    if (b.v.flipT <= 0) {
      b.v.bp *= -1;
      b.v.flipT = rage ? 5 : 6.5;
      b.v.warned = 0;
      api.sfx('glitch');
      api.shockwave(b.x, b.y, polColor(b.v.bp), 220, 5);
      api.text(b.x, b.y + b.r + 16, tr(`SHELL: ${polName(b.v.bp)}`, `VỎ: ${polName(b.v.bp)}`), polColor(b.v.bp), 16);
    }

    // Absorb shots that match the pilot's charge (runs before the engine's hit test)
    if (api.alive) {
      const reach = p.radius * 0.5 + 12;
      for (let i = api.hazards.length - 1; i >= 0; i--) {
        const h = api.hazards[i];
        if (h.type !== 'shot' || h.pol !== b.v.pp || dist(h.x, h.y, p.x, p.y) > reach + h.r) continue;
        api.hazards.splice(i, 1);
        api.particles(h.x, h.y, h.color, 3, 90);
        b.v.flux = Math.min(100, b.v.flux + 4);
      }
      if (b.v.flux >= 100) {
        b.v.flux = 0;
        api.sfx('fever');
        api.shake(16);
        api.flash(polColor(b.v.pp), 0.35);
        api.slowmo(0.45, 0.3);
        api.shockwave(p.x, p.y, polColor(b.v.pp), 160, 4);
        api.shockwave(b.x, b.y, '#ffffff', 240, 6);
        api.particles(b.x, b.y, polColor(b.v.pp), 40, 340, true);
        api.banner(tr('FLUX DISCHARGE!', 'XẢ FLUX!'), 'neon-glow-amber');
        damage(b, api, b.maxHp * 0.1);
        if (b.hp <= 0) return;
      }
    }

    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.09;
        b.v.burst--;
        b.v.burstA += 0.27;
        for (let k = 0; k < 2; k++) polShot(api, b.x, b.y, b.v.burstA + k * Math.PI, 165, k ? 1 : -1);
      }
    }
    if (b.v.wall2 > 0) {
      b.v.wall2 -= dt;
      if (b.v.wall2 <= 0 && api.alive) polarWall(api, -b.v.wallPol);
    }

    if (!api.alive) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.5 : 1.9;
    const pattern = ['spiral', 'fan', 'wall', 'fan', 'spiral', 'rain'][b.attackIndex++ % 6];
    api.sfx('enemy_shot');
    if (pattern === 'spiral') {
      b.v.burst = rage ? 18 : 14;
      b.v.burstT = 0;
      b.v.burstA = b.t;
    } else if (pattern === 'fan') {
      const aim = aimAt(api, b.x, b.y);
      const n = rage ? 7 : 5;
      for (let i = 0; i < n; i++) polShot(api, b.x, b.y, aim + (i - (n - 1) / 2) * 0.17, 210, i % 2 ? 1 : -1);
      if (rage) api.laser(p.x);
    } else if (pattern === 'wall') {
      // Always the colour you're NOT: flip to soak it up
      b.v.wallPol = -b.v.pp;
      polarWall(api, b.v.wallPol);
      api.banner(tr(`POLAR WALL — turn ${polName(b.v.wallPol)}!`, `TƯỜNG CỰC — đổi sang ${polName(b.v.wallPol)}!`), 'neon-glow-pink');
      if (rage) b.v.wall2 = 1.3;
    } else {
      for (let i = 0; i < 12; i++) {
        polShot(api, 30 + Math.random() * (api.W - 60), -10, Math.PI / 2 + (Math.random() - 0.5) * 0.3, 150 + Math.random() * 50, Math.random() < 0.5 ? 1 : -1);
      }
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    if (b.v.pp !== b.v.bp) {
      damage(b, api, bulletDmg(bl));
      return 'hit';
    }
    if (b.v.repelText <= 0) {
      b.v.repelText = 1.2;
      api.text(bl.x, bl.y - 10, tr('REPELLED — FLIP CHARGE!', 'BỊ ĐẨY — ĐỔI CỰC!'), polColor(b.v.bp), 13);
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.pp !== b.v.bp) bodyContact(b, api, true, b.x, b.y, b.r, 10, tr('POLAR STRIKE!', 'ĐÒN TRÁI CỰC!'));
    else bounce(api, b.x, b.y, tr('REPELLED!', 'BỊ ĐẨY LÙI!'));
  },
  emp(b, api) {
    // Forces the shell opposite to you and tops up FLUX
    b.v.bp = -b.v.pp;
    b.v.flipT = 6;
    b.v.warned = 0;
    b.v.flux = Math.min(99, b.v.flux + 40);
    api.banner(tr('EMP — SHELL REVERSED!', 'EMP — VỎ ĐÃ ĐẢO CỰC!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// CHRONOS — damage is borrowed time: it rewinds when the minute hand hits XII,
// unless the pendulum is broken to lock it in.
// ---------------------------------------------------------------------------
const CLOCK_TURN = 11;
const CLOCK_GOLD = '#fbbf24';
/** Shots caught in a Time Stop, re-aimed when time resumes. */
const frozenShots = new WeakSet<HazardEntity>();

const chronosHandLen = (api: BossApi) => Math.min(api.H * 0.56, 470);

/** Body damage that still counts as unbanked (rewindable) unless the clock is stopped. */
function chronosHit(b: BossEntity, api: BossApi, amount: number) {
  const before = b.hp;
  damage(b, api, amount);
  if (b.v.stopped <= 0) b.v.pending += before - b.hp;
}

function chronosBreak(b: BossEntity, api: BossApi) {
  const bob = b.parts[0];
  if (!bob || !bob.alive) return;
  bob.alive = false;
  bob.timer = 6;
  b.v.breaks++;
  const banked = b.v.pending;
  b.v.pending = 0;
  b.v.stopped = 3.5;
  api.sfx('fever');
  api.shake(16);
  api.flash(CLOCK_GOLD, 0.35);
  api.slowmo(0.4, 0.35);
  api.shockwave(bob.x, bob.y, CLOCK_GOLD, 200, 5);
  api.particles(bob.x, bob.y, '#fde68a', 34, 320, true);
  api.banner(
    banked > 0
      ? tr(`CLOCK STOPPED — ${Math.round(banked * 1.5)} DAMAGE LOCKED IN!`, `ĐỒNG HỒ DỪNG — KHÓA ${Math.round(banked * 1.5)} SÁT THƯƠNG!`)
      : tr('CLOCK STOPPED — FIRE!', 'ĐỒNG HỒ DỪNG — BẮN!'),
    'neon-glow-amber'
  );
  // Interest: half as much again, applied straight to the locked-in HP
  if (banked > 0) damage(b, api, banked * 0.5);
}

function chronosRewind(b: BossEntity, api: BossApi) {
  api.sfx('glitch');
  if (b.v.pending <= 0) {
    api.text(b.x, b.y - b.r - 16, tr('TICK.', 'TÍCH.'), '#fde68a', 14);
    return;
  }
  const back = b.v.pending;
  b.v.pending = 0;
  b.hp = Math.min(b.maxHp, b.hp + back);
  b.v.rewindFx = 1.2;
  api.flash(CLOCK_GOLD, 0.25);
  api.shake(10);
  api.shockwave(b.x, b.y, '#fde68a', 260, 4);
  api.banner(tr(`REWIND — ${Math.round(back)} HP RESTORED`, `TUA NGƯỢC — HỒI ${Math.round(back)} HP`), 'neon-glow-pink');
  if (!b.v.rewinds++) api.comm('chronos', tr('Again. And again. And again.', 'Lại. Lại nữa. Lại mãi.'));
}

const chronos: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(56, api.W * 0.12);
    b.targetY = Math.max(170, api.H * 0.22);
    b.v.L = Math.min(api.H * 0.28, 180);
    b.v.handL = chronosHandLen(api);
    b.v.hand = 0;
    b.v.pending = 0;
    b.v.stopped = 0;
    b.v.breaks = 0;
    b.v.swingT = 0;
    b.v.rewinds = 0;
    b.v.ts = 0;
    b.v.tsWarn = 0;
    b.parts = [makePart(b.x, b.y + b.v.L, 17, 8)];
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.45;
    const stopped = b.v.stopped > 0;
    if (b.v.rewindFx > 0) b.v.rewindFx -= dt;
    b.angle += dt * (stopped ? 0 : 0.5);

    // Pendulum (frozen while the clock is stopped)
    if (!stopped) b.v.swingT += dt;
    const bob = b.parts[0];
    const sw = Math.sin(b.v.swingT * (rage ? 2.1 : 1.6)) * 1.05;
    bob.x = b.x + Math.sin(sw) * b.v.L;
    bob.y = b.y + Math.cos(sw) * b.v.L;
    if (!bob.alive) {
      bob.timer -= dt;
      if (bob.timer <= 0) {
        bob.alive = true;
        bob.maxHp = bob.hp = 8 + b.v.breaks * 3;
        api.sfx('powerup');
        api.text(bob.x, bob.y - 24, tr('PENDULUM REBUILT', 'CON LẮC ĐÃ DỰNG LẠI'), '#fde68a', 14);
      }
    }

    b.status =
      b.v.ts > 0 || b.v.tsWarn > 0
        ? tr('TIME STOP — get clear before time resumes!', 'NGƯNG THỜI GIAN — tránh xa trước khi thời gian chạy lại!')
        : stopped
        ? tr(`CLOCK STOPPED ${b.v.stopped.toFixed(1)}s — every hit is permanent!`, `ĐỒNG HỒ DỪNG ${b.v.stopped.toFixed(1)}s — mọi đòn đều vĩnh viễn!`)
        : b.v.pending > 0
        ? tr(`UNBANKED ${Math.round(b.v.pending)} — break the PENDULUM before XII!`, `CHƯA KHÓA ${Math.round(b.v.pending)} — phá CON LẮC trước khi điểm XII!`)
        : tr('Hit it, then break the PENDULUM to lock the damage in', 'Đánh nó, rồi phá CON LẮC để khóa sát thương');
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.35) * api.W * 0.15;
    b.y = b.targetY + Math.sin(b.t * 0.9) * 8;

    // Minute hand: a full turn back to XII rewinds every unbanked point of damage
    if (stopped) b.v.stopped -= dt;
    else {
      b.v.hand += (TAU / (rage ? 9 : CLOCK_TURN)) * dt;
      if (b.v.hand >= TAU) {
        b.v.hand -= TAU;
        chronosRewind(b, api);
      }
    }
    const ha = -Math.PI / 2 + b.v.hand;
    const L = (b.v.handL = chronosHandLen(api));
    if (tetherTouch(api, b.x + Math.cos(ha) * b.r, b.y + Math.sin(ha) * b.r, b.x + Math.cos(ha) * L, b.y + Math.sin(ha) * L) === 'hit') {
      api.hurtPlayer();
    }

    // Time Stop: freeze every bullet, then fling them all at the pilot
    if (b.v.tsWarn > 0) {
      b.v.tsWarn -= dt;
      if (b.v.tsWarn <= 0) {
        for (const h of api.hazards) {
          if (h.type !== 'shot') continue;
          h.vx = 0;
          h.vy = 0;
          h.ay = undefined;
          frozenShots.add(h);
        }
        b.v.ts = 1.8;
        api.sfx('fever');
        api.flash('#fde68a', 0.2);
      }
    }
    if (b.v.ts > 0) {
      b.v.ts -= dt;
      if (b.v.ts <= 0) {
        for (const h of api.hazards) {
          if (!frozenShots.has(h)) continue;
          frozenShots.delete(h);
          const a = aimAt(api, h.x, h.y) + (Math.random() - 0.5) * 0.25;
          const sp = 150 + Math.random() * 40;
          h.vx = Math.cos(a) * sp;
          h.vy = Math.sin(a) * sp;
          h.angle = a;
        }
        api.sfx('dash');
        api.text(api.player.x, api.player.y - 30, tr('TIME RESUMES!', 'THỜI GIAN CHẠY LẠI!'), '#fde68a', 15);
      }
    }

    if (!api.alive || b.v.ts > 0 || b.v.tsWarn > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.5 : 1.9;
    const pattern = ['tick', 'gears', 'tick', 'timestop'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    const gold = { color: '#fde68a' };
    if (pattern === 'tick') {
      ring(api, b.x, b.y, 12, 140, ha, gold);
      if (rage) ring(api, b.x, b.y, 12, 100, ha + Math.PI / 12, gold);
    } else if (pattern === 'gears') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), 5, 0.17, 210, { color: CLOCK_GOLD });
      if (rage) api.laser(api.player.x);
    } else {
      ring(api, b.x, b.y, rage ? 22 : 16, 160, b.t, gold);
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), 3, 0.3, 190, gold);
      b.v.tsWarn = 0.7;
      api.banner(tr('TIME STOP!', 'NGƯNG ĐỌNG THỜI GIAN!'), 'neon-glow-pink');
    }
  },
  bullet(b, api, bl) {
    const bob = b.parts[0];
    if (bob && bob.alive && dist(bl.x, bl.y, bob.x, bob.y) < bob.r + 5) {
      bob.hp -= bulletDmg(bl);
      bob.hitFlash = 0.06;
      if (bob.hp <= 0) chronosBreak(b, api);
      return 'hit';
    }
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.85) return null;
    chronosHit(b, api, bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    const bob = b.parts[0];
    if (bob && bob.alive && dist(p.x, p.y, bob.x, bob.y) < bob.r + p.radius * 0.7) {
      if (dashing) {
        strikeFx(api, tr('PENDULUM SMASHED!', 'ĐẬP VỠ CON LẮC!'), '#fde68a');
        chronosBreak(b, api);
      } else api.hurtPlayer();
    }
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) {
      api.hurtPlayer();
      return;
    }
    if (p.bossContactCd > 0) return;
    p.bossContactCd = 0.35;
    strikeFx(api, tr('GEAR STRIKE!', 'ĐÒN BÁNH RĂNG!'));
    chronosHit(b, api, 10);
    api.pullPlayer(0, 70);
  },
  emp(b, api) {
    if (b.parts[0]?.alive) chronosBreak(b, api);
    else b.v.stopped = Math.max(b.v.stopped, 2.5);
  },
};

// ---------------------------------------------------------------------------
// HYDRA — sever a head and two grow back, unless you dash through the stump
// to cauterize it. No heads left exposes the core.
// ---------------------------------------------------------------------------
const HYDRA_MAX = 6;
const HYDRA_GREEN = '#4ade80';

function hydraHead(b: BossEntity, a: number): BossPart {
  const pt = makePart(b.x, b.y + 60, 20, 12 + (b.v.gen || 0) * 3);
  pt.a = a;
  return pt;
}

/** Fans the necks evenly across the lower arc, keeping their left-to-right order. */
function hydraSpread(b: BossEntity) {
  b.parts.sort((p, q) => (q.a || 0) - (p.a || 0));
  const n = b.parts.length;
  b.parts.forEach((pt, i) => (pt.a = Math.PI * 0.08 + ((i + 0.5) / n) * Math.PI * 0.84));
}

function hydraGrow(b: BossEntity, n: number) {
  for (let i = 0; i < n; i++) b.parts.push(hydraHead(b, Math.PI / 2));
  hydraSpread(b);
}

function hydraSever(b: BossEntity, api: BossApi, pt: BossPart) {
  pt.alive = false;
  pt.real = false;
  pt.hp = 0;
  pt.timer = api.hard ? 3 : 3.6;
  api.sfx('boom');
  api.shake(10);
  api.shockwave(pt.x, pt.y, HYDRA_GREEN, 120, 4);
  api.particles(pt.x, pt.y, '#86efac', 28, 300, true);
  api.text(pt.x, pt.y - 26, tr('SEVERED — DASH THE STUMP!', 'ĐỨT ĐẦU — LƯỚT QUA GỐC!'), '#fde047', 15);
  if (!b.v.toldStump) {
    b.v.toldStump = 1;
    api.comm('iris', tr('Quick, dash through the stump before it splits!', 'Nhanh, lướt xuyên gốc cổ trước khi nó tách đôi!'));
  }
}

function hydraCauterize(b: BossEntity, api: BossApi, pt: BossPart) {
  b.parts.splice(b.parts.indexOf(pt), 1);
  api.sfx('parry');
  api.shake(12);
  api.shockwave(pt.x, pt.y, '#fb923c', 140, 4);
  api.particles(pt.x, pt.y, '#fdba74', 26, 280, true);
  api.text(pt.x, pt.y - 24, tr('CAUTERIZED!', 'ĐÃ ĐỐT KÍN!'), '#fdba74', 17);
  if (b.parts.length === 0) {
    b.v.exposed = api.hard ? 6 : 7;
    api.sfx('fever');
    api.flash(HYDRA_GREEN, 0.35);
    api.slowmo(0.45, 0.3);
    api.banner(tr('NO HEADS LEFT — CORE EXPOSED!', 'HẾT ĐẦU — LÕI LỘ RA!'), 'neon-glow-amber');
  }
  damage(b, api, b.maxHp * 0.05);
}

const hydra: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(48, api.W * 0.11);
    b.targetY = Math.max(170, api.H * 0.22);
    b.v.neck = Math.min(api.H * 0.2, 130);
    b.v.gen = 0;
    b.v.exposed = 0;
    hydraGrow(b, 3);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    b.angle += dt;
    const p = api.player;
    if (ready) {
      b.t += dt;
      b.x = api.W / 2 + Math.sin(b.t * 0.3) * api.W * 0.16;
      b.y = b.targetY + Math.sin(b.t * 0.8) * 10;
    }

    const neck = b.v.neck;
    const regrow: BossPart[] = [];
    b.parts.forEach((pt, i) => {
      const a = pt.a || Math.PI / 2;
      const ax = Math.max(26, Math.min(api.W - 26, b.x + Math.cos(a) * neck * 1.15 + Math.sin(b.t * 1.3 + i * 1.7) * 10));
      const ay = b.y + Math.sin(a) * neck + Math.cos(b.t * 1.7 + i) * 8;
      if (!ready) {
        pt.x = ax;
        pt.y = ay;
        return;
      }
      if (!pt.alive) {
        pt.x += (ax - pt.x) * Math.min(1, 4 * dt);
        pt.y += (ay - pt.y) * Math.min(1, 4 * dt);
        pt.timer -= dt;
        if (pt.timer <= 0) regrow.push(pt);
        return;
      }
      if (pt.real) {
        // Bite: rear back, snap at the locked spot, recoil
        pt.timer += dt;
        let tx = ax;
        let ty = ay;
        let rate = 6;
        if (pt.timer < 0.6) {
          tx = b.x + (ax - b.x) * 0.75;
          ty = b.y + (ay - b.y) * 0.75;
        } else if (pt.timer < 0.95) {
          const reach = neck * 3;
          const d = dist(pt.tx, pt.ty, b.x, b.y);
          const k = d > reach ? reach / d : 1;
          tx = b.x + (pt.tx - b.x) * k;
          ty = b.y + (pt.ty - b.y) * k;
          rate = 14;
        } else if (pt.timer > 1.5) pt.real = false;
        pt.x += (tx - pt.x) * Math.min(1, rate * dt);
        pt.y += (ty - pt.y) * Math.min(1, rate * dt);
        return;
      }
      pt.x += (ax - pt.x) * Math.min(1, 5 * dt);
      pt.y += (ay - pt.y) * Math.min(1, 5 * dt);
    });

    // Uncauterized stumps split into two heads
    for (const st of regrow) {
      b.parts.splice(b.parts.indexOf(st), 1);
      const n = Math.min(2, HYDRA_MAX - b.parts.length);
      for (let k = 0; k < n; k++) {
        const h = hydraHead(b, (st.a || 0) + (k ? 0.2 : -0.2));
        h.x = st.x;
        h.y = st.y;
        b.parts.push(h);
      }
      hydraSpread(b);
      api.sfx('boss_alarm');
      api.shockwave(st.x, st.y, HYDRA_GREEN, 120, 3);
      api.banner(n > 1 ? tr('TWO HEADS GROW BACK!', 'MỌC LẠI HAI ĐẦU!') : tr('THE HEAD GROWS BACK!', 'ĐẦU ĐÃ MỌC LẠI!'), 'neon-glow-pink');
    }

    // Core exposure window, then a fresh set of heads
    if (b.v.exposed > 0) {
      b.v.exposed -= dt;
      if (b.v.exposed <= 0 && b.hp > 0) {
        b.v.gen++;
        hydraGrow(b, 3);
        api.sfx('boss_alarm');
        api.shockwave(b.x, b.y, HYDRA_GREEN, 200, 4);
        api.banner(tr('THE HYDRA REGROWS', 'HYDRA MỌC LẠI'), 'neon-glow-pink');
      }
    }

    const stumps = b.parts.filter((pt) => !pt.alive);
    const heads = b.parts.filter((pt) => pt.alive);
    b.status =
      b.v.exposed > 0
        ? tr(`CORE EXPOSED ${b.v.exposed.toFixed(1)}s — FIRE!`, `LÕI LỘ RA ${b.v.exposed.toFixed(1)}s — BẮN!`)
        : stumps.length
        ? tr(
            `STUMP SPLITS IN ${Math.max(0, Math.min(...stumps.map((s) => s.timer))).toFixed(1)}s — DASH THROUGH IT!`,
            `GỐC TÁCH ĐÔI SAU ${Math.max(0, Math.min(...stumps.map((s) => s.timer))).toFixed(1)}s — LƯỚT XUYÊN QUA!`
          )
        : tr(`${heads.length} heads — shoot one off, then dash the stump`, `${heads.length} đầu — bắn rụng một đầu, rồi lướt qua gốc`);
    if (!ready || !api.alive) return;

    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    if (b.v.exposed > 0) {
      b.attackTimer = 1.7;
      api.sfx('enemy_shot');
      ring(api, b.x, b.y, 14, 125, b.t, { color: '#86efac' });
      return;
    }
    b.attackTimer = rage ? 1.05 : 1.4;
    const idle = heads.filter((h) => !h.real);
    if (!idle.length) return;
    const head = idle[b.attackIndex % idle.length];
    const pattern = ['spit', 'spit', 'bite', 'acid'][b.attackIndex++ % 4];
    if (pattern === 'spit') {
      api.sfx('enemy_shot');
      fan(api, head.x, head.y, aimAt(api, head.x, head.y), rage ? 5 : 3, 0.18, 220, { color: '#86efac' });
    } else if (pattern === 'bite') {
      head.real = true;
      head.timer = 0;
      head.tx = p.x;
      head.ty = p.y;
      api.sfx('laser_warn');
    } else {
      api.sfx('enemy_shot');
      for (const h of idle) {
        for (let k = 0; k < 2; k++) {
          api.shot(h.x, h.y, aimAt(api, h.x, h.y) + (Math.random() - 0.5) * 0.7, 170 + Math.random() * 80, { color: '#bef264', ay: 110, r: 5 });
        }
      }
    }
  },
  bullet(b, api, bl) {
    for (const pt of b.parts) {
      if (!pt.alive || dist(bl.x, bl.y, pt.x, pt.y) >= pt.r + 4) continue;
      pt.hp -= bulletDmg(bl);
      pt.hitFlash = 0.06;
      if (pt.hp <= 0) hydraSever(b, api, pt);
      return 'hit';
    }
    const d = dist(bl.x, bl.y, b.x, b.y);
    if (d >= b.r * 0.9) return null;
    if (b.v.exposed > 0) {
      damage(b, api, 1.25 * bulletDmg(bl));
      return 'hit';
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    for (const pt of [...b.parts]) {
      const d = dist(p.x, p.y, pt.x, pt.y);
      if (!pt.alive) {
        if (dashing && d < pt.r + p.radius + 12) hydraCauterize(b, api, pt);
        continue;
      }
      if (d >= pt.r * 0.85 + p.radius * 0.7) continue;
      if (!dashing) {
        api.hurtPlayer();
      } else if (p.bossContactCd <= 0) {
        p.bossContactCd = 0.3;
        strikeFx(api, tr('HEAD STRIKE!', 'ĐÒN VÀO ĐẦU!'), '#86efac');
        pt.hp -= 6;
        pt.hitFlash = 0.1;
        if (pt.hp <= 0) hydraSever(b, api, pt);
      }
    }
    if (b.hp <= 0 || dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.exposed > 0) bodyContact(b, api, true, b.x, b.y, b.r, 12, tr('ROOT STRIKE!', 'ĐÒN VÀO GỐC!'));
    else bounce(api, b.x, b.y);
  },
  emp(b, api) {
    const stumps = b.parts.filter((pt) => !pt.alive);
    if (!stumps.length) {
      damage(b, api, b.maxHp * 0.05);
      return;
    }
    for (const st of stumps) if (b.hp > 0) hydraCauterize(b, api, st);
  },
};

// ---------------------------------------------------------------------------
// LEVIATHAN — the Archive's garbage collector. An armoured serpent: shoot the
// glowing tail, dash through the body to sever it, then finish the head.
// ---------------------------------------------------------------------------
const LEVI_SEGS = 16;
const LEVI_GAP = 30;
const LEVI_TEAL = '#2dd4bf';
const LEVI_MODES = ['roam', 'charge', 'roam', 'coil'] as const;
const LEVI_MODE_TIME = { roam: 4.5, charge: 2.0, coil: 5.0 };

function leviMode(b: BossEntity) {
  return LEVI_MODES[(b.v.mode || 0) % LEVI_MODES.length];
}

function leviNextMode(b: BossEntity, api: BossApi) {
  b.v.mode++;
  b.v.modeT = 0;
  b.v.retarget = 0;
  const m = leviMode(b);
  if (m === 'coil') {
    b.v.ca = aimAt(api, b.x, b.y) + Math.PI;
    api.sfx('boss_alarm');
    api.banner(tr('COIL! — DASH THROUGH ITS BODY!', 'BỊ QUẤN! — LƯỚT XUYÊN THÂN NÓ!'), 'neon-glow-pink');
  } else if (m === 'charge') {
    api.sfx('laser_warn');
  }
}

/** Removes `count` segments starting at `from` and charges their worth to the boss. */
function leviDrop(b: BossEntity, api: BossApi, from: number, count: number, sever: boolean) {
  const lost = b.parts.splice(from, count);
  if (!lost.length) return;
  for (const s of lost) {
    api.particles(s.x, s.y, LEVI_TEAL, 14, 260, true);
    api.shockwave(s.x, s.y, '#99f6e4', 70, 3);
  }
  api.sfx('boom');
  api.shake(sever ? 18 : 10);
  const last = lost[lost.length - 1];
  api.text(
    last.x,
    last.y - 24,
    sever ? tr(`SEVERED x${lost.length}!`, `CHẶT ĐỨT x${lost.length}!`) : tr('TAIL DESTROYED', 'PHÁ ĐUÔI'),
    sever ? '#fde047' : '#99f6e4',
    sever ? 18 : 14
  );
  const per = b.phase === 2 ? b.v.segVal * 0.4 : b.v.segVal * (sever ? 1.2 : 1);
  damage(b, api, per * lost.length);
  if (b.phase === 1 && b.parts.length <= 3 && b.hp > 0) {
    b.phase = 2;
    b.v.floor = 0;
    b.hp = Math.min(b.hp, b.maxHp * 0.3);
    api.sfx('boss_alarm');
    api.flash(LEVI_TEAL, 0.4);
    api.shockwave(b.x, b.y, '#ffffff', 300, 6);
    api.banner(tr('HEAD EXPOSED — FINAL COLLECTION', 'ĐẦU LỘ RA — LẦN THU GOM CUỐI'), 'neon-glow-amber');
    api.comm('leviathan', tr('YOU ARE... UNREFERENCED... COLLECT... COLLECT!', 'NGƯƠI... KHÔNG ĐƯỢC THAM CHIẾU... THU GOM... THU GOM!'));
  }
}

/** Segments trail the head like a chain. */
function leviFollow(b: BossEntity) {
  let lx = b.x;
  let ly = b.y;
  for (const s of b.parts) {
    const d = dist(s.x, s.y, lx, ly);
    if (d > LEVI_GAP) {
      const k = (d - LEVI_GAP) / d;
      s.x += (lx - s.x) * k;
      s.y += (ly - s.y) * k;
    }
    lx = s.x;
    ly = s.y;
  }
}

const leviathan: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(38, api.W * 0.085);
    b.v.segVal = (b.maxHp * 0.7) / LEVI_SEGS;
    b.v.floor = b.maxHp * 0.3;
    b.v.hd = Math.PI / 2;
    b.v.mode = 0;
    b.v.modeT = 0;
    b.v.retarget = 0;
    b.parts = [];
    for (let i = 0; i < LEVI_SEGS; i++) {
      b.parts.push(makePart(b.x, b.y - (i + 1) * LEVI_GAP, 23 - (i / (LEVI_SEGS - 1)) * 9, 9));
    }
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    if (!ready) {
      leviFollow(b);
      b.status = '';
      return;
    }
    const { W, H } = api;
    const p = api.player;
    const phase2 = b.phase === 2;
    b.t += dt;
    b.v.modeT += dt;
    const mode = leviMode(b);
    if (b.v.modeT > LEVI_MODE_TIME[mode]) leviNextMode(b, api);

    let speed = phase2 ? 255 : 205;
    let turn = 2.6;
    let tx = b.v.tx;
    let ty = b.v.ty;
    if (mode === 'roam') {
      b.v.retarget -= dt;
      if (b.v.retarget <= 0 || dist(b.x, b.y, tx, ty) < 50) {
        b.v.retarget = 2.6;
        b.v.tx = tx = 60 + Math.random() * (W - 120);
        b.v.ty = ty = H * 0.12 + Math.random() * H * 0.5;
      }
    } else if (mode === 'charge') {
      if (b.v.modeT < 0.9) {
        speed = 70;
        turn = 4;
        tx = p.x;
        ty = p.y;
      } else {
        speed = phase2 ? 720 : 640;
        turn = 0;
      }
    } else {
      b.v.ca += dt * 2.1;
      const R = Math.max(90, 230 - b.v.modeT * 30);
      tx = p.x + Math.cos(b.v.ca) * R;
      ty = p.y + Math.sin(b.v.ca) * R;
      speed = 320;
      turn = 5.5;
    }
    if (turn > 0) {
      const diff = angDiff(Math.atan2(ty - b.y, tx - b.x), b.v.hd);
      b.v.hd += Math.max(-turn * dt, Math.min(turn * dt, diff));
    }
    b.x += Math.cos(b.v.hd) * speed * dt;
    b.y += Math.sin(b.v.hd) * speed * dt;
    // A charge that runs off the screen ends early and swings back in
    if (b.x < -70 || b.x > W + 70 || b.y < -70 || b.y > H + 70) {
      if (mode === 'charge' && b.v.modeT >= 0.9) leviNextMode(b, api);
      b.v.hd += angDiff(Math.atan2(H * 0.4 - b.y, W / 2 - b.x), b.v.hd) * Math.min(1, 6 * dt);
    }
    leviFollow(b);

    b.status = phase2
      ? tr('HEAD EXPOSED — FINISH IT!', 'ĐẦU LỘ RA — KẾT LIỄU NÓ!')
      : mode === 'coil'
      ? tr('COILED! Dash through its body to sever it!', 'BỊ QUẤN! Lướt xuyên thân để chặt đứt!')
      : mode === 'charge' && b.v.modeT < 0.9
      ? tr('CHARGE INCOMING — get off the line!', 'SẮP LAO TỚI — tránh khỏi đường lao!')
      : tr(`${b.parts.length} segments — shoot the glowing TAIL, dash to SEVER`, `${b.parts.length} đốt — bắn ĐUÔI phát sáng, lướt để CHẶT`);

    if (!api.alive || mode === 'coil' || (mode === 'charge' && b.v.modeT >= 0.9)) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = phase2 ? 1.3 : 1.7;
    const pattern = (phase2 ? ['maw', 'garbage', 'scales'] : ['scales', 'maw', 'scales'])[b.attackIndex++ % 3];
    api.sfx('enemy_shot');
    if (pattern === 'scales') {
      for (let i = 1; i < b.parts.length; i += 3) {
        const s = b.parts[i];
        api.shot(s.x, s.y, aimAt(api, s.x, s.y), 160, { color: '#5eead4', r: 5 });
      }
    } else if (pattern === 'maw') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), phase2 ? 7 : 5, 0.17, 230, { color: '#99f6e4' });
    } else {
      for (let i = 0; i < 12; i++) {
        api.shot(30 + Math.random() * (W - 60), -10, Math.PI / 2 + (Math.random() - 0.5) * 0.3, 150 + Math.random() * 60, { color: '#a3e635', glitch: true });
      }
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) < b.r * 0.9) {
      if (b.phase !== 2) return 'block';
      damage(b, api, bulletDmg(bl));
      return 'hit';
    }
    const n = b.parts.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = b.parts[i];
      if (dist(bl.x, bl.y, s.x, s.y) >= s.r + 3) continue;
      if (i < n - 1) return 'block';
      s.hp -= bulletDmg(bl);
      s.hitFlash = 0.06;
      if (s.hp <= 0) leviDrop(b, api, i, 1, false);
      return 'hit';
    }
    return null;
  },
  contact(b, api, dashing) {
    const p = api.player;
    for (let i = 0; i < b.parts.length; i++) {
      const s = b.parts[i];
      if (dist(p.x, p.y, s.x, s.y) >= s.r * 0.85 + p.radius * 0.7) continue;
      if (!dashing) {
        api.hurtPlayer();
        return;
      }
      if (p.bossContactCd > 0) return;
      p.bossContactCd = 0.5;
      strikeFx(api, tr('SEVER!', 'CHẶT!'), '#5eead4');
      api.slowmo(0.4, 0.3);
      leviDrop(b, api, i, 5, true);
      // Cutting it loose breaks the coil
      if (leviMode(b) === 'coil') leviNextMode(b, api);
      return;
    }
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.phase === 2) bodyContact(b, api, true, b.x, b.y, b.r, 12, tr('JAW BREAKER!', 'ĐÒN VỠ HÀM!'));
    else bounce(api, b.x, b.y);
  },
  emp(b, api) {
    if (b.phase === 2) damage(b, api, b.maxHp * 0.05);
    else leviDrop(b, api, Math.max(0, b.parts.length - 2), 2, false);
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
  mimic,
  dynamo,
  chronos,
  hydra,
  leviathan,
};

/** Shared with the renderer. */
export { TWIN_NAMES, MIRROR_ABSORB, polColor, leviMode };
