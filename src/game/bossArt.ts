import { BossEntity, BossPart } from '../types/game';
import { TWIN_NAMES } from './bosses';
import { drawBoss, drawGlow, fxPrefs, hexToRgba } from './render';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
}

function polygon(ctx: Ctx, n: number, r: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function label(ctx: Ctx, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = "700 10px 'Orbitron', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Lightning-style energy beam between two points. */
function drawTether(ctx: Ctx, ax: number, ay: number, bx: number, by: number, colA: string, colB: string, t: number, live: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  const segs = Math.max(6, Math.floor(len / 26));
  const grad = ctx.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, colA);
  grad.addColorStop(1, colB);
  if (!live) {
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
    return;
  }
  for (const [w, a] of [
    [16, 0.18],
    [7, 0.45],
  ] as const) {
    ctx.strokeStyle = grad;
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  for (let i = 1; i < segs; i++) {
    const k = i / segs;
    const j = (Math.random() - 0.5) * 12 + Math.sin(t * 20 + i) * 3;
    ctx.lineTo(ax + (bx - ax) * k + nx * j, ay + (by - ay) * k + ny * j);
  }
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// GATEKEEPER
// ---------------------------------------------------------------------------
function drawGateShield(ctx: Ctx, x: number, y: number, R: number, gapAngle: number, gap: number, color: string, t: number) {
  ctx.save();
  ctx.translate(x, y);
  // Highlighted wedge showing where shots get through
  const wedge = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.6);
  wedge.addColorStop(0, hexToRgba('#fde047', 0));
  wedge.addColorStop(1, hexToRgba('#fde047', 0.16));
  ctx.fillStyle = wedge;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R * 1.6, gapAngle - gap / 2, gapAngle + gap / 2);
  ctx.closePath();
  ctx.fill();

  const start = gapAngle + gap / 2;
  const end = gapAngle - gap / 2 + TAU;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = hexToRgba(color, 0.25);
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(0, 0, R, start, end);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.setLineDash([22, 5]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.arc(0, 0, R, start, end);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, R + 6, start, end);
  ctx.stroke();
  ctx.restore();
  // Gap edges glow
  for (const a of [start, end]) {
    drawGlow(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R, 18, '#fde047', 0.9);
  }
}

function drawGatekeeper(ctx: Ctx, b: BossEntity, t: number) {
  const rage = b.hp / b.maxHp < 0.4;
  const color = rage ? '#f472b6' : '#38bdf8';
  drawGlow(ctx, b.x, b.y, b.r * 2.8, color, 0.5);
  drawGateShield(ctx, b.x, b.y, b.v.R, b.v.shield, b.v.gap, rage ? '#f9a8d4' : '#7dd3fc', t);

  ctx.save();
  ctx.translate(b.x, b.y);
  // Gear body
  ctx.save();
  ctx.rotate(b.angle);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 ? b.r * 0.78 : b.r * 0.9;
    const a0 = (i / 16) * TAU;
    const a1 = ((i + 1) / 16) * TAU;
    ctx.arc(0, 0, rr, a0, a1);
  }
  ctx.closePath();
  ctx.fillStyle = b.hitFlash > 0 ? '#1e3a8a' : '#0b1730';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.rotate(-b.angle * 1.5);
  ctx.strokeStyle = hexToRgba(color, 0.7);
  ctx.lineWidth = 2;
  polygon(ctx, 6, b.r * 0.58);
  ctx.stroke();
  ctx.restore();

  // Eye looking out of the gap
  const eg = ctx.createRadialGradient(0, 0, 2, 0, 0, b.r * 0.42);
  eg.addColorStop(0, '#ffffff');
  eg.addColorStop(0.4, color);
  eg.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = eg;
  circle(ctx, 0, 0, b.r * 0.42);
  ctx.fill();
  ctx.rotate(b.v.shield);
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.ellipse(b.r * 0.12, 0, b.r * 0.1, b.r * 0.26, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (b.hitFlash > 0) drawGlow(ctx, b.x, b.y, b.r, '#ffffff', 0.35);
}

// ---------------------------------------------------------------------------
// CASTOR & POLLUX
// ---------------------------------------------------------------------------
function drawTwinBody(ctx: Ctx, pt: BossPart, color: string, t: number, idx: number, stunned: boolean) {
  if (!pt.alive) {
    // Ghost outline + revive countdown
    ctx.save();
    ctx.strokeStyle = hexToRgba(color, 0.5);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    circle(ctx, pt.x, pt.y, pt.r * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, pt.timer / 5));
    ctx.stroke();
    ctx.font = "900 16px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.fillText(Math.max(0, pt.timer).toFixed(1), pt.x, pt.y);
    ctx.restore();
    return;
  }
  drawGlow(ctx, pt.x, pt.y, pt.r * 2.6, color, 0.55);
  ctx.save();
  ctx.translate(pt.x, pt.y);
  const g = ctx.createRadialGradient(-pt.r * 0.3, -pt.r * 0.3, 2, 0, 0, pt.r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, color);
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = pt.hitFlash > 0 ? '#ffffff' : g;
  circle(ctx, 0, 0, pt.r * 0.7);
  ctx.fill();
  // Crescent orbit rings, mirrored between the twins
  const dir = idx ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    ctx.save();
    ctx.rotate(dir * t * (1.5 + k) + k);
    ctx.strokeStyle = hexToRgba(color, 0.85);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, pt.r * (1.05 + k * 0.2), pt.r * 0.42, 0, 0, Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();
  }
  // HP arc
  ctx.strokeStyle = 'rgba(2,6,23,0.8)';
  ctx.lineWidth = 4;
  circle(ctx, 0, 0, pt.r * 1.25);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, pt.r * 1.25, -Math.PI / 2, -Math.PI / 2 + TAU * (pt.hp / pt.maxHp));
  ctx.stroke();
  if (stunned) {
    for (let k = 0; k < 3; k++) {
      const a = t * 4 + (k * TAU) / 3;
      drawGlow(ctx, Math.cos(a) * pt.r * 0.9, -pt.r * 1.1 + Math.sin(a) * 6, 8, '#fde047', 0.9);
    }
  }
  ctx.restore();
  label(ctx, TWIN_NAMES[idx], pt.x, pt.y + pt.r * 1.6, color);
}

function drawTwins(ctx: Ctx, b: BossEntity, t: number) {
  const [A, B] = b.parts;
  if (A.alive && B.alive) drawTether(ctx, A.x, A.y, B.x, B.y, '#22d3ee', '#f472b6', t, !!b.v.tether);
  drawTwinBody(ctx, A, '#22d3ee', t, 0, b.v.stun > 0);
  drawTwinBody(ctx, B, '#f472b6', t, 1, b.v.stun > 0);
}

// ---------------------------------------------------------------------------
// FURNACE
// ---------------------------------------------------------------------------
function drawFurnace(ctx: Ctx, b: BossEntity, t: number) {
  const open = Math.min(1, Math.max(0, b.v.vent) * 2.5);
  const heat = 0.5 + Math.sin(t * 5) * 0.15 + open * 0.4;
  drawGlow(ctx, b.x, b.y, b.r * 3, '#ea580c', heat * 0.7);

  ctx.save();
  ctx.translate(b.x, b.y);

  // Exposed core (visible through the opening plates)
  const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, b.r * 0.6);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.3, '#fde047');
  cg.addColorStop(0.7, '#f97316');
  cg.addColorStop(1, '#7c2d12');
  ctx.fillStyle = cg;
  circle(ctx, 0, 0, b.r * (0.45 + open * 0.15) * (1 + Math.sin(t * 9) * 0.04));
  ctx.fill();

  // Four armour plates that slide outwards when the vents open
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(b.r * 0.32 * open, 0);
    ctx.beginPath();
    ctx.moveTo(b.r * 0.18, -b.r * 0.62);
    ctx.lineTo(b.r * 0.95, -b.r * 0.4);
    ctx.lineTo(b.r * 0.95, b.r * 0.4);
    ctx.lineTo(b.r * 0.18, b.r * 0.62);
    ctx.lineTo(b.r * 0.05, 0);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, -b.r, b.r, b.r);
    pg.addColorStop(0, b.hitFlash > 0 ? '#57534e' : '#44403c');
    pg.addColorStop(1, '#1c1917');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#fb923c', 0.6 + open * 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
    // Rivets
    ctx.fillStyle = '#a8a29e';
    for (const ry of [-0.3, 0, 0.3]) {
      circle(ctx, b.r * 0.75, ry * b.r, 2.2);
      ctx.fill();
    }
    // Grill glow
    ctx.strokeStyle = hexToRgba('#fdba74', heat);
    ctx.lineWidth = 2;
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      ctx.moveTo(b.r * (0.35 + g * 0.15), -b.r * 0.22);
      ctx.lineTo(b.r * (0.35 + g * 0.15), b.r * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Chimneys
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#292524';
    ctx.fillRect(sx * b.r * 0.55 - 7, -b.r * 1.15, 14, b.r * 0.4);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx * b.r * 0.55 - 7, -b.r * 1.15, 14, b.r * 0.4);
    drawGlow(ctx, sx * b.r * 0.55, -b.r * 1.2 - Math.random() * 10, 12 + Math.random() * 8, '#f97316', 0.8);
  }
  ctx.restore();
  if (open > 0) {
    ctx.save();
    ctx.strokeStyle = hexToRgba('#fde047', 0.5 + Math.sin(t * 14) * 0.3);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = t * 30;
    circle(ctx, b.x, b.y, b.r * 0.8);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// WRAITH
// ---------------------------------------------------------------------------
function drawWraithBody(ctx: Ctx, pt: BossPart, t: number, px: number, py: number, alpha: number, flash: boolean, i: number) {
  const r = pt.r;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawGlow(ctx, pt.x, pt.y, r * 2.4, '#7c3aed', 0.45);
  ctx.translate(pt.x, pt.y);
  // Hooded cloak with a wavy hem
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.05);
  ctx.bezierCurveTo(r * 0.9, -r * 0.95, r * 0.95, r * 0.1, r * 0.85, r * 0.85);
  const waves = 5;
  for (let k = 0; k <= waves; k++) {
    const x = r * 0.85 - (k / waves) * r * 1.7;
    const y = r * 0.85 + (k % 2 ? r * 0.28 : 0) + Math.sin(t * 6 + k + i) * 4;
    ctx.lineTo(x, y);
  }
  ctx.bezierCurveTo(-r * 0.95, r * 0.1, -r * 0.9, -r * 0.95, 0, -r * 1.05);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, flash ? '#ffffff' : '#ddd6fe');
  g.addColorStop(0.5, '#8b5cf6');
  g.addColorStop(1, 'rgba(76, 29, 149, 0.1)');
  ctx.fillStyle = g;
  ctx.fill();
  // Hood void
  ctx.fillStyle = '#0b0420';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.25, r * 0.48, r * 0.55, 0, 0, TAU);
  ctx.fill();
  // Eye: the real one tracks the player, decoys stare straight down
  let ex = 0;
  let ey = r * 0.12;
  if (pt.real) {
    const a = Math.atan2(py - pt.y, px - pt.x);
    ex = Math.cos(a) * r * 0.18;
    ey = -r * 0.25 + Math.sin(a) * r * 0.22;
  } else {
    ey = -r * 0.05;
  }
  drawGlow(ctx, ex, ey, r * 0.4, '#e9d5ff', 0.9);
  ctx.fillStyle = '#ffffff';
  circle(ctx, ex, ey, r * 0.09);
  ctx.fill();
  ctx.restore();
}

function drawReticle(ctx: Ctx, x: number, y: number, r: number, color: string, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.4, 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r + 4, 0);
    ctx.lineTo(r + 14, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWraith(ctx: Ctx, b: BossEntity, t: number, px: number, py: number) {
  const fade = b.v.shuffle > 0 ? Math.min(1, Math.abs(b.v.shuffle - 0.45) / 0.45) : 1;
  // Shadows first (only the real one has one)
  for (const pt of b.parts) {
    if (!pt.alive || !pt.real) continue;
    ctx.save();
    ctx.globalAlpha = 0.55 * fade;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y + pt.r * 1.9, pt.r * 0.85, pt.r * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(167,139,250,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  b.parts.forEach((pt, i) => {
    if (!pt.alive) return;
    const decoyFade = b.v.reveal > 0 && !pt.real ? 0.3 : 1;
    const flicker = 0.85 + Math.sin(t * 9 + i * 3) * 0.15;
    drawWraithBody(ctx, pt, t, px, py, fade * decoyFade * flicker, pt.real ? b.hitFlash > 0 : false, i);
  });
  const real = b.parts.find((p) => p.real && p.alive);
  if (real && b.v.reveal > 0) drawReticle(ctx, real.x, real.y, real.r * 1.3, '#f43f5e', t);
  if (b.v.lunge === 1) {
    const blink = fxPrefs.reduceFlash ? 0.85 : Math.sin(t * 30) > 0 ? 1 : 0.4;
    ctx.save();
    ctx.globalAlpha = blink;
    drawReticle(ctx, b.v.lx, b.v.ly, 26, '#c084fc', -t);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// SINGULARITY
// ---------------------------------------------------------------------------
function drawAccretion(ctx: Ctx, r: number, t: number, front: boolean, intensity: number) {
  ctx.save();
  ctx.scale(1, 0.32);
  for (let k = 0; k < 3; k++) {
    const rr = r * (1.45 + k * 0.32);
    ctx.strokeStyle = hexToRgba(k === 0 ? '#ffffff' : k === 1 ? '#c7d2fe' : '#6366f1', (0.75 - k * 0.2) * intensity);
    ctx.lineWidth = 7 - k * 2;
    ctx.setLineDash([rr * 0.5, rr * 0.18]);
    ctx.lineDashOffset = -t * (120 - k * 30);
    ctx.beginPath();
    if (front) ctx.arc(0, 0, rr, 0, Math.PI);
    else ctx.arc(0, 0, rr, Math.PI, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSingularity(ctx: Ctx, b: BossEntity, t: number) {
  const collapsed = b.v.collapse > 0;
  // Stabilizer beams
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const n of b.parts) {
    if (!n.alive) continue;
    ctx.strokeStyle = 'rgba(129,140,248,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(n.x, n.y);
    ctx.stroke();
  }
  ctx.restore();

  // Infalling rings — show the pull
  if (!collapsed) {
    ctx.save();
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.5 + k / 3) % 1;
      ctx.strokeStyle = `rgba(129,140,248,${0.25 * ph})`;
      ctx.lineWidth = 1.5;
      circle(ctx, b.x, b.y, b.r * (1.2 + (1 - ph) * 3.5));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (b.v.surgeWarn > 0 || b.v.surge > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(244,63,94,${fxPrefs.reduceFlash ? 0.55 : 0.4 + Math.sin(t * 20) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = t * 80;
    circle(ctx, b.x, b.y, b.r * 4.5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(b.x, b.y);
  drawGlow(ctx, 0, 0, b.r * 3.2, collapsed ? '#e0e7ff' : '#6366f1', 0.55);
  drawAccretion(ctx, b.r, t, false, collapsed ? 0.4 : 1);
  if (collapsed) {
    // Exposed core
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, b.r * 0.8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#c7d2fe');
    g.addColorStop(1, '#4338ca');
    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : g;
    circle(ctx, 0, 0, b.r * 0.75 * (1 + Math.sin(t * 12) * 0.06));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + t;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * b.r * 0.7, Math.sin(a) * b.r * 0.7);
      ctx.stroke();
    }
  } else {
    // Event horizon
    ctx.fillStyle = '#000000';
    circle(ctx, 0, 0, b.r * 0.95);
    ctx.fill();
    ctx.strokeStyle = `rgba(199,210,254,${0.8 + Math.sin(t * 6) * 0.2})`;
    ctx.lineWidth = 2.5;
    circle(ctx, 0, 0, b.r * 0.97);
    ctx.stroke();
  }
  drawAccretion(ctx, b.r, t, true, collapsed ? 0.4 : 1);
  ctx.restore();

  // Stabilizer nodes
  for (const n of b.parts) {
    if (!n.alive) continue;
    drawGlow(ctx, n.x, n.y, n.r * 2.6, '#818cf8', 0.7);
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(t * 3);
    polygon(ctx, 4, n.r);
    ctx.fillStyle = n.hitFlash > 0 ? '#ffffff' : '#312e81';
    ctx.fill();
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e0e7ff';
    circle(ctx, n.x, n.y, 3.5);
    ctx.fill();
    // HP bar
    ctx.fillStyle = 'rgba(2,6,23,0.8)';
    ctx.fillRect(n.x - 14, n.y + n.r + 6, 28, 3);
    ctx.fillStyle = '#a5b4fc';
    ctx.fillRect(n.x - 14, n.y + n.r + 6, 28 * Math.max(0, n.hp / n.maxHp), 3);
  }
}

// ---------------------------------------------------------------------------
// NULL
// ---------------------------------------------------------------------------
function drawNullCore(ctx: Ctx, b: BossEntity, t: number, offX: number, offY: number, tint: string | null) {
  ctx.save();
  ctx.translate(b.x + offX, b.y + offY);
  // Fragmented rotating ring
  for (let i = 0; i < 8; i++) {
    const a0 = b.angle + (i / 8) * TAU;
    const jitter = !fxPrefs.reduceFlash && Math.random() < 0.08 ? (Math.random() - 0.5) * 12 : 0;
    ctx.strokeStyle = tint || (i % 2 ? '#f87171' : '#f8fafc');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.95 + jitter, a0, a0 + 0.55);
    ctx.stroke();
  }
  // Inverted triangle eye
  ctx.save();
  ctx.rotate(Math.sin(t * 0.7) * 0.1);
  ctx.beginPath();
  ctx.moveTo(-b.r * 0.62, -b.r * 0.38);
  ctx.lineTo(b.r * 0.62, -b.r * 0.38);
  ctx.lineTo(0, b.r * 0.62);
  ctx.closePath();
  ctx.fillStyle = tint ? hexToRgba(tint, 0.4) : b.hitFlash > 0 ? '#ffffff' : '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = tint || '#f8fafc';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  if (!tint) {
    const pulse = 1 + Math.sin(t * 7) * 0.12;
    drawGlow(ctx, 0, 0, b.r * 0.55 * pulse, '#ef4444', 0.95);
    ctx.fillStyle = '#ffffff';
    circle(ctx, 0, -b.r * 0.05, b.r * 0.08);
    ctx.fill();
    if (b.phase === 3) {
      ctx.strokeStyle = 'rgba(253,224,71,0.85)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * b.r * 0.5, Math.sin(a) * b.r * 0.5);
        ctx.lineTo(Math.cos(a + 0.3) * b.r * 0.8, Math.sin(a + 0.3) * b.r * 0.8);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawNull(ctx: Ctx, b: BossEntity, t: number, W: number) {
  const echo = b.phase === 2 ? ['gate', 'twins', 'forge', 'gravity', 'wraith'][(b.v.echo || 0) % 5] : '';
  drawGlow(ctx, b.x, b.y, b.r * 3, '#dc2626', 0.5 + Math.sin(t * 3) * 0.1);

  if (echo === 'twins' && !(b.v.stun > 0) && !(b.v.tetherOff > 0)) {
    const L = Math.min(W * 0.48, 320);
    const c = Math.cos(b.v.tetherRot || 0) * L;
    const s = Math.sin(b.v.tetherRot || 0) * L;
    drawTether(ctx, b.x - c, b.y - s, b.x + c, b.y + s, '#22d3ee', '#f472b6', t, true);
    drawGlow(ctx, b.x - c, b.y - s, 22, '#22d3ee', 0.9);
    drawGlow(ctx, b.x + c, b.y + s, 22, '#f472b6', 0.9);
  }
  if (echo === 'wraith') {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15;
    drawNullCore(ctx, b, t, -W * 0.28, 0, '#c4b5fd');
    drawNullCore(ctx, b, t, W * 0.28, 0, '#c4b5fd');
    ctx.restore();
  }
  if (echo === 'gravity') {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.6 + k / 3) % 1;
      ctx.strokeStyle = `rgba(129,140,248,${0.3 * ph})`;
      ctx.lineWidth = 1.5;
      circle(ctx, b.x, b.y, b.r * (1.2 + (1 - ph) * 3));
      ctx.stroke();
    }
  }

  // Chromatic glitch copies
  if (!fxPrefs.reduceFlash && Math.random() < 0.18) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawNullCore(ctx, b, t, (Math.random() - 0.5) * 14, 0, '#22d3ee');
    drawNullCore(ctx, b, t, (Math.random() - 0.5) * 14, 0, '#ef4444');
    ctx.restore();
  }
  drawNullCore(ctx, b, t, 0, 0, null);

  // Null Field bubble (phase 1)
  if (b.phase === 1) {
    const open = b.v.fieldOff > 0;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = open ? 'rgba(253,224,71,0.35)' : `rgba(248,113,113,${0.55 + Math.sin(t * 4) * 0.2})`;
    ctx.lineWidth = open ? 1.5 : 2.5;
    if (open) ctx.setLineDash([4, 10]);
    polygon(ctx, 12, b.r * 1.3);
    ctx.stroke();
    ctx.fillStyle = open ? 'rgba(253,224,71,0.04)' : 'rgba(248,113,113,0.08)';
    ctx.fill();
    ctx.restore();
  }
  if (echo === 'gate') drawGateShield(ctx, b.x, b.y, b.v.R, b.v.shield, 1.2, '#7dd3fc', t);
  if (b.v.trans > 0) drawGlow(ctx, b.x, b.y, b.r * 2, '#ffffff', b.v.trans * 0.4);
}

// ---------------------------------------------------------------------------
export function drawBossEntity(ctx: Ctx, b: BossEntity, t: number, px: number, py: number, W: number) {
  switch (b.kind) {
    case 'gatekeeper':
      drawGatekeeper(ctx, b, t);
      break;
    case 'twins':
      drawTwins(ctx, b, t);
      break;
    case 'furnace':
      drawFurnace(ctx, b, t);
      break;
    case 'wraith':
      drawWraith(ctx, b, t, px, py);
      break;
    case 'singularity':
      drawSingularity(ctx, b, t);
      break;
    case 'null':
      drawNull(ctx, b, t, W);
      break;
    default:
      drawBoss(ctx, b, t);
  }
}
