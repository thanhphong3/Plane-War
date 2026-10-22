import {
  BossEntity,
  BulletEntity,
  GemEntity,
  HazardEntity,
  LaserEntity,
  PowerupEntity,
  StarEntity,
} from '../types/game';
import { canvasFont, getLang, tr } from '../i18n';
import type { LevelTheme } from './campaign';
import { MINE_TRIGGER_RADIUS, SHIELD_ARC } from './enemies';

type Ctx = CanvasRenderingContext2D;

/** Comfort options the draw calls honour (set from the player's Settings). */
export const fxPrefs = { reduceFlash: false };

// ---------------------------------------------------------------------------
// Color helpers & cached glow sprites (additive blending is far cheaper than
// shadowBlur on mobile GPUs)
// ---------------------------------------------------------------------------
// Hot path (every bullet / particle / frame): parse each hex once, then only concat the alpha.
const rgbaPrefix = new Map<string, string>();
export function hexToRgba(hex: string, a: number): string {
  let pre = rgbaPrefix.get(hex);
  if (pre === undefined) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    pre = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, `;
    if (rgbaPrefix.size > 512) rgbaPrefix.clear();
    rgbaPrefix.set(hex, pre);
  }
  return pre + a + ')';
}

const glowCache = new Map<string, HTMLCanvasElement>();
const GLOW_CACHE_MAX = 192;

function getGlow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  // Bounded: blended colours (biome cross-fades) must never grow this without limit
  if (glowCache.size >= GLOW_CACHE_MAX) {
    const oldest = glowCache.keys().next().value;
    if (oldest !== undefined) glowCache.delete(oldest);
  }
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, hexToRgba(color, 1));
  grad.addColorStop(0.22, hexToRgba(color, 0.6));
  grad.addColorStop(0.55, hexToRgba(color, 0.16));
  grad.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

/** Draws an additive soft glow centred on (x, y). */
export function drawGlow(ctx: Ctx, x: number, y: number, radius: number, color: string, alpha = 1) {
  if (alpha <= 0 || radius <= 0) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(getGlow(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevA;
}

function mirrorPoly(ctx: Ctx, pts: number[][], r: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * r, pts[0][1] * r);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * r, pts[i][1] * r);
  for (let i = pts.length - 2; i > 0; i--) ctx.lineTo(-pts[i][0] * r, pts[i][1] * r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Player ships — drawn at the origin pointing up (-y)
// ---------------------------------------------------------------------------
const SHIP_HULLS: Record<string, number[][]> = {
  striker: [[0, -1.45], [0.28, -0.35], [1.25, 0.72], [1.1, 0.88], [0.38, 0.55], [0, 0.78]],
  phantom: [[0, -1.65], [0.2, -0.65], [0.34, -0.05], [1.25, -0.42], [1.05, 0.3], [0.38, 0.62], [0, 0.5]],
  phoenix: [[0, -1.3], [0.28, -0.5], [0.72, -0.18], [1.55, 0.05], [1.3, 0.5], [0.82, 0.42], [0.46, 0.88], [0, 0.6]],
  vortex: [[0, -1.35], [0.38, -0.45], [0.52, 0.45], [0.3, 0.78], [0, 0.7]],
  sovereign: [[0, -1.55], [0.2, -0.72], [0.56, -1.12], [0.62, -0.3], [1.35, 0.5], [1.12, 0.92], [0.42, 0.6], [0, 0.92]],
};

const WING_TIPS: Record<string, [number, number]> = {
  striker: [1.18, 0.8],
  phantom: [1.2, -0.38],
  phoenix: [1.5, 0.1],
  vortex: [1.05, 0.15],
  sovereign: [1.25, 0.72],
};

export function drawShip(
  ctx: Ctx,
  shipId: string,
  r: number,
  color: string,
  secondary: string,
  t: number,
  thrust = 1
) {
  const hull = SHIP_HULLS[shipId] || SHIP_HULLS.striker;

  // Engine flame (additive)
  const flick = 0.75 + Math.sin(t * 46) * 0.15 + Math.random() * 0.1;
  const flameLen = r * (0.9 + thrust * 0.9) * flick;
  const engines = shipId === 'phoenix' || shipId === 'sovereign' ? [-0.32, 0.32] : [0];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ex of engines) {
    const x = ex * r;
    const y0 = r * 0.6;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + flameLen);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, hexToRgba(color, 0.85));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.24, y0);
    ctx.quadraticCurveTo(x, y0 + flameLen * 1.1, x + r * 0.24, y0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawGlow(ctx, 0, r * 0.7, r * 1.4, color, 0.55);

  // Quantum ring
  if (shipId === 'vortex') {
    ctx.save();
    ctx.rotate(t * 2.2);
    ctx.strokeStyle = hexToRgba(color, 0.85);
    ctx.lineWidth = 2;
    ctx.setLineDash([r * 0.5, r * 0.3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Hull
  const hullGrad = ctx.createLinearGradient(-r, -r, r, r);
  hullGrad.addColorStop(0, color);
  hullGrad.addColorStop(1, secondary);
  ctx.fillStyle = hullGrad;
  mirrorPoly(ctx, hull, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Panel shading on the left half for depth
  ctx.save();
  mirrorPoly(ctx, hull, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.fillRect(-r * 2, -r * 2, r * 2, r * 4);
  ctx.strokeStyle = hexToRgba('#ffffff', 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(0, r * 0.7);
  ctx.stroke();
  ctx.restore();

  // Cockpit canopy
  const cg = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.2);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(1, hexToRgba(color, 0.6));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.32, r * 0.2, r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Blinking wing-tip lights
  const tip = WING_TIPS[shipId] || WING_TIPS.striker;
  const blink = Math.sin(t * 6) > 0 ? 1 : 0.35;
  drawGlow(ctx, tip[0] * r, tip[1] * r, r * 0.45, '#ffffff', blink * 0.8);
  drawGlow(ctx, -tip[0] * r, tip[1] * r, r * 0.45, '#ffffff', blink * 0.8);
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------
/** Bends the background grid around a point (boss gravity, Dash shockwave). */
export interface GridWell {
  x: number;
  y: number;
  /** Falloff radius in px. */
  r: number;
  /** Pull strength: 0..0.45 pinches inward, negative pushes outward. */
  s: number;
}

const NEBULAE = [
  { x: 0.2, y: 0.15, r: 0.65, color: '#7c3aed', speed: 6 },
  { x: 0.85, y: 0.55, r: 0.55, color: '#0891b2', speed: 9 },
  { x: 0.4, y: 0.9, r: 0.6, color: '#db2777', speed: 7 },
];

export function drawBackground(
  ctx: Ctx,
  W: number,
  H: number,
  t: number,
  gridOffsetY: number,
  stars: StarEntity[],
  fever: boolean,
  boss: boolean,
  warp: number,
  theme?: LevelTheme,
  wells?: GridWell[]
) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (fever) {
    bg.addColorStop(0, '#1f0726');
    bg.addColorStop(1, '#0a0418');
  } else if (theme) {
    bg.addColorStop(0, theme.top);
    bg.addColorStop(1, theme.bottom);
  } else if (boss) {
    bg.addColorStop(0, '#1a0410');
    bg.addColorStop(1, '#070514');
  } else {
    bg.addColorStop(0, '#03030c');
    bg.addColorStop(1, '#0a0f26');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Drifting nebula clouds
  const big = Math.max(W, H);
  NEBULAE.forEach((n, i) => {
    const span = H + big * n.r * 2;
    const y = ((n.y * H + t * n.speed) % span) - big * n.r;
    const x = n.x * W + Math.sin(t * 0.07 + n.speed) * 40;
    const col = fever ? '#f43f5e' : theme ? theme.nebula[i] : boss ? '#be123c' : n.color;
    drawGlow(ctx, x, y, big * n.r, col, 0.22);
  });

  // Grid floor, fading towards the top
  const gridColor = fever ? '#f43f5e' : theme ? theme.grid : boss ? '#fb7185' : '#22d3ee';
  const gridGrad = ctx.createLinearGradient(0, 0, 0, H);
  gridGrad.addColorStop(0, hexToRgba(gridColor, 0));
  gridGrad.addColorStop(0.55, hexToRgba(gridColor, fever ? 0.1 : 0.05));
  gridGrad.addColorStop(1, hexToRgba(gridColor, fever ? 0.22 : 0.14));
  ctx.strokeStyle = gridGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cell = 52;
  const xOff = (W % cell) / 2;
  if (!wells || wells.length === 0) {
    for (let x = xOff; x < W; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = gridOffsetY - cell; y < H; y += cell) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
  } else {
    // Gravity wells bend the grid: positive strength pinches it in, negative bulges it out
    const step = 26;
    let px = 0;
    let py = 0;
    const warpPoint = (x: number, y: number) => {
      px = x;
      py = y;
      for (let k = 0; k < wells.length; k++) {
        const w = wells[k];
        const dx = w.x - x;
        const dy = w.y - y;
        const f = w.s * Math.exp(-(dx * dx + dy * dy) / (w.r * w.r));
        px += dx * f;
        py += dy * f;
      }
    };
    for (let x = xOff; x < W; x += cell) {
      warpPoint(x, 0);
      ctx.moveTo(px, py);
      for (let y = step; y <= H + step; y += step) {
        warpPoint(x, y);
        ctx.lineTo(px, py);
      }
    }
    for (let y = gridOffsetY - cell; y < H; y += cell) {
      warpPoint(0, y);
      ctx.moveTo(px, py);
      for (let x = step; x <= W + step; x += step) {
        warpPoint(x, y);
        ctx.lineTo(px, py);
      }
    }
  }
  ctx.stroke();

  // Stars (streak into lines when warping)
  ctx.lineCap = 'round';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const a = s.alpha * (0.75 + Math.sin(t * 2 + i) * 0.25);
    if (warp > 0.05 && s.layer > 0) {
      ctx.strokeStyle = `rgba(226, 232, 240, ${a})`;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y - s.speed * 0.06 * warp * (1 + s.layer));
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(226, 232, 240, ${a})`;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
  }
}

let vignetteCanvas: HTMLCanvasElement | null = null;
let vignetteKey = '';

export function drawVignette(ctx: Ctx, W: number, H: number) {
  const key = `${W}x${H}`;
  if (!vignetteCanvas || vignetteKey !== key) {
    vignetteCanvas = document.createElement('canvas');
    vignetteCanvas.width = Math.max(1, Math.floor(W / 2));
    vignetteCanvas.height = Math.max(1, Math.floor(H / 2));
    const g = vignetteCanvas.getContext('2d')!;
    const w = vignetteCanvas.width;
    const h = vignetteCanvas.height;
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    vignetteKey = key;
  }
  ctx.drawImage(vignetteCanvas, 0, 0, W, H);
}

/** Darkness everywhere except a pool of light around the pilot (Ghost Net). */
export function drawFog(ctx: Ctx, W: number, H: number, px: number, py: number, radius: number, t: number) {
  const r = radius * (1 + Math.sin(t * 2) * 0.03);
  const g = ctx.createRadialGradient(px, py, r * 0.35, px, py, r);
  g.addColorStop(0, 'rgba(3, 1, 12, 0)');
  g.addColorStop(1, 'rgba(3, 1, 12, 0.8)');
  ctx.fillStyle = g;
  // Overscan so screen shake never reveals an unfogged edge
  ctx.fillRect(-60, -60, W + 120, H + 120);
}

// ---------------------------------------------------------------------------
// Visual grammar — the player should never have to memorise colours:
//   COLLECT  gold / white-rimmed, soft shapes, sparkles, rings that pull INWARD
//   DODGE    every harmful thing carries a red danger rim and flares red up close
//   DASH IT  cyan dashed target ring (plasma cores you can parry)
// ---------------------------------------------------------------------------
export const DANGER = '#ff2d55';
export const DASH_CUE = '#67e8f9';
/** Elite enemies wear gold. */
export const ELITE = '#facc15';

/** Proximity alarm strength (0..1) for a hazard of radius r at distance d. */
function nearness(d: number, r: number, range: number): number {
  return Math.max(0, Math.min(1, 1 - (d - r) / range));
}

/** Four-point twinkle used only on collectibles. */
function sparkle(ctx: Ctx, x: number, y: number, s: number, alpha: number) {
  if (alpha <= 0 || s <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
export function drawGem(ctx: Ctx, g: GemEntity, t: number) {
  const big = g.val > 1;
  // Collectibles stay in the gold family — never the pinks/reds used by enemies
  const color = big ? '#fde047' : '#fbbf24';
  drawGlow(ctx, g.x, g.y, g.r * (big ? 3.8 : 3), color, big ? 0.9 : 0.7);
  ctx.save();
  ctx.translate(g.x, g.y);
  const sx = Math.cos(g.spin + t * 3);
  const w = g.r * 0.85 * Math.max(0.18, Math.abs(sx));
  ctx.beginPath();
  ctx.moveTo(0, -g.r);
  ctx.lineTo(w, -g.r * 0.15);
  ctx.lineTo(0, g.r);
  ctx.lineTo(-w, -g.r * 0.15);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Crisp white edge: friendly items are outlined in white, hazards in red
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Bright facet
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.moveTo(0, -g.r);
  ctx.lineTo(sx > 0 ? w : -w, -g.r * 0.15);
  ctx.lineTo(0, -g.r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Twinkle
  const tw = Math.sin(t * 5 + g.id * 1.7);
  if (tw > 0.55) sparkle(ctx, g.x + g.r * 0.7, g.y - g.r * 0.75, 2 + g.r * 0.6 * ((tw - 0.55) / 0.45), 1);
  if (big) {
    for (let k = 0; k < 2; k++) {
      const a = t * 3 + k * Math.PI + g.id;
      sparkle(ctx, g.x + Math.cos(a) * g.r * 1.7, g.y + Math.sin(a) * g.r * 1.7, 3.2, 0.9);
    }
  }
}

function drawPowerGlyph(ctx: Ctx, kind: PowerupEntity['kind'], s: number) {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'shield') {
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.85, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.8, s * 0.55, 0, s);
    ctx.quadraticCurveTo(-s * 0.8, s * 0.55, -s * 0.85, -s * 0.6);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'magnet') {
    ctx.arc(0, -s * 0.05, s * 0.62, Math.PI, 0, true);
    ctx.moveTo(s * 0.62, -s * 0.05);
    ctx.lineTo(s * 0.62, -s * 0.8);
    ctx.moveTo(-s * 0.62, -s * 0.05);
    ctx.lineTo(-s * 0.62, -s * 0.8);
    ctx.lineWidth = 3.4;
    ctx.stroke();
  } else if (kind === 'slow') {
    ctx.moveTo(-s * 0.6, -s * 0.85);
    ctx.lineTo(s * 0.6, -s * 0.85);
    ctx.lineTo(-s * 0.6, s * 0.85);
    ctx.lineTo(s * 0.6, s * 0.85);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'key') {
    ctx.arc(0, -s * 0.45, s * 0.42, 0, Math.PI * 2);
    ctx.moveTo(0, -s * 0.03);
    ctx.lineTo(0, s);
    ctx.moveTo(0, s * 0.55);
    ctx.lineTo(s * 0.4, s * 0.55);
    ctx.moveTo(0, s * 0.85);
    ctx.lineTo(s * 0.3, s * 0.85);
    ctx.stroke();
  } else if (kind === 'power') {
    // Double chevron: "level up"
    for (const oy of [-s * 0.45, s * 0.25]) {
      ctx.moveTo(-s * 0.7, oy + s * 0.45);
      ctx.lineTo(0, oy - s * 0.2);
      ctx.lineTo(s * 0.7, oy + s * 0.45);
    }
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.arc(-s * 0.1, s * 0.15, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.35);
    ctx.lineTo(s * 0.7, -s * 0.85);
    ctx.stroke();
  }
}

const POWER_LABELS: Record<PowerupEntity['kind'], string> = {
  shield: 'SHIELD',
  magnet: 'MAGNET',
  slow: 'SLOW-MO',
  bomb: '+EMP',
  key: 'ROOT KEY',
  power: 'POWER',
};

const POWER_LABELS_VI: Record<PowerupEntity['kind'], string> = {
  shield: 'KHIÊN',
  magnet: 'NAM CHÂM',
  slow: 'CHẬM',
  bomb: '+EMP',
  key: 'KHÓA GỐC',
  power: 'HỎA LỰC',
};

export function drawPowerup(ctx: Ctx, p: PowerupEntity, t: number) {
  const arming = !!p.armTime && p.armTime > 0;
  const y = p.y + Math.sin(p.pulse * 0.6) * 3; // gentle bob: pickups float, hazards don't
  const r = p.r;
  drawGlow(ctx, p.x, y, r * 3.2, p.color, 0.7);
  ctx.save();
  // Still arming: shown faded so it reads as "not yet"
  if (arming) ctx.globalAlpha = 0.35 + Math.sin(t * 20) * 0.15;
  ctx.translate(p.x, y);

  // "Come get me": rings that shrink INTO the item (hazard warnings expand outward)
  if (!arming) {
    for (const k of [0, 0.5]) {
      const ph = (t * 1.1 + k + p.id * 0.13) % 1;
      ctx.strokeStyle = hexToRgba(p.color, ph * 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4 + (1 - ph) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Soft round bubble with a white rim — a shape no enemy uses
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.4, hexToRgba(p.color, 0.5));
  g.addColorStop(1, hexToRgba(p.color, 0.22));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  // Glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.48, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();

  drawPowerGlyph(ctx, p.kind, r * 0.5);

  // Name tag so new pilots know what they're grabbing
  ctx.font = `800 9px ${canvasFont()}`;
  const powerLabel = (getLang() === 'vi' ? POWER_LABELS_VI : POWER_LABELS)[p.kind];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(2,6,23,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText(powerLabel, 0, r + 13);
  ctx.fillStyle = p.color;
  ctx.fillText(powerLabel, 0, r + 13);
  ctx.restore();

  if (!arming) {
    const tw = Math.sin(t * 4 + p.id);
    if (tw > 0.5) sparkle(ctx, p.x + r * 0.75, y - r * 0.8, 2 + 4 * ((tw - 0.5) / 0.5), 1);
  }
}

export function drawHazard(ctx: Ctx, h: HazardEntity, t: number, px: number, py: number) {
  const flash = (h.hitFlash || 0) > 0;

  const near = nearness(Math.hypot(px - h.x, py - h.y), h.r, h.type === 'shot' ? 110 : 120);

  if (h.type === 'shot') {
    // Ghost shots fade almost out of sight, then flare back
    const a = h.ghost ? 0.12 + 0.88 * Math.abs(Math.sin(t * 2.6 + h.id * 0.7)) : 1;
    // Proximity alarm: the closer it gets to the pilot, the redder it burns
    // (polarity shots skip it: half of them are harmless, their colour is the warning)
    if (near > 0 && !h.pol) drawGlow(ctx, h.x, h.y, h.r * (3 + near * 2.5), DANGER, 0.6 * near);
    drawGlow(ctx, h.x, h.y, h.r * 3, h.color, 0.8 * a);
    ctx.fillStyle = hexToRgba(h.color, a);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // Universal danger rim — stays faintly visible even on ghost shots, so they're fair
    ctx.strokeStyle = h.pol ? h.color : hexToRgba(DANGER, Math.max(0.35, a));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    if (h.pol) {
      // Blue = hollow diamond, red = solid square: readable without colour vision
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Math.PI / 4);
      const s = h.r * 1.5;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      if (h.pol > 0) ctx.strokeRect(-s / 2, -s / 2, s, s);
      else {
        ctx.fillStyle = hexToRgba(h.color, 0.55);
        ctx.fillRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
    if (h.glitch !== undefined) {
      ctx.strokeStyle = hexToRgba(h.color, 0.8);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    return;
  }

  if (h.type === 'orb') {
    // Plasma core: big, slow, deflectable
    const fuse = h.fuse ?? 5;
    const urgent = !h.reflected && fuse < 1.5 && (fxPrefs.reduceFlash ? fuse < 0.6 : Math.sin(t * 30) > 0);
    const col = h.reflected ? '#22d3ee' : h.color;
    drawGlow(ctx, h.x, h.y, h.r * 3.4, col, 0.85);
    ctx.save();
    ctx.translate(h.x, h.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, urgent ? '#ffffff' : h.reflected ? '#67e8f9' : '#fde047');
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * (1 + Math.sin(t * 12) * 0.06), 0, Math.PI * 2);
    ctx.fill();
    if (!h.reflected) {
      // Red rim: touching it normally still hurts
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, h.r, 0, Math.PI * 2);
      ctx.stroke();
      // Cyan target reticle: the "dash into me" cue, tightening as the pilot approaches
      const tight = h.r + 8 + (1 - near) * 6 + Math.sin(t * 8) * 2;
      ctx.save();
      ctx.rotate(t * 3);
      ctx.strokeStyle = DASH_CUE;
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, tight, -0.45, 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    if (!h.reflected) {
      ctx.save();
      ctx.font = `800 10px ${canvasFont()}`;
      const dashLabel = tr('DASH INTO IT', 'LƯỚT VÀO');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(2,6,23,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(dashLabel, h.x, h.y + h.r + 20);
      ctx.fillStyle = DASH_CUE;
      ctx.fillText(dashLabel, h.x, h.y + h.r + 20);
      ctx.restore();
    }
    return;
  }

  // Sniper sight: tracks the pilot (dashed), then locks (solid, flaring) just before it fires
  if (h.type === 'sniper' && (h.aimTimer || 0) > 0) {
    const locked = (h.aimTimer || 0) < 0.4;
    const len = 2000;
    ctx.save();
    ctx.strokeStyle = hexToRgba(DANGER, locked ? (fxPrefs.reduceFlash ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(t * 30))) : 0.4);
    ctx.lineWidth = locked ? 2.5 : 1.2;
    if (!locked) {
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -t * 80;
    }
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + Math.cos(h.angle) * len, h.y + Math.sin(h.angle) * len);
    ctx.stroke();
    ctx.restore();
  }
  // Kamikaze: faint lock-on line while it winds up
  if (h.type === 'kamikaze' && !h.lunging) {
    ctx.save();
    ctx.strokeStyle = hexToRgba(DANGER, 0.25 + 0.2 * Math.sin(t * 12));
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.restore();
  }

  // Proximity alarm for bodies: a red dashed ring that firms up as they close in
  if (near > 0) {
    drawGlow(ctx, h.x, h.y, h.r * 3.2, DANGER, 0.35 * near);
    ctx.save();
    ctx.strokeStyle = hexToRgba(DANGER, 0.85 * near);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawGlow(ctx, h.x, h.y, h.r * 2.6, h.color, 0.55);
  if (h.elite) {
    // Elite: golden halo and a spinning crown of studs
    drawGlow(ctx, h.x, h.y, h.r * 3.4, ELITE, 0.4);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = hexToRgba(ELITE, 0.9);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, h.r + 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ELITE;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (h.r + 11), Math.sin(a) * (h.r + 11), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(h.x, h.y);

  if (h.type === 'shielder') {
    // Bulwark: armoured octagon with an energy shield wrapped around its underside
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * h.r * 0.9, Math.sin(a) * h.r * 0.9);
    }
    ctx.closePath();
    const bg = ctx.createRadialGradient(0, -h.r * 0.3, 2, 0, 0, h.r);
    bg.addColorStop(0, '#1d4ed8');
    bg.addColorStop(1, '#0b1a3d');
    ctx.fillStyle = flash ? '#ffffff' : bg;
    ctx.fill();
    ctx.strokeStyle = h.elite ? ELITE : DANGER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(0, -h.r * 0.15, h.r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    // The shield: a bright arc facing the pilot, so "shoot from the side" reads at a glance
    const pulse = 0.75 + 0.25 * Math.sin(t * 6 + h.id);
    const a0 = Math.PI / 2 - SHIELD_ARC;
    const a1 = Math.PI / 2 + SHIELD_ARC;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexToRgba(h.color, 0.35 * pulse);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, h.r + 7, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba('#e0f2fe', 0.95 * pulse);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  } else if (h.type === 'mender') {
    // Mender: a slowly turning halo around a medic cross
    ctx.save();
    ctx.rotate(h.angle);
    ctx.strokeStyle = hexToRgba(h.color, 0.8);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, h.r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = flash ? '#ffffff' : '#052e16';
    ctx.strokeStyle = h.elite ? ELITE : DANGER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const beat = 0.85 + 0.15 * Math.sin(t * 5 + h.id);
    ctx.fillStyle = h.color;
    const arm = h.r * 0.55 * beat;
    const w = h.r * 0.3;
    ctx.fillRect(-w / 2, -arm, w, arm * 2);
    ctx.fillRect(-arm, -w / 2, arm * 2, w);
  } else if (h.type === 'bomber') {
    // Bomber: a flying wing pointing the way it travels, bomb-bay light blinking
    ctx.rotate(h.vx >= 0 ? 0 : Math.PI);
    ctx.beginPath();
    ctx.moveTo(h.r * 1.2, 0);
    ctx.lineTo(-h.r * 0.6, -h.r * 1.25);
    ctx.lineTo(-h.r * 0.25, 0);
    ctx.lineTo(-h.r * 0.6, h.r * 1.25);
    ctx.closePath();
    const wg = ctx.createLinearGradient(h.r, 0, -h.r, 0);
    wg.addColorStop(0, '#99f6e4');
    wg.addColorStop(1, '#0f766e');
    ctx.fillStyle = flash ? '#ffffff' : wg;
    ctx.fill();
    ctx.strokeStyle = h.elite ? ELITE : DANGER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = Math.sin(t * 10 + h.id) > 0 ? '#fca5a5' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(h.r * 0.1, 0, h.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'mine') {
    const armed = (h.aimTimer || 0) <= 0;
    // Blast radius: faint while armed, flaring once the fuse is lit
    if (armed) {
      ctx.save();
      const hot = h.triggered && (fxPrefs.reduceFlash || Math.sin(t * 40) > 0);
      ctx.strokeStyle = hexToRgba(DANGER, h.triggered ? (hot ? 0.75 : 0.35) : 0.16);
      ctx.lineWidth = h.triggered ? 2 : 1;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.arc(0, 0, MINE_TRIGGER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.rotate(h.angle);
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * h.r * 0.7, Math.sin(a) * h.r * 0.7);
      ctx.lineTo(Math.cos(a) * h.r * 1.25, Math.sin(a) * h.r * 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#ffffff' : '#450a0a';
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const lit = h.triggered ? Math.sin(t * 40) > 0 : armed ? Math.sin(t * 6 + h.id) > 0 : false;
    ctx.fillStyle = lit ? '#ffffff' : '#991b1b';
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'splitter') {
    // Cracked hexagon: reads as "this one breaks apart"
    ctx.rotate(h.angle);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * h.r, Math.sin(a) * h.r);
    }
    ctx.closePath();
    const sg = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r);
    sg.addColorStop(0, '#ddd6fe');
    sg.addColorStop(1, h.color);
    ctx.fillStyle = flash ? '#ffffff' : sg;
    ctx.fill();
    ctx.strokeStyle = h.elite ? ELITE : DANGER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-h.r * 0.15, -h.r * 0.95);
    ctx.lineTo(h.r * 0.12, -h.r * 0.2);
    ctx.lineTo(-h.r * 0.1, h.r * 0.3);
    ctx.lineTo(h.r * 0.12, h.r * 0.95);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-h.r * 0.45, 0, 2.5, 0, Math.PI * 2);
    ctx.arc(h.r * 0.45, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'sniper') {
    // Long-barrel platform that turns with its sight line
    ctx.rotate(h.angle);
    ctx.fillStyle = flash ? '#ffffff' : '#1e1b4b';
    ctx.strokeStyle = h.elite ? ELITE : h.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(h.r, 0);
    ctx.lineTo(-h.r * 0.6, -h.r * 0.85);
    ctx.lineTo(-h.r, 0);
    ctx.lineTo(-h.r * 0.6, h.r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(h.r * 0.2, -2.5, h.r * 1.5, 5);
    const charge = (h.aimTimer || 0) > 0 ? 1 - Math.min(1, (h.aimTimer || 0) / 1.2) : 0;
    drawGlow(ctx, h.r * 1.7, 0, 6 + charge * 12, DANGER, 0.3 + charge * 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'kamikaze') {
    // Arrowhead that points where it is about to go
    ctx.rotate(h.angle);
    const wind = h.lunging ? 1 : 0.85 + 0.15 * Math.sin(t * 24);
    if (h.lunging) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fl = h.r * (2 + Math.random());
      const fg = ctx.createLinearGradient(-h.r, 0, -h.r - fl, 0);
      fg.addColorStop(0, 'rgba(255,255,255,0.9)');
      fg.addColorStop(1, hexToRgba(h.color, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-h.r * 0.7, -h.r * 0.45);
      ctx.lineTo(-h.r - fl, 0);
      ctx.lineTo(-h.r * 0.7, h.r * 0.45);
      ctx.fill();
      ctx.restore();
    }
    ctx.scale(wind, wind);
    ctx.fillStyle = flash ? '#ffffff' : h.color;
    ctx.beginPath();
    ctx.moveTo(h.r * 1.3, 0);
    ctx.lineTo(-h.r, -h.r);
    ctx.lineTo(-h.r * 0.4, 0);
    ctx.lineTo(-h.r, h.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = h.elite ? ELITE : DANGER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = h.lunging || Math.sin(t * 20) > 0 ? '#ffffff' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(h.r * 0.2, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'spinner') {
    ctx.rotate(h.angle);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.strokeStyle = hexToRgba(h.color, 0.45);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(h.r, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffe4f1';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'seeker') {
    ctx.rotate(h.angle);
    // Thruster
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = h.r * (1.2 + Math.random() * 0.5);
    const fg = ctx.createLinearGradient(-h.r * 0.5, 0, -h.r * 0.5 - fl, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0.9)');
    fg.addColorStop(0.4, hexToRgba(h.color, 0.8));
    fg.addColorStop(1, hexToRgba(h.color, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-h.r * 0.5, -h.r * 0.3);
    ctx.lineTo(-h.r * 0.5 - fl, 0);
    ctx.lineTo(-h.r * 0.5, h.r * 0.3);
    ctx.fill();
    ctx.restore();

    const g = ctx.createLinearGradient(h.r, 0, -h.r, 0);
    g.addColorStop(0, '#fed7aa');
    g.addColorStop(1, h.color);
    ctx.fillStyle = flash ? '#ffffff' : g;
    ctx.beginPath();
    ctx.moveTo(h.r + 5, 0);
    ctx.lineTo(-h.r, -h.r * 0.8);
    ctx.lineTo(-h.r * 0.45, 0);
    ctx.lineTo(-h.r, h.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Blinking eye
    const blink = Math.sin(t * 14 + h.id) > 0;
    ctx.fillStyle = blink ? '#ffffff' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(h.r * 0.25, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'turret') {
    // Spiked diamond gun platform — angular on purpose, so it never reads as a round pickup
    ctx.save();
    ctx.rotate(Math.PI / 4 + Math.sin(t * 1.5) * 0.15);
    ctx.beginPath();
    const s = h.r * 0.82;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const b = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a) * h.r * 1.25, Math.sin(a) * h.r * 1.25);
      ctx.lineTo(Math.cos(b) * s, Math.sin(b) * s);
    }
    ctx.closePath();
    const tg = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r);
    tg.addColorStop(0, '#450a0a');
    tg.addColorStop(1, '#1c0606');
    ctx.fillStyle = flash ? '#ffffff' : tg;
    ctx.fill();
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    const aim = Math.atan2(py - h.y, px - h.x);
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(0, -3.5, h.r + 8, 7);
    ctx.restore();
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Spiked drone mine
    ctx.rotate(h.angle);
    const spikes = 6;
    ctx.beginPath();
    for (let s = 0; s < spikes * 2; s++) {
      const rad = s % 2 === 0 ? h.r : h.r * 0.58;
      const a = (s * Math.PI) / spikes;
      if (s === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    const dg = ctx.createRadialGradient(0, 0, 1, 0, 0, h.r);
    dg.addColorStop(0, '#fda4af');
    dg.addColorStop(1, h.color);
    ctx.fillStyle = flash ? '#ffffff' : dg;
    ctx.fill();
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    const pulse = 0.6 + Math.sin(t * 8 + h.id) * 0.4;
    ctx.fillStyle = `rgba(255, 80, 110, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Mender ward: a green hex cage that bullets glance off
  if (h.warded) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(-t * 1.2);
    ctx.strokeStyle = hexToRgba('#86efac', 0.55 + 0.25 * Math.sin(t * 8 + h.id));
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * (h.r + 8), Math.sin(a) * (h.r + 8));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // HP pips for anything that takes more than one hit
  const maxHp = h.maxHp || 0;
  if (maxHp > 1) {
    const hp = Math.max(0, Math.ceil(h.hp || 0));
    const pip = Math.min(7, Math.max(3, (h.r * 2.2) / maxHp - 2));
    const total = maxHp * (pip + 2) - 2;
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? (h.elite ? ELITE : '#fca5a5') : 'rgba(51, 65, 85, 0.8)';
      ctx.fillRect(h.x - total / 2 + i * (pip + 2), h.y + h.r + (h.elite ? 16 : 6), pip, 3);
    }
  }
}

/**
 * Dash coach marker: cyan corner brackets locking onto an enemy plus a "DASH!" tag,
 * so new pilots learn that this is something to ram, not just dodge.
 * Plasma cores already carry their own "DASH INTO IT" cue.
 */
export function drawDashHint(ctx: Ctx, h: HazardEntity, t: number) {
  if (h.type === 'orb') return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);
  const s = h.r + 10 + pulse * 4;
  const arm = Math.max(7, h.r * 0.5);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.strokeStyle = DASH_CUE;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-s, -s + arm);
    ctx.lineTo(-s, -s);
    ctx.lineTo(-s + arm, -s);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `900 11px ${canvasFont()}`;
  const dashLabel = tr('DASH!', 'LƯỚT!');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.75 + pulse * 0.25;
  ctx.strokeStyle = 'rgba(2,6,23,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText(dashLabel, h.x, h.y - s - 10);
  ctx.fillStyle = DASH_CUE;
  ctx.fillText(dashLabel, h.x, h.y - s - 10);
  ctx.restore();
}

export function drawLaser(ctx: Ctx, l: LaserEntity, W: number, H: number, t: number) {
  if (l.orient === 'h') {
    // Rotated frame: local (u, v) -> screen (v, row - u), so a column at u = 0
    // with length W becomes the full-width row centred on l.x
    ctx.save();
    ctx.translate(0, l.x);
    ctx.rotate(-Math.PI / 2);
    drawLaser(ctx, { ...l, orient: 'v', x: 0 }, H, W, t);
    ctx.restore();
    return;
  }
  const half = l.width / 2;
  if (l.warnTime > 0) {
    // Telegraph: flashing danger column
    const blink = fxPrefs.reduceFlash ? 0.8 : Math.sin(t * 28) > 0 ? 1 : 0.45;
    ctx.fillStyle = `rgba(244, 63, 94, ${0.07 * blink + 0.03})`;
    ctx.fillRect(l.x - half, 0, l.width, H);
    ctx.strokeStyle = `rgba(251, 113, 133, ${0.65 * blink})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath();
    ctx.moveTo(l.x - half, 0);
    ctx.lineTo(l.x - half, H);
    ctx.moveTo(l.x + half, 0);
    ctx.lineTo(l.x + half, H);
    ctx.stroke();
    ctx.setLineDash([]);
    // Warning chevron
    ctx.save();
    ctx.translate(l.x, Math.max(150, H * 0.3));
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 10);
    ctx.lineTo(-13, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = "900 15px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 3);
    ctx.restore();
  } else if (l.fireTime > 0) {
    const w = l.width * (0.75 + Math.random() * 0.25);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(l.x - w, 0, l.x + w, 0);
    g.addColorStop(0, 'rgba(244,63,94,0)');
    g.addColorStop(0.3, 'rgba(244,63,94,0.55)');
    g.addColorStop(0.45, 'rgba(255,228,240,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,228,240,0.95)');
    g.addColorStop(0.7, 'rgba(244,63,94,0.55)');
    g.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - w, 0, w * 2, H);
    ctx.restore();
  }
}

export function drawBoss(ctx: Ctx, b: BossEntity, t: number) {
  const flash = b.hitFlash > 0;
  const rage = b.hp / b.maxHp < 0.4;
  const core = rage ? '#f43f5e' : '#e879f9';
  drawGlow(ctx, b.x, b.y, b.r * 2.8, core, 0.6 + Math.sin(t * 4) * 0.15);

  ctx.save();
  ctx.translate(b.x, b.y);

  // Rotating armour plates
  ctx.save();
  ctx.rotate(b.angle);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(b.r * 0.62, -b.r * 0.32);
    ctx.lineTo(b.r * 1.02, -b.r * 0.42);
    ctx.lineTo(b.r * 1.1, 0);
    ctx.lineTo(b.r * 1.02, b.r * 0.42);
    ctx.lineTo(b.r * 0.62, b.r * 0.32);
    ctx.closePath();
    ctx.fillStyle = flash ? '#4c1d95' : '#1e1b4b';
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = hexToRgba(core, 0.8 + Math.sin(t * 10 + i) * 0.2);
    ctx.fillRect(b.r * 0.92, -2, 6, 4);
  }
  ctx.restore();

  // Counter-rotating inner ring
  ctx.save();
  ctx.rotate(-b.angle * 1.6);
  ctx.strokeStyle = hexToRgba(core, 0.9);
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Core orb
  const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, b.r * 0.45);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.35, core);
  cg.addColorStop(1, '#3b0764');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.42 * (1 + Math.sin(t * 6) * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  if (flash) drawGlow(ctx, b.x, b.y, b.r * 1.1, '#ffffff', 0.35);
}

// ---------------------------------------------------------------------------
// Player weapons — one silhouette per signature round, all drawn additively
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;

/** Draws one player bullet pointing along its velocity, with a glowing tail. */
export function drawBullet(ctx: Ctx, b: BulletEntity, t: number) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2); // local -y = forward
  switch (b.kind) {
    case 'fireball': {
      const flick = 0.85 + Math.sin(t * 40 + b.id) * 0.15;
      const core = b.fever ? '#fbbf24' : '#fb923c';
      ctx.fillStyle = hexToRgba('#ef4444', 0.45);
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.quadraticCurveTo(0, 38 * flick, 8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToRgba(core, 0.7);
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(0, 24 * flick, 5, 0);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 22 * flick, core, 0.85);
      drawGlow(ctx, 0, 0, 10, '#fde047', 0.9);
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(0, 0, 4.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'rail': {
      const len = 40;
      drawGlow(ctx, 0, 8, 18, b.color, 0.5);
      ctx.fillStyle = hexToRgba(b.color, 0.35);
      ctx.fillRect(-3.5, -12, 7, len + 12);
      ctx.fillStyle = hexToRgba(b.color, 0.8);
      ctx.fillRect(-2, -12, 4, len * 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.9, -14, 1.8, len * 0.6);
      // Phase rings sliding down the beam
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const ry = -8 + ((t * 160 + b.id * 7 + k * 14) % 28);
        ctx.beginPath();
        ctx.ellipse(0, ry, 5.5, 1.6, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'homing': {
      ctx.strokeStyle = hexToRgba(b.color, 0.5);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.quadraticCurveTo(Math.sin(t * 30 + b.id) * 4, 12, 0, 22);
      ctx.stroke();
      drawGlow(ctx, 0, 0, 13, b.color, 0.75);
      ctx.fillStyle = '#f5f3ff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(2.6, 1.5);
      ctx.lineTo(0, 5);
      ctx.lineTo(-2.6, 1.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'missile': {
      const flick = 0.7 + Math.random() * 0.3;
      drawGlow(ctx, 0, 10, 13 * flick, '#fb923c', 0.85);
      drawGlow(ctx, 0, 8, 6, '#ffffff', 0.7 * flick);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-2.6, -6, 5.2, 12);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-2.6, -6);
      ctx.lineTo(0, -11);
      ctx.lineTo(2.6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-5, 2, 2.4, 4.5);
      ctx.fillRect(2.6, 2, 2.4, 4.5);
      break;
    }
    case 'drone': {
      drawGlow(ctx, 0, 0, 9, b.color, 0.65);
      ctx.fillStyle = hexToRgba(b.color, 0.5);
      ctx.fillRect(-1, 0, 2, 12);
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.7, 5, 0, 0, TAU);
      ctx.fill();
      break;
    }
    default: {
      // Plasma spear; piercing bolts are bigger and ringed
      const heavy = (b.pierce || 0) > 0;
      const k = heavy ? 1.55 : 1;
      ctx.fillStyle = hexToRgba(b.color, 0.45);
      ctx.beginPath();
      ctx.moveTo(-3 * k, 0);
      ctx.lineTo(0, 24 * k);
      ctx.lineTo(3 * k, 0);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, -2, 12 * k, b.color, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -10 * k);
      ctx.lineTo(2.3 * k, -1);
      ctx.lineTo(0, 3.5 * k);
      ctx.lineTo(-2.3 * k, -1);
      ctx.closePath();
      ctx.fill();
      if (heavy) {
        ctx.strokeStyle = hexToRgba(b.color, 0.9);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, -2, 7, 2.6, 0, 0, TAU);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Sovereign's wingman drone. */
export function drawWingDrone(ctx: Ctx, x: number, y: number, t: number, color: string, k: number, flash: number) {
  drawGlow(ctx, x, y + 4, 16, color, 0.4);
  ctx.save();
  ctx.translate(x, y);
  // Thruster
  const flick = 0.7 + Math.random() * 0.3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hexToRgba(color, 0.75);
  ctx.beginPath();
  ctx.moveTo(-3, 5);
  ctx.lineTo(0, 5 + 12 * flick);
  ctx.lineTo(3, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Orbit ring
  ctx.strokeStyle = hexToRgba(color, 0.6);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 4]);
  ctx.lineDashOffset = -t * 24 * (k ? 1 : -1);
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // Body
  ctx.rotate(Math.sin(t * 3 + k * 2) * 0.18);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 1);
  ctx.lineTo(0, 6);
  ctx.lineTo(-6, 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawGlow(ctx, x, y - 1, 5, '#ffffff', 0.9);
  if (flash > 0) drawGlow(ctx, x, y - 10, 9 * flash, '#fffbeb', flash * 0.9);
}

/** Jagged electric arc between two points (graze sparks, chain lightning). Re-jitters every frame. */
export function drawLightning(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, alpha: number) {
  if (alpha <= 0.01) return;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const jitter = Math.min(16, len * 0.18);
  const pts: number[] = [x1, y1];
  for (let k = 1; k < 4; k++) {
    const off = (Math.random() - 0.5) * 2 * jitter;
    pts.push(x1 + dx * (k / 4) + nx * off, y1 + dy * (k / 4) + ny * off);
  }
  pts.push(x2, y2);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = hexToRgba(color, 0.45);
  ctx.lineWidth = 5;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  path();
  ctx.stroke();
  ctx.restore();
  drawGlow(ctx, x2, y2, 10, color, alpha * 0.8);
}
