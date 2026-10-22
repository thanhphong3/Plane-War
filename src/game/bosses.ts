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
  /** Arcade time ran out and it is leaving: undo anything that only its update keeps in check. */
  retreat?(b: BossEntity, api: BossApi): void;
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
  retreat(b, api) {
    // Nothing will un-freeze a Time Stop once it's gone: let those shots fall away
    for (const h of api.hazards) {
      if (!frozenShots.has(h)) continue;
      frozenShots.delete(h);
      h.vy = 150;
    }
    b.v.ts = 0;
    b.v.tsWarn = 0;
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

// ===========================================================================
// ACT III — THE OUTER NET
// ===========================================================================

// ---------------------------------------------------------------------------
// BEACON — a lighthouse in the dark. Caught in its beam you are blind and it
// is armoured; strike from the shadows.
// ---------------------------------------------------------------------------
const BEAM_HALF = 0.22;

/** Angles of the searchlight beams currently lit (none while blacked out). */
function beaconBeams(b: BossEntity): number[] {
  if (b.v.dark > 0) return [];
  const beams = [b.v.beam];
  if (b.v.twin) beams.push(b.v.beam2);
  return beams;
}

/** Is the pilot standing in the light? A flare lights the whole sector. */
function beaconLit(b: BossEntity, api: BossApi): boolean {
  if (b.v.flare > 0) return true;
  const a = aimAt(api, b.x, b.y);
  const half = BEAM_HALF + (b.v.twin ? 0.04 : 0);
  return beaconBeams(b).some((beam) => Math.abs(angDiff(a, beam)) < half);
}

const beacon: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(46, api.W * 0.1);
    b.targetY = Math.max(180, api.H * 0.21);
    b.v.beam = Math.PI / 2;
    b.v.beam2 = Math.PI / 2;
    b.v.sweepT = 0;
    b.v.spot = 0;
    b.v.lock = 0;
    b.v.flare = 0;
    b.v.dark = 0;
    b.v.twin = 0;
    b.v.lit = 0;
    b.v.blindText = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const p = api.player;
    b.angle += dt * 2;
    if (b.v.flare > 0) b.v.flare -= dt;
    if (b.v.dark > 0) b.v.dark -= dt;
    if (b.v.blindText > 0) b.v.blindText -= dt;
    if (rage && !b.v.twin) {
      b.v.twin = 1;
      api.banner(tr('SECOND LAMP LIT!', 'NGỌN ĐÈN THỨ HAI ĐÃ SÁNG!'), 'neon-glow-pink');
    }

    // Sweep, or track the pilot once locked on
    if (b.v.lock > 0) {
      const d = angDiff(aimAt(api, b.x, b.y), b.v.beam);
      b.v.beam += Math.max(-3 * dt, Math.min(3 * dt, d));
    } else {
      b.v.sweepT += dt * (rage ? 0.95 : 0.75);
      b.v.beam = Math.PI / 2 + Math.sin(b.v.sweepT) * 1.15;
    }
    b.v.beam2 = Math.PI / 2 + Math.sin(b.v.sweepT + Math.PI) * 1.15;
    const lit = ready && api.alive && beaconLit(b, api);
    b.v.lit = lit ? 1 : 0;

    b.status =
      b.v.dark > 0
        ? tr(`BLACKOUT ${b.v.dark.toFixed(1)}s — strike now!`, `MẤT ĐIỆN ${b.v.dark.toFixed(1)}s — tấn công ngay!`)
        : b.v.lock > 0
        ? tr('LOCKED ON — break line of sight!', 'BỊ KHÓA MỤC TIÊU — thoát khỏi tầm nhìn!')
        : b.v.flare > 0
        ? tr('FLARE — nowhere to hide!', 'PHÁO SÁNG — không còn chỗ trốn!')
        : lit
        ? tr(`SPOTTED ${Math.floor(b.v.spot * 100)}% — get into the dark!`, `BỊ PHÁT HIỆN ${Math.floor(b.v.spot * 100)}% — lẩn vào bóng tối!`)
        : tr('In the shadows — FIRE! (sneak damage x1.6)', 'Trong bóng tối — BẮN! (sát thương lén x1.6)');
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.25) * api.W * 0.18;
    b.y = b.targetY + Math.sin(b.t * 0.8) * 6;

    // Being seen fills the alarm; a full alarm locks the lamp onto you
    if (b.v.lock > 0) {
      b.v.lock -= dt;
      b.v.snipeT -= dt;
      if (b.v.snipeT <= 0 && api.alive) {
        b.v.snipeT = 0.55;
        api.sfx('enemy_shot');
        fan(api, b.x, b.y, aimAt(api, b.x, b.y), 3, 0.06, 380, { color: '#fef08a', r: 5 });
      }
      if (b.v.lock <= 0) b.v.spot = 0;
    } else if (lit && b.v.flare <= 0) {
      b.v.spot = Math.min(1, b.v.spot + dt * (rage ? 0.75 : 0.6));
      if (b.v.spot >= 1) {
        b.v.lock = 2.6;
        b.v.snipeT = 0.5;
        api.sfx('boss_alarm');
        api.banner(tr('YOU’VE BEEN SPOTTED!', 'BẠN ĐÃ BỊ PHÁT HIỆN!'), 'neon-glow-pink');
        api.laser(p.x, 'v', 0.9);
      }
    } else {
      b.v.spot = Math.max(0, b.v.spot - dt * 0.35);
    }

    if (!api.alive || b.v.lock > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.4 : 1.8;
    const pattern = ['beam', 'rain', 'beam', 'flare'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    if (pattern === 'beam') {
      // Shots ride down the beam itself
      for (const beam of beaconBeams(b)) fan(api, b.x, b.y, beam, rage ? 4 : 3, 0.12, 230, { color: '#fde68a' });
    } else if (pattern === 'rain') {
      for (let i = 0; i < 9; i++) api.shot(30 + Math.random() * (api.W - 60), -10, Math.PI / 2, 140 + Math.random() * 60, { color: '#94a3b8', ghost: true });
    } else {
      b.v.flare = 2.2;
      api.flash('#fef9c3', 0.3);
      ring(api, b.x, b.y, rage ? 20 : 14, 150, b.t, { color: '#fef08a' });
      api.banner(tr('FLARE!', 'PHÁO SÁNG!'), 'neon-glow-amber');
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.85) return null;
    if (b.v.lit) {
      if (b.v.blindText <= 0) {
        b.v.blindText = 1.2;
        api.text(bl.x, bl.y - 10, tr('IT SEES YOU — HIDE!', 'NÓ THẤY BẠN — TRỐN ĐI!'), '#fef08a', 13);
      }
      return 'block';
    }
    damage(b, api, 1.6 * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (!b.v.lit) bodyContact(b, api, true, b.x, b.y, b.r, 12, tr('AMBUSH!', 'PHỤC KÍCH!'));
    else bounce(api, b.x, b.y, tr('DAZZLED!', 'LÓA MẮT!'));
  },
  emp(b, api) {
    b.v.dark = 4;
    b.v.lock = 0;
    b.v.spot = 0;
    api.banner(tr('LAMP SHORTED — BLACKOUT!', 'ĐÈN CHẬP — MẤT ĐIỆN!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// CIPHER — a memory lock. Watch the nodes light up, then shoot them in the
// same order to decrypt the core.
// ---------------------------------------------------------------------------
const CIPHER_COLORS = ['#22d3ee', '#f472b6', '#fbbf24', '#4ade80'];
const CIPHER_GLYPHS = ['▲', '■', '●', '◆'];
const CIPHER_STEP = 0.75;
/** Hits a node needs, in quick succession, to register (so sweeping past doesn't count). */
const CIPHER_PRESS = 6;

/** Random node→slot order for the row of nodes. */
function cipherShuffle(b: BossEntity) {
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  order.forEach((slot, k) => (b.v[`p${k}`] = slot));
}

function cipherNewSequence(b: BossEntity) {
  for (let i = 0; i < 6; i++) {
    let k = Math.floor(Math.random() * 4);
    if (i > 0 && k === b.v[`s${i - 1}`]) k = (k + 1 + Math.floor(Math.random() * 3)) % 4;
    b.v[`s${i}`] = k;
  }
  b.v.state = 0;
  b.v.showT = -0.6;
  b.v.idx = 0;
  for (const pt of b.parts) pt.hp = 0;
}

function cipherWrong(b: BossEntity, api: BossApi, node: BossPart) {
  api.sfx('glitch');
  api.shake(10);
  api.flash('#f43f5e', 0.25);
  api.text(node.x, node.y - 24, tr('ACCESS DENIED', 'TỪ CHỐI TRUY CẬP'), '#f43f5e', 16);
  for (const pt of b.parts) ring(api, pt.x, pt.y, 8, 140, b.t, { color: '#f43f5e' });
  api.laser(api.player.x, 'v', 1);
  cipherNewSequence(b);
  b.v.showT = -1.4;
}

function cipherPress(b: BossEntity, api: BossApi, k: number) {
  const node = b.parts[k];
  for (const pt of b.parts) pt.hp = 0;
  if (k !== b.v[`s${b.v.idx}`]) {
    cipherWrong(b, api, node);
    return;
  }
  b.v.idx++;
  node.hitFlash = 0.35;
  api.sfx('powerup');
  api.shockwave(node.x, node.y, CIPHER_COLORS[k], 70, 3);
  api.text(node.x, node.y - 24, `${CIPHER_GLYPHS[k]} ${b.v.idx}/${b.v.len}`, CIPHER_COLORS[k], 16);
  if (b.v.idx >= b.v.len) {
    b.v.state = 2;
    b.v.open = api.hard ? 6 : 7;
    api.sfx('fever');
    api.flash('#a78bfa', 0.35);
    api.slowmo(0.45, 0.3);
    api.shockwave(b.x, b.y, '#ffffff', 260, 6);
    api.banner(tr('DECRYPTED — CORE OPEN!', 'ĐÃ GIẢI MÃ — LÕI ĐÃ MỞ!'), 'neon-glow-amber');
  }
}

const cipher: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(44, api.W * 0.1);
    b.targetY = Math.max(190, api.H * 0.24);
    b.v.len = 3;
    b.v.slideT = 0;
    cipherShuffle(b);
    b.v.open = 0;
    b.parts = CIPHER_COLORS.map(() => makePart(b.x, b.y, 17, 0));
    cipherNewSequence(b);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    b.angle += dt * 0.8;
    // A row of nodes under the core, so every node can be shot from below
    b.parts.forEach((pt, k) => {
      const tx = api.W * (0.2 + 0.2 * b.v[`p${k}`]) + Math.sin(b.t * 1.2 + k) * 8;
      const ty = b.y + b.r + 58 + Math.sin(b.t * 1.7 + k * 2) * 6;
      const f = Math.min(1, 6 * dt);
      pt.x += (tx - pt.x) * f;
      pt.y += (ty - pt.y) * f;
      // A node's charge drains if you stop firing at it
      pt.hp = Math.max(0, pt.hp - dt * 5);
    });

    if (b.v.state === 0) {
      b.status = tr('WATCH THE SEQUENCE...', 'GHI NHỚ CHUỖI...');
    } else if (b.v.state === 1) {
      b.status = tr(
        `INPUT ${b.v.idx}/${b.v.len} — shoot the nodes in order (${Math.max(0, b.v.inputT).toFixed(1)}s)`,
        `NHẬP ${b.v.idx}/${b.v.len} — bắn các nút theo đúng thứ tự (${Math.max(0, b.v.inputT).toFixed(1)}s)`
      );
    } else {
      b.status = tr(`CORE OPEN ${b.v.open.toFixed(1)}s — FIRE!`, `LÕI MỞ ${b.v.open.toFixed(1)}s — BẮN!`);
    }
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.3) * api.W * 0.12;
    b.y = b.targetY + Math.sin(b.t * 0.9) * 8;

    if (b.v.state === 0) {
      b.v.showT += dt;
      const step = Math.floor(b.v.showT / CIPHER_STEP);
      // Which node is lit right now (-1 between flashes)
      b.v.showing = b.v.showT >= 0 && step < b.v.len && b.v.showT - step * CIPHER_STEP < CIPHER_STEP * 0.7 ? b.v[`s${step}`] : -1;
      if (b.v.showing >= 0 && step !== b.v.lastStep) {
        b.v.lastStep = step;
        api.sfx('comm');
      }
      if (step >= b.v.len) {
        b.v.state = 1;
        b.v.idx = 0;
        b.v.lastStep = -1;
        b.v.inputT = 8 + b.v.len * 1.6;
        api.sfx('powerup');
      }
    } else if (b.v.state === 1) {
      b.v.showing = -1;
      b.v.inputT -= dt;
      if (b.v.inputT <= 0) cipherWrong(b, api, b.parts[b.v[`s${b.v.idx}`]]);
      // Enraged, the row slides along while you type
      b.v.slideT += dt;
      if (rage && b.v.slideT > 3.5) {
        b.v.slideT = 0;
        for (let k = 0; k < 4; k++) b.v[`p${k}`] = (b.v[`p${k}`] + 1) % 4;
        api.sfx('glitch');
      }
    } else {
      b.v.open -= dt;
      if (b.v.open <= 0) {
        b.v.len = Math.min(rage ? 5 : 4, b.v.len + 1);
        cipherShuffle(b);
        cipherNewSequence(b);
        api.sfx('boss_alarm');
        api.banner(tr(`RE-ENCRYPTING — ${b.v.len} SYMBOLS`, `MÃ HÓA LẠI — ${b.v.len} KÝ HIỆU`), 'neon-glow-pink');
      }
    }

    if (!api.alive) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    const watching = b.v.state === 0;
    b.attackTimer = watching ? 2.2 : rage ? 1.3 : 1.7;
    api.sfx('enemy_shot');
    const col = { color: '#c4b5fd' };
    if (watching) {
      // Gentle while you memorise
      ring(api, b.x, b.y, 10, 110, b.t, col);
    } else if (b.attackIndex++ % 2) {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 220, col);
    } else {
      for (const pt of b.parts) api.shot(pt.x, pt.y, aimAt(api, pt.x, pt.y), 190, { color: CIPHER_COLORS[b.parts.indexOf(pt)] });
    }
  },
  bullet(b, api, bl) {
    // Nodes only catch fire while you're typing the code; otherwise shots pass through to the core
    for (let k = 0; k < b.parts.length && b.v.state === 1; k++) {
      const pt = b.parts[k];
      if (dist(bl.x, bl.y, pt.x, pt.y) >= pt.r + 5) continue;
      pt.hp += 1;
      pt.hitFlash = 0.05;
      if (pt.hp >= CIPHER_PRESS) cipherPress(b, api, k);
      return 'block';
    }
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    if (b.v.state !== 2) return 'block';
    damage(b, api, 2 * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.state === 2) bodyContact(b, api, true, b.x, b.y, b.r, 12, tr('BRUTE FORCE!', 'TẤN CÔNG VÉT CẠN!'));
    else bounce(api, b.x, b.y, tr('ENCRYPTED!', 'ĐÃ MÃ HÓA!'));
  },
  emp(b, api) {
    // Brute-forces the next symbol
    if (b.v.state === 1) cipherPress(b, api, b.v[`s${b.v.idx}`]);
    else if (b.v.state === 2) damage(b, api, b.maxHp * 0.05);
  },
};

// ---------------------------------------------------------------------------
// METRONOME — bullets barely scratch it. Dash into it exactly on the beat.
// ---------------------------------------------------------------------------
/** Half-width of the "on the beat" window, in seconds. */
const BEAT_WINDOW = 0.15;

function beatLen(b: BossEntity) {
  return b.hp / b.maxHp < 0.5 ? 0.5 : 0.6;
}

function onBeat(b: BossEntity) {
  const L = beatLen(b);
  return b.v.beatT < BEAT_WINDOW || b.v.beatT > L - BEAT_WINDOW;
}

const metronome: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(46, api.W * 0.105);
    b.targetY = Math.max(220, api.H * 0.3);
    b.v.beatT = 0;
    b.v.beat = 0;
    b.v.combo = 0;
    b.v.lane = 1;
    b.v.pulse = 0;
    b.v.chipText = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    if (b.v.pulse > 0) b.v.pulse -= dt;
    if (b.v.chipText > 0) b.v.chipText -= dt;
    b.status = tr(
      `Rhythm x${b.v.combo} — DASH into it ON THE BEAT`,
      `Nhịp x${b.v.combo} — LƯỚT húc vào nó ĐÚNG NHỊP`
    );
    if (!ready) return;
    b.t += dt;
    const L = beatLen(b);
    b.v.beatT += dt;
    const lanes = [0.25, 0.5, 0.75];
    const tx = api.W * lanes[b.v.lane];
    b.x += (tx - b.x) * Math.min(1, 6 * dt);
    b.y = b.targetY - Math.max(0, b.v.pulse) * 30;
    if (b.v.beatT < L) return;

    // ---- On the beat ----
    b.v.beatT -= L;
    b.v.beat++;
    b.v.pulse = 0.12;
    b.angle += Math.PI / 4;
    api.sfx('hit');
    const bar = b.v.beat % 4;
    if (bar === 0) {
      // Downbeat: hop to a new lane
      b.v.lane = (b.v.lane + 1 + Math.floor(Math.random() * 2)) % 3;
    }
    if (!api.alive) return;
    const rage = b.hp / b.maxHp < 0.5;
    const notes = { color: '#f0abfc' };
    if (bar === 0) ring(api, b.x, b.y, rage ? 20 : 16, 150, b.v.beat * 0.2, notes);
    else if (bar === 1) fan(api, b.x, b.y, aimAt(api, b.x, b.y), 3, 0.2, 230, notes);
    else if (bar === 2) ring(api, b.x, b.y, rage ? 14 : 10, 120, b.v.beat * 0.2 + 0.3, { color: '#c4b5fd' });
    else {
      api.laser(api.player.x, 'v', L * 2);
      if (rage) fan(api, b.x, b.y, aimAt(api, b.x, b.y), 5, 0.15, 260, notes);
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.85) return null;
    damage(b, api, 0.15 * bulletDmg(bl));
    if (b.v.chipText <= 0) {
      b.v.chipText = 1.6;
      api.text(bl.x, bl.y - 10, tr('DASH ON THE BEAT!', 'LƯỚT ĐÚNG NHỊP!'), '#f0abfc', 12);
    }
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.85 + p.radius) return;
    if (!dashing) {
      api.hurtPlayer();
      return;
    }
    if (p.bossContactCd > 0) return;
    if (onBeat(b)) {
      p.bossContactCd = 0.4;
      b.v.combo = Math.min(8, b.v.combo + 1);
      strikeFx(api, tr(`PERFECT x${b.v.combo}!`, `HOÀN HẢO x${b.v.combo}!`), '#fde047');
      api.slowmo(0.5, 0.2);
      api.shockwave(b.x, b.y, '#f0abfc', 200, 5);
      damage(b, api, b.maxHp * (0.03 + b.v.combo * 0.005));
      api.pullPlayer(0, 90);
    } else {
      b.v.combo = 0;
      bounce(api, b.x, b.y, tr('OFF-BEAT!', 'LỆCH NHỊP!'));
      ring(api, b.x, b.y, 10, 170, b.t, { color: '#f43f5e' });
    }
  },
  emp(b, api) {
    damage(b, api, b.maxHp * 0.05);
    b.v.combo = Math.min(8, b.v.combo + 2);
    api.text(b.x, b.y + b.r + 14, tr('TEMPO BOOST +2', 'TĂNG NHỊP +2'), '#fde047', 15);
  },
};

// ---------------------------------------------------------------------------
// MARIONETTE — it fights through puppets. Dash through a string to free a
// puppet; a freed puppet flies home and blows up in its master's face.
// ---------------------------------------------------------------------------
const PUPPET_COLOR = '#fb7185';
/** Where a yanked puppet is lunging. */
const puppetLunge = new WeakMap<BossPart, { x: number; y: number }>();

function puppetSpawn(b: BossEntity, api: BossApi) {
  const pt = makePart(b.x, b.y, 18, 10);
  pt.a = Math.random() * TAU; // dance phase
  pt.tx = 0.15 + Math.random() * 0.7; // home column (fraction of W)
  pt.ty = 0.38 + Math.random() * 0.2; // home row (fraction of H)
  pt.timer = 0; // lunge clock
  b.parts.push(pt);
}

function puppetFree(b: BossEntity, api: BossApi, pt: BossPart) {
  if (pt.real) return;
  pt.real = true;
  pt.timer = 0;
  api.sfx('parry');
  api.slowmo(0.45, 0.25);
  api.shockwave(pt.x, pt.y, '#fde047', 120, 4);
  api.text(pt.x, pt.y - 26, tr('STRING CUT!', 'ĐỨT DÂY!'), '#fde047', 15);
  puppetTangle(b, api);
}

/** Cutting the last string tangles it (breaking puppets with bullets doesn't). */
function puppetTangle(b: BossEntity, api: BossApi) {
  if (b.v.tangled > 0 || b.parts.some((pt) => !pt.real)) return;
  b.v.tangled = api.hard ? 3.5 : 4.5;
  api.sfx('fever');
  api.banner(tr('NO STRINGS LEFT — TANGLED!', 'HẾT DÂY — BỊ RỐI!'), 'neon-glow-amber');
}

const marionette: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(44, api.W * 0.1);
    b.targetY = Math.max(180, api.H * 0.21);
    b.v.spawnT = 0;
    b.v.tangled = 0;
    for (let i = 0; i < 3; i++) puppetSpawn(b, api);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const { W, H } = api;
    const p = api.player;
    b.angle += dt;
    if (b.v.tangled > 0) b.v.tangled -= dt;
    const strung = b.parts.filter((pt) => !pt.real);
    b.status =
      b.v.tangled > 0
        ? tr(`TANGLED ${b.v.tangled.toFixed(1)}s — FIRE!`, `BỊ RỐI ${b.v.tangled.toFixed(1)}s — BẮN!`)
        : tr(`${strung.length} strings — DASH THROUGH a string to free its puppet`, `${strung.length} sợi dây — LƯỚT XUYÊN dây để giải thoát con rối`);
    if (ready) {
      b.t += dt;
      b.x = W / 2 + Math.sin(b.t * 0.4) * W * 0.2;
      b.y = b.targetY + Math.sin(b.t * 1.1) * 8;
    }

    for (let i = b.parts.length - 1; i >= 0; i--) {
      const pt = b.parts[i];
      if (!ready) {
        pt.x = b.x;
        pt.y = b.y + 40;
        continue;
      }
      if (pt.real) {
        // Freed: a short daze, then it dives into the puppeteer
        pt.timer += dt;
        if (pt.timer < 0.5) continue;
        const a = Math.atan2(b.y - pt.y, b.x - pt.x);
        pt.x += Math.cos(a) * 560 * dt;
        pt.y += Math.sin(a) * 560 * dt;
        if (dist(pt.x, pt.y, b.x, b.y) < b.r + pt.r * 0.5) {
          b.parts.splice(i, 1);
          api.sfx('boom');
          api.shake(16);
          api.flash(PUPPET_COLOR, 0.3);
          api.shockwave(b.x, b.y, '#fde047', 200, 5);
          api.particles(b.x, b.y, PUPPET_COLOR, 36, 340, true);
          api.text(b.x, b.y + b.r + 16, tr('BETRAYED!', 'BỊ PHẢN BỘI!'), '#fde047', 18);
          damage(b, api, b.maxHp * 0.09);
          if (b.hp <= 0) return;
        }
        continue;
      }
      // Strung: dance around its home spot, sometimes yanked at the pilot
      const hx = W * (pt.tx + Math.sin(b.t * 0.9 + (pt.a || 0)) * 0.1);
      const hy = H * pt.ty + Math.cos(b.t * 1.3 + (pt.a || 0)) * 30;
      let tx = hx;
      let ty = hy;
      const lunge = puppetLunge.get(pt);
      if (pt.timer > 0) {
        pt.timer -= dt;
        if (pt.timer > 0.6 && lunge) {
          tx = lunge.x;
          ty = lunge.y;
        }
      }
      const k = Math.min(1, (pt.timer > 0.6 ? 7 : 3) * dt);
      pt.x += (tx - pt.x) * k;
      pt.y += (ty - pt.y) * k;
      // Dashing through its string cuts it
      if (api.alive && isDashing(api) && segDist(p.x, p.y, b.x, b.y + b.r * 0.6, pt.x, pt.y) < 12 + p.radius * 0.6) {
        puppetFree(b, api, pt);
      }
    }
    if (!ready) return;

    // Restring
    const max = rage ? 4 : 3;
    b.v.spawnT -= dt;
    if (b.v.spawnT <= 0 && b.v.tangled <= 0) {
      b.v.spawnT = rage ? 3 : 3.8;
      if (b.parts.filter((pt) => !pt.real).length < max) puppetSpawn(b, api);
    }

    if (!api.alive || b.v.tangled > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.1 : 1.45;
    const live = b.parts.filter((pt) => !pt.real);
    const pattern = ['puppets', 'lunge', 'puppets', 'master'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    if (pattern === 'puppets') {
      for (const pt of live) fan(api, pt.x, pt.y, aimAt(api, pt.x, pt.y), 2, 0.16, 200, { color: PUPPET_COLOR });
    } else if (pattern === 'lunge' && live.length) {
      const pt = live[Math.floor(Math.random() * live.length)];
      pt.timer = 1.3;
      puppetLunge.set(pt, { x: p.x, y: p.y });
      api.sfx('laser_warn');
    } else {
      ring(api, b.x, b.y, rage ? 16 : 12, 140, b.t, { color: '#fda4af' });
    }
  },
  bullet(b, api, bl) {
    for (let i = 0; i < b.parts.length; i++) {
      const pt = b.parts[i];
      if (pt.real || dist(bl.x, bl.y, pt.x, pt.y) >= pt.r + 3) continue;
      pt.hp -= bulletDmg(bl);
      pt.hitFlash = 0.06;
      if (pt.hp <= 0) {
        b.parts.splice(i, 1);
        api.sfx('boom');
        api.particles(pt.x, pt.y, PUPPET_COLOR, 18, 240, true);
        api.text(pt.x, pt.y - 20, tr('PUPPET WASTED', 'PHÍ MẤT CON RỐI'), '#fda4af', 13);
        b.v.spawnT = Math.min(b.v.spawnT, 1.2);
      }
      return 'hit';
    }
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    if (b.v.tangled <= 0) return 'block';
    damage(b, api, 1.3 * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    const p = api.player;
    for (const pt of b.parts) {
      if (pt.real || dist(p.x, p.y, pt.x, pt.y) >= pt.r * 0.85 + p.radius * 0.7) continue;
      if (dashing) puppetFree(b, api, pt);
      else api.hurtPlayer();
    }
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else if (b.v.tangled > 0) bodyContact(b, api, true, b.x, b.y, b.r, 12, tr('CURTAIN CALL!', 'HẠ MÀN!'));
    else bounce(api, b.x, b.y);
  },
  emp(b, api) {
    for (const pt of b.parts) puppetFree(b, api, pt);
  },
};

// ---------------------------------------------------------------------------
// FRACTAL — the seed of the swarm. Every body splits in two when it breaks,
// and same-size fragments pull together and MERGE back. Keep them apart.
// ---------------------------------------------------------------------------
const FRACTAL_SHARE = [0.36, 0.16, 0.08];
const FRACTAL_R = [46, 32, 21];

/** HP a fragment of `gen` still represents, its unborn children included. */
function fractalWorth(b: BossEntity, gen: number): number {
  let w = 0;
  for (let g = gen, n = 1; g < FRACTAL_SHARE.length; g++, n *= 2) w += n * FRACTAL_SHARE[g] * b.maxHp;
  return w;
}

function fractalPart(b: BossEntity, gen: number, x: number, y: number, hpFrac = 1): BossPart {
  const pt = makePart(x, y, FRACTAL_R[gen], FRACTAL_SHARE[gen] * b.maxHp * hpFrac);
  pt.maxHp = FRACTAL_SHARE[gen] * b.maxHp;
  pt.a = gen;
  pt.tx = (Math.random() - 0.5) * 60; // velocity
  pt.ty = (Math.random() - 0.5) * 60;
  pt.timer = 4; // can't merge yet
  return pt;
}

function fractalSync(b: BossEntity, api: BossApi) {
  b.hp = b.parts.reduce((s, pt) => s + pt.hp + 2 * fractalWorth(b, (pt.a || 0) + 1), 0);
  if (b.parts.length === 0) {
    b.hp = 0;
    api.defeat();
  } else {
    // The HUD and the engine's hooks follow the biggest fragment
    const lead = b.parts.reduce((m, pt) => ((pt.a || 0) < (m.a || 0) ? pt : m), b.parts[0]);
    b.x = lead.x;
    b.y = lead.y;
    b.r = lead.r;
  }
}

function fractalHit(b: BossEntity, api: BossApi, pt: BossPart, amount: number) {
  pt.hp -= amount;
  pt.hitFlash = 0.06;
  if (pt.hp > 0) {
    fractalSync(b, api);
    return;
  }
  const gen = pt.a || 0;
  b.parts.splice(b.parts.indexOf(pt), 1);
  api.sfx('boom');
  api.shake(gen === 0 ? 18 : 10);
  api.shockwave(pt.x, pt.y, '#c084fc', 160 - gen * 40, 4);
  api.particles(pt.x, pt.y, '#e9d5ff', 30 - gen * 8, 320, true);
  if (gen + 1 < FRACTAL_SHARE.length) {
    for (const s of [-1, 1]) {
      const c = fractalPart(b, gen + 1, pt.x + s * pt.r * 0.6, pt.y);
      c.tx = s * 170;
      c.ty = -40 + Math.random() * 80;
      b.parts.push(c);
    }
    api.text(pt.x, pt.y - pt.r - 10, tr('SPLIT! KEEP APART!', 'TÁCH ĐÔI! GIỮ XA NHAU!'), '#e9d5ff', 15);
  } else {
    api.text(pt.x, pt.y - 20, tr('SHATTERED', 'VỠ VỤN'), '#e9d5ff', 13);
  }
  fractalSync(b, api);
}

const fractal: BossBehavior = {
  setup(b, api) {
    b.targetY = Math.max(200, api.H * 0.26);
    b.parts = [fractalPart(b, 0, b.x, b.y)];
    b.parts[0].timer = 0;
    b.r = FRACTAL_R[0];
    b.v.merges = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    b.angle += dt * 0.7;
    const { W, H } = api;
    if (!ready) {
      b.parts[0].x = b.x;
      b.parts[0].y = b.y;
      b.status = '';
      return;
    }
    b.t += dt;
    const rage = b.hp / b.maxHp < 0.4;

    // Drift, bounce, and pull towards the nearest same-size sibling
    for (const pt of b.parts) {
      pt.timer = Math.max(0, pt.timer - dt);
      const gen = pt.a || 0;
      let mate: BossPart | null = null;
      let best = Infinity;
      for (const q of b.parts) {
        if (q === pt || q.a !== pt.a) continue;
        const d = dist(pt.x, pt.y, q.x, q.y);
        if (d < best) {
          best = d;
          mate = q;
        }
      }
      if (mate && pt.timer <= 0 && mate.timer <= 0) {
        const a = Math.atan2(mate.y - pt.y, mate.x - pt.x);
        pt.tx += Math.cos(a) * (rage ? 48 : 36) * dt;
        pt.ty += Math.sin(a) * (rage ? 48 : 36) * dt;
      } else {
        pt.tx += Math.sin(b.t * 0.7 + gen + pt.r) * 20 * dt;
        pt.ty += Math.cos(b.t * 0.6 + pt.r) * 20 * dt;
      }
      const sp = Math.hypot(pt.tx, pt.ty);
      const cap = pt.timer > 0 ? 260 : 90;
      if (sp > cap) {
        pt.tx *= cap / sp;
        pt.ty *= cap / sp;
      }
      pt.x += pt.tx * dt;
      pt.y += pt.ty * dt;
      if (pt.x < pt.r || pt.x > W - pt.r) pt.tx = -pt.tx;
      if (pt.y < 70 + pt.r || pt.y > H * 0.58) pt.ty = -pt.ty;
      pt.x = Math.max(pt.r, Math.min(W - pt.r, pt.x));
      pt.y = Math.max(70 + pt.r, Math.min(H * 0.58, pt.y));
    }

    // Merge touching same-size pairs back into their parent
    outer: for (let i = 0; i < b.parts.length; i++) {
      for (let j = i + 1; j < b.parts.length; j++) {
        const p1 = b.parts[i];
        const p2 = b.parts[j];
        if (p1.a !== p2.a || !p1.a || p1.timer > 0 || p2.timer > 0) continue;
        if (dist(p1.x, p1.y, p2.x, p2.y) > (p1.r + p2.r) * 0.5) continue;
        const parent = fractalPart(b, p1.a - 1, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 0.45);
        parent.timer = 3;
        b.parts.splice(j, 1);
        b.parts.splice(i, 1);
        b.parts.push(parent);
        b.v.merges++;
        api.sfx('boss_alarm');
        api.flash('#c084fc', 0.3);
        api.shockwave(parent.x, parent.y, '#f0abfc', 200, 5);
        api.banner(tr('FRAGMENTS MERGED!', 'CÁC MẢNH ĐÃ HỢP NHẤT!'), 'neon-glow-pink');
        if (b.v.merges === 1) api.comm('iris', tr('Don’t let them touch! Dash into one to knock it away!', 'Đừng để chúng chạm nhau! Lướt húc một mảnh để đẩy nó ra!'));
        break outer;
      }
    }
    fractalSync(b, api);

    b.status = tr(
      `${b.parts.length} fragment${b.parts.length > 1 ? 's' : ''} — break them, keep them APART`,
      `${b.parts.length} mảnh — phá chúng, giữ chúng XA NHAU`
    );

    if (!api.alive) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = Math.max(0.45, (rage ? 1.3 : 1.6) - b.parts.length * 0.15);
    const pt = b.parts[b.attackIndex++ % b.parts.length];
    const gen = pt.a || 0;
    const col = { color: '#d8b4fe' };
    api.sfx('enemy_shot');
    if (gen === 0) {
      ring(api, pt.x, pt.y, rage ? 22 : 18, 150, b.t, col);
      fan(api, pt.x, pt.y, aimAt(api, pt.x, pt.y), 3, 0.2, 210, col);
    } else if (gen === 1) fan(api, pt.x, pt.y, aimAt(api, pt.x, pt.y), rage ? 5 : 3, 0.18, 220, col);
    else api.shot(pt.x, pt.y, aimAt(api, pt.x, pt.y), 260, col);
  },
  bullet(b, api, bl) {
    for (const pt of b.parts) {
      if (dist(bl.x, bl.y, pt.x, pt.y) >= pt.r * 0.9) continue;
      fractalHit(b, api, pt, bulletDmg(bl));
      return 'hit';
    }
    return null;
  },
  contact(b, api, dashing) {
    const p = api.player;
    for (const pt of [...b.parts]) {
      if (dist(p.x, p.y, pt.x, pt.y) >= pt.r * 0.85 + p.radius * 0.7) continue;
      if (!dashing) {
        api.hurtPlayer();
        return;
      }
      if (p.bossContactCd > 0) return;
      p.bossContactCd = 0.35;
      // Knock it away and keep it from merging for a while
      const a = Math.atan2(pt.y - p.y, pt.x - p.x);
      pt.tx = Math.cos(a) * 320;
      pt.ty = Math.sin(a) * 320;
      pt.timer = 3.5;
      strikeFx(api, tr('SHATTER STRIKE!', 'ĐÒN VỠ VỤN!'), '#e9d5ff');
      fractalHit(b, api, pt, 8);
      return;
    }
  },
  emp(b, api) {
    for (const pt of b.parts) pt.timer = Math.max(pt.timer, 4);
    for (const pt of [...b.parts]) fractalHit(b, api, pt, pt.maxHp * 0.25);
    api.banner(tr('EMP — FRAGMENTS SCATTERED!', 'EMP — CÁC MẢNH TẢN RA!'), 'neon-glow-amber');
  },
};

// ===========================================================================
// ACT IV — ORIGIN
// ===========================================================================

// ---------------------------------------------------------------------------
// BLIGHT — corrupts the floor of the sector. The more ground it holds, the
// tougher it gets; fly over the blight to cleanse it.
// ---------------------------------------------------------------------------
const BLIGHT_COLS = 6;
const BLIGHT_ROWS = 7;
/** Corruption (0..1) per floor cell, row-major. */
const blightCells = new WeakMap<BossEntity, Float32Array>();

/** Floor layout, shared with the renderer. */
function blightLayout(W: number, H: number) {
  const y0 = H * 0.38;
  return { y0, cw: W / BLIGHT_COLS, ch: (H - 20 - y0) / BLIGHT_ROWS };
}

function blightGrid(b: BossEntity): Float32Array {
  let g = blightCells.get(b);
  if (!g) {
    g = new Float32Array(BLIGHT_COLS * BLIGHT_ROWS);
    blightCells.set(b, g);
  }
  return g;
}

function blightSplat(b: BossEntity, col: number, row: number, amount: number) {
  const g = blightGrid(b);
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (c < 0 || r < 0 || c >= BLIGHT_COLS || r >= BLIGHT_ROWS) continue;
      g[r * BLIGHT_COLS + c] = Math.max(g[r * BLIGHT_COLS + c], amount);
    }
  }
}

function blightCover(b: BossEntity): number {
  const g = blightGrid(b);
  let s = 0;
  for (let i = 0; i < g.length; i++) s += g[i];
  return s / g.length;
}

/** Damage multiplier: blight armours it, a purged floor leaves it raw. */
function blightMult(b: BossEntity): number {
  const f = blightCover(b);
  return f < 0.12 ? 1.5 : Math.max(0.25, 1 - f * 1.6);
}

function blightBomb(b: BossEntity, api: BossApi, col: number, row: number) {
  const { y0, cw, ch } = blightLayout(api.W, api.H);
  const m = makePart((col + 0.5) * cw, y0 + (row + 0.5) * ch, 22, 1);
  m.timer = 1.1;
  m.a = col;
  m.tx = row;
  b.parts.push(m);
}

const blight: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(50, api.W * 0.11);
    b.targetY = Math.max(180, api.H * 0.21);
    b.v.spreadT = 1.4;
    b.v.puffT = 2.6;
    b.v.weakText = 0;
    for (let i = 0; i < 4; i++) blightSplat(b, Math.floor(Math.random() * BLIGHT_COLS), Math.floor(Math.random() * BLIGHT_ROWS), 0.6);
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const { W, H } = api;
    const p = api.player;
    const g = blightGrid(b);
    const { y0, cw, ch } = blightLayout(W, H);
    b.angle += dt * 0.6;
    if (b.v.weakText > 0) b.v.weakText -= dt;
    const cover = blightCover(b);
    b.v.cover = cover;
    b.status =
      cover < 0.12
        ? tr('FLOOR PURGED — it’s raw, FIRE! (x1.5)', 'SÀN ĐÃ SẠCH — nó yếu rồi, BẮN! (x1.5)')
        : tr(
            `BLIGHT ${Math.round(cover * 100)}% — fly over it to cleanse (damage x${blightMult(b).toFixed(2)})`,
            `Ô NHIỄM ${Math.round(cover * 100)}% — bay qua để tẩy sạch (sát thương x${blightMult(b).toFixed(2)})`
          );
    if (!ready) return;
    b.t += dt;
    b.x = W / 2 + Math.sin(b.t * 0.35) * W * 0.22;
    b.y = b.targetY + Math.sin(b.t) * 8;

    // The pilot cleans whatever they fly over; a Dash scours a 3x3 block
    if (api.alive && p.y > y0) {
      const col = Math.floor(p.x / cw);
      const row = Math.floor((p.y - y0) / ch);
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (c < 0 || r < 0 || c >= BLIGHT_COLS || r >= BLIGHT_ROWS) continue;
          const i = r * BLIGHT_COLS + c;
          if (isDashing(api)) g[i] = 0;
          else if (r === row && c === col) g[i] = Math.max(0, g[i] - 4 * dt);
        }
      }
    }
    // Growth and spread
    for (let i = 0; i < g.length; i++) if (g[i] > 0 && g[i] < 1) g[i] = Math.min(1, g[i] + 0.3 * dt);
    b.v.spreadT -= dt;
    if (b.v.spreadT <= 0) {
      b.v.spreadT = 1.4;
      const chance = rage ? 0.14 : 0.1;
      const snapshot = Array.from(g);
      for (let i = 0; i < snapshot.length; i++) {
        if (snapshot[i] < 1 || Math.random() > chance) continue;
        const c = i % BLIGHT_COLS;
        const r = Math.floor(i / BLIGHT_COLS);
        const [dc, dr] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= BLIGHT_COLS || nr >= BLIGHT_ROWS) continue;
        g[nr * BLIGHT_COLS + nc] = Math.max(g[nr * BLIGHT_COLS + nc], 0.05);
      }
    }
    // Ripe cells puff spores
    b.v.puffT -= dt;
    if (b.v.puffT <= 0 && api.alive) {
      b.v.puffT = rage ? 2 : 2.6;
      const ripe: number[] = [];
      for (let i = 0; i < g.length; i++) if (g[i] >= 1) ripe.push(i);
      for (let k = 0; k < 2 && ripe.length; k++) {
        const i = ripe.splice(Math.floor(Math.random() * ripe.length), 1)[0];
        const x = ((i % BLIGHT_COLS) + 0.5) * cw;
        const y = y0 + (Math.floor(i / BLIGHT_COLS) + 0.5) * ch;
        ring(api, x, y, 5, 75, Math.random(), { color: '#bef264', r: 5 });
      }
    }
    // Bombs land
    for (let i = b.parts.length - 1; i >= 0; i--) {
      const m = b.parts[i];
      m.timer -= dt;
      if (m.timer > 0) continue;
      b.parts.splice(i, 1);
      blightSplat(b, m.a || 0, m.tx, 0.4);
      api.sfx('boom');
      api.shake(6);
      api.shockwave(m.x, m.y, '#a3e635', 90, 3);
      api.particles(m.x, m.y, '#bef264', 16, 200, true);
      if (api.alive && dist(p.x, p.y, m.x, m.y) < 34 && !isDashing(api)) api.hurtPlayer();
    }

    if (!api.alive) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.4 : 1.8;
    const pattern = ['bombs', 'spit', 'bombs', 'ring'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    if (pattern === 'bombs') {
      // One on you, the rest anywhere
      const n = rage ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const col = k === 0 ? Math.max(0, Math.min(BLIGHT_COLS - 1, Math.floor(p.x / cw))) : Math.floor(Math.random() * BLIGHT_COLS);
        const row = k === 0 ? Math.max(0, Math.min(BLIGHT_ROWS - 1, Math.floor((p.y - y0) / ch))) : Math.floor(Math.random() * BLIGHT_ROWS);
        blightBomb(b, api, col, row);
      }
      api.sfx('laser_warn');
    } else if (pattern === 'spit') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 210, { color: '#a3e635' });
    } else {
      ring(api, b.x, b.y, rage ? 18 : 14, 140, b.t, { color: '#d9f99d' });
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.85) return null;
    const mult = blightMult(b);
    damage(b, api, mult * bulletDmg(bl));
    if (mult < 0.5 && b.v.weakText <= 0) {
      b.v.weakText = 1.6;
      api.text(bl.x, bl.y - 10, tr('CLEANSE THE FLOOR!', 'TẨY SẠCH MẶT SÀN!'), '#bef264', 12);
    }
    return 'hit';
  },
  contact(b, api, dashing) {
    bodyContact(b, api, dashing, b.x, b.y, b.r, 10 * blightMult(b), tr('PURGE STRIKE!', 'ĐÒN THANH TẨY!'));
  },
  emp(b, api) {
    const g = blightGrid(b);
    for (let i = 0; i < g.length; i++) g[i] *= 0.3;
    api.banner(tr('EMP — BLIGHT BURNED AWAY!', 'EMP — Ô NHIỄM BỊ ĐỐT SẠCH!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// DEADEYE — a sniper duel. Dash at the instant it fires, while inside the
// beam, to COUNTER the shot back into it.
// ---------------------------------------------------------------------------
const SNIPE_LOCK = 0.35;

function deadeyePerch(b: BossEntity, api: BossApi) {
  let x = b.x;
  for (let k = 0; k < 6 && Math.abs(x - b.x) < api.W * 0.25; k++) x = api.W * (0.15 + Math.random() * 0.7);
  b.v.px = x;
  b.v.py = api.H * (0.2 + Math.random() * 0.14);
}

const deadeye: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(36, api.W * 0.085);
    b.v.st = 0;
    b.v.stT = 1.6;
    b.v.fa = Math.PI / 2;
    b.v.stun = 0;
    b.v.tap = 0;
    b.v.fireFx = 0;
    b.v.px = api.W / 2;
    b.v.py = b.targetY;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const p = api.player;
    if (b.v.fireFx > 0) b.v.fireFx -= dt;
    if (b.v.stun > 0) b.v.stun -= dt;
    b.status =
      b.v.stun > 0
        ? stunnedStatus(b.v.stun)
        : b.v.st === 0
        ? tr('SNIPER LOCKING — DASH the instant it fires to COUNTER', 'XẠ THỦ ĐANG NGẮM — LƯỚT đúng lúc nó bóp cò để PHẢN ĐẠN')
        : tr('Reloading — pressure it!', 'Đang nạp đạn — dồn ép nó!');
    if (!ready) {
      b.v.px = b.x;
      b.v.py = b.targetY;
      return;
    }
    b.t += dt;
    b.angle += dt;
    if (b.v.stun > 0) return;

    b.v.stT -= dt;
    if (b.v.st === 0) {
      // Aim: track the pilot, then hold still for the last moment so it can be read
      b.x += (b.v.px - b.x) * Math.min(1, 8 * dt);
      b.y += (b.v.py - b.y) * Math.min(1, 8 * dt);
      if (b.v.stT > SNIPE_LOCK) {
        const d = angDiff(aimAt(api, b.x, b.y), b.v.fa);
        b.v.fa += Math.max(-5 * dt, Math.min(5 * dt, d));
      } else if (!b.v.locked) {
        b.v.locked = 1;
        api.sfx('snipe_lock');
      }
      if (b.v.stT <= 0) {
        b.v.locked = 0;
        b.v.fireFx = 0.3;
        api.sfx('snipe');
        const ex = b.x + Math.cos(b.v.fa) * 1500;
        const ey = b.y + Math.sin(b.v.fa) * 1500;
        b.v.ex = ex;
        b.v.ey = ey;
        if (api.alive && segDist(p.x, p.y, b.x, b.y, ex, ey) < 12 + p.radius * 0.6) {
          if (isDashing(api)) {
            b.v.stun = api.hard ? 1.8 : 2.2;
            b.v.countered = 1;
            api.slowmo(0.3, 0.45);
            api.flash('#ffffff', 0.4);
            api.shake(18);
            api.shockwave(p.x, p.y, '#fde047', 160, 5);
            api.shockwave(b.x, b.y, '#f87171', 220, 6);
            api.text(p.x, p.y - 30, tr('COUNTERSHOT!', 'PHẢN ĐẠN!'), '#fde047', 20);
            api.banner(tr('COUNTERSHOT — DEADEYE STUNNED!', 'PHẢN ĐẠN — DEADEYE BỊ CHOÁNG!'), 'neon-glow-amber');
            damage(b, api, b.maxHp * 0.1);
          } else {
            api.hurtPlayer();
          }
        } else b.v.countered = 0;
        b.v.st = 1;
        b.v.stT = rage ? 0.8 : 1.1;
        api.sfx('enemy_shot');
        fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.22, 200, { color: '#fca5a5' });
      }
    } else if (b.v.st === 1) {
      if (b.v.stT <= 0) {
        if (rage && !b.v.tap) {
          // Double tap: a faster second shot from the same perch
          b.v.tap = 1;
          b.v.st = 0;
          b.v.stT = 0.85;
        } else {
          b.v.tap = 0;
          b.v.st = 2;
          b.v.stT = 0.45;
          api.sfx('glitch');
        }
      }
    } else if (b.v.stT <= 0) {
      deadeyePerch(b, api);
      b.x = b.v.px;
      b.y = b.v.py;
      b.v.fa = aimAt(api, b.x, b.y);
      b.v.st = 0;
      b.v.stT = rage ? 1.15 : 1.45;
      api.shockwave(b.x, b.y, '#f87171', 90, 3);
    }
  },
  bullet(b, api, bl) {
    if (b.v.st === 2 && b.v.stun <= 0) return null; // blinking out
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.9) return null;
    damage(b, api, (b.v.stun > 0 ? 1.5 : 0.6) * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    if (b.v.st === 2 && b.v.stun <= 0) return;
    bodyContact(b, api, dashing, b.x, b.y, b.r, b.v.stun > 0 ? 12 : 6, tr('POINT BLANK!', 'ĐÒN SÁT NÚT!'));
  },
  emp(b, api) {
    b.v.stun = Math.max(b.v.stun, 2.2);
    b.v.st = 1;
    b.v.stT = 0.8;
    b.v.locked = 0;
    api.banner(tr('EMP — SCOPE FRIED!', 'EMP — ỐNG NGẮM CHÁY!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// SIEGEBREAKER — shells IRIS's relay. Stay close to shield it; a full relay
// fires the Grid Cannon.
// ---------------------------------------------------------------------------
const RELAY_COVER = 90;

function relayPos(api: BossApi) {
  return { x: api.W / 2, y: api.H * 0.86 };
}

const siege: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(54, api.W * 0.12);
    b.targetY = Math.max(185, api.H * 0.22);
    b.v.charge = 20;
    b.v.stun = 0;
    b.v.cannonFx = 0;
    b.v.nodeHit = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const p = api.player;
    const node = relayPos(api);
    b.v.nx = node.x;
    b.v.ny = node.y;
    if (b.v.stun > 0) b.v.stun -= dt;
    if (b.v.cannonFx > 0) b.v.cannonFx -= dt;
    if (b.v.nodeHit > 0) b.v.nodeHit -= dt;
    const covered = api.alive && dist(p.x, p.y, node.x, node.y) < RELAY_COVER;
    b.v.covered = covered ? 1 : 0;
    b.status =
      b.v.stun > 0
        ? stunnedStatus(b.v.stun)
        : tr(
            `RELAY ${Math.floor(b.v.charge)}% — ${covered ? 'SHIELDED' : 'stay close to shield it'}`,
            `TRẠM ${Math.floor(b.v.charge)}% — ${covered ? 'ĐANG CHE CHẮN' : 'ở gần để che chắn'}`
          );
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.3) * api.W * 0.25;
    b.y = b.targetY + Math.sin(b.t * 0.9) * 6;

    // Shells: the shield eats them, the relay takes the rest
    for (let i = api.hazards.length - 1; i >= 0; i--) {
      const h = api.hazards[i];
      if (h.type !== 'shot' && h.type !== 'drone') continue;
      const d = dist(h.x, h.y, node.x, node.y);
      if (covered && h.type === 'shot' && d < RELAY_COVER - 10) {
        api.hazards.splice(i, 1);
        api.particles(h.x, h.y, '#67e8f9', 3, 90);
        continue;
      }
      if (d < (h.type === 'drone' ? 28 : 22)) {
        api.hazards.splice(i, 1);
        b.v.charge = Math.max(0, b.v.charge - (h.type === 'drone' ? 20 : 12));
        b.v.nodeHit = 0.25;
        api.sfx('block');
        api.particles(node.x, node.y, '#fb923c', 10, 200, true);
      }
    }
    // Charge, then fire the Grid Cannon
    b.v.charge = Math.min(100, b.v.charge + dt * (rage ? 6.5 : 7.5));
    if (b.v.charge >= 100) {
      b.v.charge = 0;
      b.v.stun = 1.6;
      b.v.cannonFx = 0.6;
      api.sfx('fever');
      api.flash('#67e8f9', 0.45);
      api.shake(20);
      api.slowmo(0.4, 0.35);
      api.shockwave(b.x, b.y, '#67e8f9', 260, 7);
      api.particles(b.x, b.y, '#a5f3fc', 40, 360, true);
      api.banner(tr('GRID CANNON FIRES!', 'PHÁO LƯỚI KHAI HỎA!'), 'neon-glow-amber');
      damage(b, api, b.maxHp * 0.13);
      if (b.hp <= 0) return;
    }

    if (!api.alive || b.v.stun > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.25 : 1.6;
    const pattern = ['shells', 'player', 'sappers', 'shells', 'barrage'][b.attackIndex++ % 5];
    api.sfx('enemy_shot');
    const shell = { color: '#fb923c', r: 7 };
    if (pattern === 'shells') {
      fan(api, b.x, b.y, Math.atan2(node.y - b.y, node.x - b.x), rage ? 5 : 3, 0.1, 200, shell);
    } else if (pattern === 'player') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), 3, 0.2, 230, { color: '#fdba74' });
    } else if (pattern === 'sappers') {
      for (let k = 0; k < (rage ? 4 : 3); k++) {
        const x = 40 + Math.random() * (api.W - 80);
        const y = -20 - k * 30;
        const a = Math.atan2(node.y - y, node.x - x);
        api.drone(x, y, Math.cos(a) * 120, Math.sin(a) * 120);
      }
      api.banner(tr('SAPPERS INBOUND — protect the relay!', 'ĐỘI PHÁ HOẠI ĐANG TỚI — bảo vệ trạm!'), 'neon-glow-pink');
    } else {
      ring(api, b.x, b.y, rage ? 18 : 14, 140, b.t, shell);
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * 0.85) return null;
    damage(b, api, (b.v.stun > 0 ? 1.5 : 0.7) * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    bodyContact(b, api, dashing, b.x, b.y, b.r, 10, tr('TREAD BREAKER!', 'ĐÒN PHÁ XÍCH!'));
  },
  emp(b, api) {
    b.v.charge = Math.min(99, b.v.charge + 35);
    api.text(b.v.nx, b.v.ny - 40, tr('RELAY +35%', 'TRẠM +35%'), '#67e8f9', 16);
  },
};

// ---------------------------------------------------------------------------
// BREAKER — arcade rules. Bullets do nothing: your ship is the paddle, and
// only the ball breaks bricks and core.
// ---------------------------------------------------------------------------
const BRICK_COLS = 7;
const BRICK_ROWS = 3;
const BALL_R = 10;
const BRICK_COLORS = ['#f472b6', '#fbbf24', '#38bdf8'];

function brickLayout(b: BossEntity, api: { W: number }) {
  const bw = (api.W * 0.8) / BRICK_COLS;
  return { bw, bh: 16, x0: b.x - (bw * BRICK_COLS) / 2, y0: b.y + b.r + 16 };
}

function brickAt(b: BossEntity, slot: number): BossPart {
  const pt = makePart(0, 0, 10, 1);
  pt.a = slot;
  return pt;
}

function breakerServe(b: BossEntity, api: BossApi) {
  const p = api.player;
  b.v.ball = 1;
  b.v.bx = p.x;
  b.v.by = p.y - 40;
  b.v.bspd = 300;
  b.v.power = 0;
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  b.v.bvx = Math.cos(a) * b.v.bspd;
  b.v.bvy = Math.sin(a) * b.v.bspd;
}

function breakerStep(b: BossEntity, api: BossApi, dt: number) {
  const { W, H } = api;
  const p = api.player;
  b.v.bx += b.v.bvx * dt;
  b.v.by += b.v.bvy * dt;
  if (b.v.bx < BALL_R) b.v.bvx = Math.abs(b.v.bvx);
  if (b.v.bx > W - BALL_R) b.v.bvx = -Math.abs(b.v.bvx);
  if (b.v.by < 70) b.v.bvy = Math.abs(b.v.bvy);
  if (b.v.by > H + 20) {
    b.v.ball = 0;
    b.v.ballT = 1.3;
    api.sfx('glitch');
    api.text(W / 2, H * 0.6, tr('BALL LOST — the wall rebuilds!', 'MẤT BÓNG — bức tường xây lại!'), '#f43f5e', 16);
    for (let k = 0; k < 2; k++) breakerRebuild(b);
    return;
  }
  // Paddle: where it lands on the ship sets the angle; a Dash smashes a power ball
  const reach = p.radius + 14;
  if (api.alive && b.v.bvy > 0 && dist(b.v.bx, b.v.by, p.x, p.y) < reach) {
    const off = Math.max(-1, Math.min(1, (b.v.bx - p.x) / reach));
    const a = -Math.PI / 2 + off * 1.05;
    b.v.bspd = Math.min(600, b.v.bspd + 14);
    const power = isDashing(api);
    const sp = b.v.bspd * (power ? 1.3 : 1);
    b.v.bvx = Math.cos(a) * sp;
    b.v.bvy = Math.sin(a) * sp;
    b.v.by = p.y - reach;
    b.v.power = power ? 1 : 0;
    api.sfx(power ? 'parry' : 'hit');
    if (power) api.text(p.x, p.y - 30, tr('POWER BALL!', 'BÓNG SIÊU CẤP!'), '#fde047', 15);
  }
  // Bricks
  const { bw, bh, x0, y0 } = brickLayout(b, api);
  for (let i = b.parts.length - 1; i >= 0; i--) {
    const pt = b.parts[i];
    const slot = pt.a || 0;
    const cx = x0 + ((slot % BRICK_COLS) + 0.5) * bw;
    const cy = y0 + (Math.floor(slot / BRICK_COLS) + 0.5) * (bh + 5);
    const nx = Math.max(cx - bw / 2, Math.min(cx + bw / 2, b.v.bx));
    const ny = Math.max(cy - bh / 2, Math.min(cy + bh / 2, b.v.by));
    if (dist(nx, ny, b.v.bx, b.v.by) > BALL_R) continue;
    b.parts.splice(i, 1);
    api.particles(cx, cy, BRICK_COLORS[Math.floor(slot / BRICK_COLS)], 10, 200, true);
    api.sfx('block');
    if (!b.v.power) {
      if (Math.abs(b.v.bx - cx) / (bw / 2) > Math.abs(b.v.by - cy) / (bh / 2)) b.v.bvx = Math.sign(b.v.bx - cx) * Math.abs(b.v.bvx);
      else b.v.bvy = Math.sign(b.v.by - cy) * Math.abs(b.v.bvy);
      break;
    }
  }
  // Core
  const d = dist(b.v.bx, b.v.by, b.x, b.y);
  if (d < b.r + BALL_R) {
    const nx = (b.v.bx - b.x) / (d || 1);
    const ny = (b.v.by - b.y) / (d || 1);
    const dot = b.v.bvx * nx + b.v.bvy * ny;
    if (dot < 0) {
      b.v.bvx -= 2 * dot * nx;
      b.v.bvy -= 2 * dot * ny;
    }
    b.v.bx = b.x + nx * (b.r + BALL_R + 1);
    b.v.by = b.y + ny * (b.r + BALL_R + 1);
    const big = !!b.v.power;
    b.v.power = 0;
    api.sfx('boom');
    api.shake(big ? 18 : 12);
    api.flash('#38bdf8', big ? 0.35 : 0.2);
    api.shockwave(b.x, b.y, '#7dd3fc', big ? 240 : 160, 5);
    api.text(b.x, b.y + b.r + 14, big ? tr('MEGA HIT!', 'CÚ ĐÁNH KHỦNG!') : tr('CORE HIT!', 'TRÚNG LÕI!'), '#fde047', big ? 20 : 16);
    damage(b, api, b.maxHp * (big ? 0.13 : 0.065));
  }
}

function breakerRebuild(b: BossEntity) {
  const used = new Set(b.parts.map((pt) => pt.a));
  const free: number[] = [];
  for (let s = 0; s < BRICK_COLS * BRICK_ROWS; s++) if (!used.has(s)) free.push(s);
  if (free.length) b.parts.push(brickAt(b, free[Math.floor(Math.random() * free.length)]));
}

const breaker: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(34, api.W * 0.08);
    b.targetY = Math.max(185, api.H * 0.22);
    b.parts = [];
    for (let s = 0; s < BRICK_COLS * BRICK_ROWS; s++) b.parts.push(brickAt(b, s));
    b.v.ball = 0;
    b.v.ballT = 1.5;
    b.v.rebuildT = 7;
    b.v.blockText = 0;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    if (b.v.blockText > 0) b.v.blockText -= dt;
    b.angle += dt;
    b.status = b.v.ball
      ? tr(`Bounce the BALL off your ship into the core (bricks ${b.parts.length})`, `Dùng tàu đỡ BÓNG vào lõi (gạch ${b.parts.length})`)
      : tr('New ball incoming...', 'Bóng mới đang tới...');
    if (!ready) return;
    b.t += dt;
    b.x = api.W / 2 + Math.sin(b.t * 0.35) * api.W * 0.06;
    b.y = b.targetY;

    if (b.v.ball) {
      // Two substeps so a fast ball can't tunnel through a brick
      for (let k = 0; k < 2 && b.v.ball; k++) {
        breakerStep(b, api, dt / 2);
        if (b.hp <= 0) return;
      }
    } else {
      b.v.ballT -= dt;
      if (b.v.ballT <= 0 && api.alive) breakerServe(b, api);
    }
    b.v.rebuildT -= dt;
    if (b.v.rebuildT <= 0) {
      b.v.rebuildT = rage ? 5 : 7;
      breakerRebuild(b);
    }

    if (!api.alive) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = rage ? 1.2 : 1.6;
    const pattern = ['invaders', 'fan', 'invaders', 'ring'][b.attackIndex++ % 4];
    api.sfx('enemy_shot');
    const { bw, bh, x0, y0 } = brickLayout(b, api);
    if (pattern === 'invaders') {
      for (let k = 0; k < (rage ? 4 : 3) && b.parts.length; k++) {
        const slot = b.parts[Math.floor(Math.random() * b.parts.length)].a || 0;
        const x = x0 + ((slot % BRICK_COLS) + 0.5) * bw;
        const y = y0 + (Math.floor(slot / BRICK_COLS) + 1) * (bh + 5);
        api.shot(x, y, Math.PI / 2, 190, { color: BRICK_COLORS[Math.floor(slot / BRICK_COLS)], r: 5 });
      }
    } else if (pattern === 'fan') {
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 220, { color: '#7dd3fc' });
    } else {
      ring(api, b.x, b.y, 12, 130, b.t, { color: '#7dd3fc' });
    }
  },
  bullet(b, api, bl) {
    const { bw, bh, x0, y0 } = brickLayout(b, api);
    const inWall = bl.x > x0 && bl.x < x0 + bw * BRICK_COLS && bl.y > y0 && bl.y < y0 + BRICK_ROWS * (bh + 5);
    const onCore = dist(bl.x, bl.y, b.x, b.y) < b.r * 0.9;
    if (!onCore && !(inWall && b.parts.some((pt) => {
      const s = pt.a || 0;
      return Math.abs(bl.x - (x0 + ((s % BRICK_COLS) + 0.5) * bw)) < bw / 2 && Math.abs(bl.y - (y0 + (Math.floor(s / BRICK_COLS) + 0.5) * (bh + 5))) < bh / 2 + 3;
    }))) return null;
    if (b.v.blockText <= 0) {
      b.v.blockText = 1.8;
      api.text(bl.x, bl.y + 14, tr('ONLY THE BALL COUNTS', 'CHỈ BÓNG MỚI TÍNH'), '#7dd3fc', 12);
    }
    return 'block';
  },
  contact(b, api, dashing) {
    const p = api.player;
    if (dist(p.x, p.y, b.x, b.y) >= b.r * 0.8 + p.radius) return;
    if (!dashing) api.hurtPlayer();
    else bounce(api, b.x, b.y, tr('USE THE BALL!', 'DÙNG BÓNG ĐI!'));
  },
  emp(b, api) {
    if (!b.v.ball) breakerServe(b, api);
    b.v.power = 1;
    b.v.bvy = -Math.abs(b.v.bvy);
    api.banner(tr('EMP — POWER BALL!', 'EMP — BÓNG SIÊU CẤP!'), 'neon-glow-amber');
  },
};

// ---------------------------------------------------------------------------
// ARCHITECT — the designer of every grid. It rewrites the rules of the fight
// every few seconds; each rule has its own way to hurt it.
// ---------------------------------------------------------------------------
const ARCH_RULES = ['blueprint', 'invert', 'pacifist', 'hunt'] as const;
type ArchRule = (typeof ARCH_RULES)[number];
const ARCH_GOLD = '#fde047';

function archRule(b: BossEntity): ArchRule {
  return ARCH_RULES[(b.v.rule || 0) % ARCH_RULES.length];
}

const ARCH_RULE_TEXT: Record<ArchRule, { banner: [string, string]; line: [string, string] }> = {
  blueprint: {
    banner: ['RULE: BLUEPRINT — standard fire', 'LUẬT: BẢN THIẾT KẾ — bắn như thường'],
    line: ['Back to the original design.', 'Quay về thiết kế gốc.'],
  },
  invert: {
    banner: ['RULE: INVERTED — your shots fire DOWN', 'LUẬT: ĐẢO NGƯỢC — đạn bắn XUỐNG'],
    line: ['Up is down. Adapt, or be deprecated.', 'Trên là dưới. Thích nghi, hoặc bị loại bỏ.'],
  },
  pacifist: {
    banner: ['RULE: PACIFIST — no guns. GRAZE to hurt it', 'LUẬT: PHI BẠO LỰC — không súng. SƯỢT ĐẠN để gây sát thương'],
    line: ['Weapons are a design flaw.', 'Vũ khí là một lỗi thiết kế.'],
  },
  hunt: {
    banner: ['RULE: THE HUNT — it flees. RAM it with DASH', 'LUẬT: CUỘC SĂN — nó bỏ chạy. HÚC nó bằng LƯỚT'],
    line: ['Catch me, if your reflexes allow it.', 'Bắt ta đi, nếu phản xạ cho phép.'],
  },
};

function archSetRule(b: BossEntity, api: BossApi) {
  b.v.ruleT = 0;
  b.v.trans = 1.4;
  api.clearShots();
  api.sfx('boss_alarm');
  api.flash(ARCH_GOLD, 0.3);
  api.shockwave(b.x, b.y, ARCH_GOLD, 260, 5);
  const txt = ARCH_RULE_TEXT[archRule(b)];
  api.banner(tr(...txt.banner), 'neon-glow-amber');
  api.comm('architect', tr(...txt.line));
}

const architect: BossBehavior = {
  setup(b, api) {
    b.r = Math.min(52, api.W * 0.12);
    b.targetY = Math.max(190, api.H * 0.22);
    b.v.rule = 0;
    b.v.ruleT = 0;
    b.v.trans = 0;
    b.v.scale = 1;
    b.v.grazeText = 0;
    b.v.hvx = 160;
    b.v.hvy = 120;
  },
  update(b, api, dt, ready) {
    decayFlashes(b, dt);
    const rage = b.hp / b.maxHp < 0.5;
    const { W, H } = api;
    const p = api.player;
    b.angle += dt * 0.5;
    if (b.v.grazeText > 0) b.v.grazeText -= dt;
    const rule = archRule(b);
    b.v.scale += ((rule === 'hunt' && b.v.trans <= 0 ? 0.6 : 1) - b.v.scale) * Math.min(1, 4 * dt);
    b.status =
      b.v.trans > 0
        ? tr('REWRITING THE RULES...', 'ĐANG VIẾT LẠI LUẬT...')
        : {
            blueprint: tr('BLUEPRINT — standard rules, fire away', 'BẢN THIẾT KẾ — luật thường, cứ bắn'),
            invert: tr('INVERTED — get ABOVE it, your shots fire down', 'ĐẢO NGƯỢC — bay LÊN TRÊN nó, đạn bắn xuống'),
            pacifist: tr('PACIFIST — GRAZE its bullets to hurt it', 'PHI BẠO LỰC — SƯỢT đạn của nó để gây sát thương'),
            hunt: tr('THE HUNT — RAM it with a Dash', 'CUỘC SĂN — HÚC nó bằng Lướt'),
          }[rule];
    if (!ready) return;
    b.t += dt;

    // Rule clock
    b.v.ruleT += dt;
    if (b.v.ruleT > (rage ? 10 : 12.5) && b.v.trans <= 0) {
      b.v.rule++;
      archSetRule(b, api);
      return;
    }
    if (b.v.trans > 0) b.v.trans -= dt;

    // Movement per rule
    if (rule === 'hunt') {
      // Flee: away from the pilot, bouncing off the walls
      const a = Math.atan2(b.y - p.y, b.x - p.x);
      b.v.hvx += Math.cos(a) * 260 * dt;
      b.v.hvy += Math.sin(a) * 260 * dt;
      const sp = Math.hypot(b.v.hvx, b.v.hvy);
      const cap = rage ? 250 : 210;
      if (sp > cap) {
        b.v.hvx *= cap / sp;
        b.v.hvy *= cap / sp;
      }
      b.x += b.v.hvx * dt;
      b.y += b.v.hvy * dt;
      if (b.x < 50 || b.x > W - 50) b.v.hvx = -b.v.hvx;
      if (b.y < 90 || b.y > H - 90) b.v.hvy = -b.v.hvy;
      b.x = Math.max(50, Math.min(W - 50, b.x));
      b.y = Math.max(90, Math.min(H - 90, b.y));
    } else {
      const ty = rule === 'invert' ? H * 0.8 : b.targetY;
      const tx = W / 2 + Math.sin(b.t * 0.4) * W * 0.22;
      b.x += (tx - b.x) * Math.min(1, 2.5 * dt);
      b.y += (ty - b.y) * Math.min(1, 2.5 * dt);
    }

    // Rule effects on the pilot's weapons
    if (b.v.trans <= 0 && rule === 'invert') {
      for (const bl of api.bullets) {
        if (bl.vy < 0 && bl.kind !== 'homing' && bl.kind !== 'missile') bl.vy = -bl.vy;
      }
    } else if (b.v.trans <= 0 && rule === 'pacifist') {
      api.bullets.length = 0;
    }

    // Spiral curtain for the pacifist rule
    if (b.v.burst > 0) {
      b.v.burstT -= dt;
      if (b.v.burstT <= 0) {
        b.v.burstT = 0.12;
        b.v.burst--;
        b.v.burstA += 0.35;
        for (let k = 0; k < 4; k++) api.shot(b.x, b.y, b.v.burstA + (k * TAU) / 4, 115, { color: '#fef08a' });
      }
    }

    if (!api.alive || b.v.trans > 0) return;
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    const gold = { color: '#fde68a' };
    api.sfx('enemy_shot');
    if (rule === 'blueprint') {
      b.attackTimer = rage ? 1.3 : 1.7;
      if (b.attackIndex++ % 2) {
        api.laser(p.x, 'v');
        if (rage) api.laser(p.y, 'h', 1.4);
      } else {
        ring(api, b.x, b.y, rage ? 18 : 14, 150, b.t, gold);
      }
    } else if (rule === 'invert') {
      b.attackTimer = rage ? 1.1 : 1.4;
      fan(api, b.x, b.y, aimAt(api, b.x, b.y), rage ? 5 : 3, 0.2, 220, gold);
    } else if (rule === 'pacifist') {
      b.attackTimer = 2.4;
      b.v.burst = rage ? 22 : 18;
      b.v.burstT = 0;
      b.v.burstA = b.t;
    } else {
      // Drops slow mines as it runs
      b.attackTimer = rage ? 0.7 : 0.9;
      api.shot(b.x, b.y, Math.PI / 2 + (Math.random() - 0.5) * 0.6, 45, { color: '#fbbf24', r: 8 });
    }
  },
  bullet(b, api, bl) {
    if (dist(bl.x, bl.y, b.x, b.y) >= b.r * b.v.scale * 0.85) return null;
    const rule = archRule(b);
    if (b.v.trans > 0 || rule === 'hunt') return 'block';
    damage(b, api, (rule === 'invert' ? 1.2 : 1) * bulletDmg(bl));
    return 'hit';
  },
  contact(b, api, dashing) {
    if (b.v.trans > 0) return;
    const p = api.player;
    const r = b.r * b.v.scale;
    if (dist(p.x, p.y, b.x, b.y) >= r * 0.85 + p.radius) return;
    if (!dashing) {
      api.hurtPlayer();
      return;
    }
    if (archRule(b) === 'hunt') {
      if (p.bossContactCd > 0) return;
      p.bossContactCd = 0.4;
      strikeFx(api, tr('CAUGHT YOU!', 'BẮT ĐƯỢC RỒI!'), ARCH_GOLD);
      api.slowmo(0.45, 0.25);
      damage(b, api, b.maxHp * 0.05);
      // It bolts the other way
      const a = Math.atan2(b.y - p.y, b.x - p.x);
      b.v.hvx = Math.cos(a) * 400;
      b.v.hvy = Math.sin(a) * 400;
    } else {
      bodyContact(b, api, true, b.x, b.y, r, 10, tr('OVERRIDE!', 'GHI ĐÈ!'));
    }
  },
  emp(b, api) {
    damage(b, api, b.maxHp * 0.04);
    if (b.v.trans <= 0) {
      b.v.rule++;
      archSetRule(b, api);
    }
  },
  graze(b, api, amount) {
    if (archRule(b) !== 'pacifist' || b.v.trans > 0) return;
    damage(b, api, b.maxHp * 0.0055 * amount);
    b.hitFlash = 0.08;
    if (b.v.grazeText <= 0) {
      b.v.grazeText = 0.8;
      api.text(api.player.x, api.player.y - 40, tr('GRAZE HURTS IT!', 'SƯỢT LÀM NÓ ĐAU!'), ARCH_GOLD, 13);
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
  mimic,
  dynamo,
  chronos,
  hydra,
  leviathan,
  beacon,
  cipher,
  metronome,
  marionette,
  fractal,
  blight,
  deadeye,
  siege,
  breaker,
  architect,
};

/** Shared with the renderer. */
export { TWIN_NAMES, MIRROR_ABSORB, polColor, leviMode };
export { BEAM_HALF, beaconBeams, CIPHER_COLORS, CIPHER_GLYPHS, CIPHER_PRESS, BEAT_WINDOW, beatLen, FRACTAL_R };
export { BLIGHT_COLS, BLIGHT_ROWS, blightGrid, blightLayout, SNIPE_LOCK, RELAY_COVER, BRICK_COLS, BRICK_COLORS, BALL_R, brickLayout, archRule };
