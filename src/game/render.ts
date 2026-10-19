import {
  BossEntity,
  GemEntity,
  HazardEntity,
  LaserEntity,
  PowerupEntity,
  StarEntity,
} from '../types/game';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Color helpers & cached glow sprites (additive blending is far cheaper than
// shadowBlur on mobile GPUs)
// ---------------------------------------------------------------------------
export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const glowCache = new Map<string, HTMLCanvasElement>();

function getGlow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
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
  warp: number
) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (fever) {
    bg.addColorStop(0, '#1f0726');
    bg.addColorStop(1, '#0a0418');
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
  for (const n of NEBULAE) {
    const span = H + big * n.r * 2;
    const y = ((n.y * H + t * n.speed) % span) - big * n.r;
    const x = n.x * W + Math.sin(t * 0.07 + n.speed) * 40;
    const col = fever ? '#f43f5e' : boss ? '#be123c' : n.color;
    drawGlow(ctx, x, y, big * n.r, col, 0.22);
  }

  // Grid floor, fading towards the top
  const gridColor = fever ? '#f43f5e' : boss ? '#fb7185' : '#22d3ee';
  const gridGrad = ctx.createLinearGradient(0, 0, 0, H);
  gridGrad.addColorStop(0, hexToRgba(gridColor, 0));
  gridGrad.addColorStop(0.55, hexToRgba(gridColor, fever ? 0.1 : 0.05));
  gridGrad.addColorStop(1, hexToRgba(gridColor, fever ? 0.22 : 0.14));
  ctx.strokeStyle = gridGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cell = 52;
  const xOff = (W % cell) / 2;
  for (let x = xOff; x < W; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = gridOffsetY - cell; y < H; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
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

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
export function drawGem(ctx: Ctx, g: GemEntity, t: number) {
  const big = g.val > 1;
  const color = big ? '#f472b6' : '#fbbf24';
  const light = big ? '#fce7f3' : '#fef3c7';
  drawGlow(ctx, g.x, g.y, g.r * 3, color, 0.75);
  ctx.save();
  ctx.translate(g.x, g.y);
  const sx = Math.cos(g.spin + t * 3);
  const w = g.r * 0.85 * Math.max(0.18, Math.abs(sx));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -g.r);
  ctx.lineTo(w, -g.r * 0.15);
  ctx.lineTo(0, g.r);
  ctx.lineTo(-w, -g.r * 0.15);
  ctx.closePath();
  ctx.fill();
  // Bright facet
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0, -g.r);
  ctx.lineTo(sx > 0 ? w : -w, -g.r * 0.15);
  ctx.lineTo(0, -g.r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  } else {
    ctx.arc(-s * 0.1, s * 0.15, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.35);
    ctx.lineTo(s * 0.7, -s * 0.85);
    ctx.stroke();
  }
}

export function drawPowerup(ctx: Ctx, p: PowerupEntity, t: number) {
  const pulse = 1 + Math.sin(p.pulse) * 0.08;
  drawGlow(ctx, p.x, p.y, p.r * 3.2, p.color, 0.7);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(pulse, pulse);

  // Hex capsule
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * p.r;
    const py = Math.sin(a) * p.r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = hexToRgba(p.color, 0.35);
  ctx.fill();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Orbiting dashed ring
  ctx.save();
  ctx.rotate(t * 2);
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = hexToRgba(p.color, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, p.r + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawPowerGlyph(ctx, p.kind, p.r * 0.5);
  ctx.restore();
}

export function drawHazard(ctx: Ctx, h: HazardEntity, t: number, px: number, py: number) {
  const flash = (h.hitFlash || 0) > 0;

  if (h.type === 'shot') {
    drawGlow(ctx, h.x, h.y, h.r * 3.2, h.color, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  drawGlow(ctx, h.x, h.y, h.r * 2.6, h.color, 0.55);
  ctx.save();
  ctx.translate(h.x, h.y);

  if (h.type === 'spinner') {
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
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Blinking eye
    const blink = Math.sin(t * 14 + h.id) > 0;
    ctx.fillStyle = blink ? '#ffffff' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(h.r * 0.25, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.type === 'turret') {
    // Hexagonal gun platform with an aiming barrel
    ctx.save();
    ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px2 = Math.cos(a) * h.r;
      const py2 = Math.sin(a) * h.r;
      if (i === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    const tg = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r);
    tg.addColorStop(0, '#312e81');
    tg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = flash ? '#ffffff' : tg;
    ctx.fill();
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    const aim = Math.atan2(py - h.y, px - h.x);
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = '#e9d5ff';
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
    // HP pips
    const hp = h.hp || 0;
    for (let i = 0; i < hp; i++) {
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(-h.r + i * 9, h.r + 6, 7, 3);
    }
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
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
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
}

export function drawLaser(ctx: Ctx, l: LaserEntity, H: number, t: number) {
  const half = l.width / 2;
  if (l.warnTime > 0) {
    // Telegraph: flashing danger column
    const blink = Math.sin(t * 28) > 0 ? 1 : 0.45;
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
