import { GameState, ShipDef } from '../types/game';
import { drawBossEntity } from './bossArt';
import { LevelDef } from './campaign';
import { EngineState } from './engine';
import {
  drawBackground,
  drawDashHint,
  drawFog,
  drawGem,
  drawGlow,
  drawHazard,
  drawLaser,
  drawPowerup,
  drawShip,
  drawVignette,
  hexToRgba,
} from './render';

/** Draws one frame of the world. `level` is the active campaign sector, if any. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  e: EngineState,
  st: GameState,
  level: LevelDef | null,
  ship: ShipDef
) {
  const p = e.player;
  const t = e.t;
  const W = e.W;
  const H = e.H;

  drawBackground(ctx, W, H, t, e.gridOffsetY, e.bgStars, e.isFeverActive && st === 'PLAYING', !!e.boss, e.warp, level?.theme);

  ctx.save();
  if (e.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * e.screenShake, (Math.random() - 0.5) * e.screenShake);
  }

  if (p.slowFieldTimer > 0 && st === 'PLAYING') {
    ctx.fillStyle = 'rgba(52, 211, 153, 0.05)';
    ctx.fillRect(0, 0, W, H);
  }

  for (const l of e.lasers) drawLaser(ctx, l, W, H, t);

  // Shockwaves
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const sw of e.shockwaves) {
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.lineWidth = (sw.width || 3) * (0.4 + sw.alpha);
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (const g of e.gems) drawGem(ctx, g, t);
  for (const pu of e.powerups) drawPowerup(ctx, pu, t);

  // Player bullets
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of e.bullets) {
    drawGlow(ctx, b.x, b.y, 12, b.color, 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x - 1.5, b.y - 9, 3, 14);
  }
  ctx.restore();

  for (const h of e.hazards) if (h.type !== 'shot') drawHazard(ctx, h, t, p.x, p.y);
  if (e.dashHintId >= 0 && st === 'PLAYING') {
    const target = e.hazards.find((h) => h.id === e.dashHintId);
    if (target) drawDashHint(ctx, target, t);
  }
  if (e.boss) drawBossEntity(ctx, e.boss, t, p.x, p.y, W);
  for (const h of e.hazards) if (h.type === 'shot') drawHazard(ctx, h, t, p.x, p.y);

  // Player
  if ((st === 'PLAYING' || st === 'PAUSED') && !e.isDying) {
    const mainColor = e.isFeverActive ? '#fbbf24' : ship.color;

    // Afterglow trail
    for (let i = p.trail.length - 1; i >= 1; i--) {
      const tr = p.trail[i];
      const ratio = 1 - i / p.trail.length;
      drawGlow(ctx, tr.x, tr.y + 6, p.radius * (0.6 + ratio * 0.9), tr.dash ? '#f43f5e' : mainColor, ratio * 0.45);
    }

    // Magnet field ring
    if (p.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -t * 40;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 24 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const blinking = p.invulnTimer > 0 && p.dashTimer <= 0 && !e.isFeverActive;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blinking && Math.sin(t * 40) < 0) ctx.globalAlpha = 0.35;

    // Overdrive aura
    if (e.isFeverActive) {
      drawGlow(ctx, 0, 0, p.radius * 3.5, '#fbbf24', 0.55);
      ctx.save();
      ctx.rotate(t * 5);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 12, k * Math.PI, k * Math.PI + Math.PI * 0.6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (p.dashTimer > 0) {
      drawGlow(ctx, 0, 0, p.radius * 3, '#22d3ee', 0.6);
    }

    // Shield bubble
    if (p.shieldCount > 0) {
      ctx.save();
      ctx.rotate(t * 0.8);
      ctx.beginPath();
      const sr = p.radius + 10;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        if (k === 0) ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
        else ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.6 + Math.sin(t * 5) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(p.angle + Math.PI / 2);
    const thrust = p.dashTimer > 0 ? 2 : e.isFeverActive ? 1.6 : 1 + Math.max(0, -p.vy) * 0.002;
    drawShip(ctx, ship.id, p.radius, mainColor, e.isFeverActive ? '#b45309' : ship.secondary, t, thrust);
    ctx.restore();
  }

  // Particles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const pt of e.particles) {
    const a = Math.max(0, pt.alpha);
    if (pt.streak) {
      ctx.strokeStyle = hexToRgba(pt.color, a);
      ctx.lineWidth = pt.r * 0.8;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.045, pt.y - pt.vy * 0.045);
      ctx.stroke();
    } else {
      drawGlow(ctx, pt.x, pt.y, pt.r * 3.2, pt.color, a);
    }
  }
  ctx.restore();

  if (level?.fog && (st === 'PLAYING' || st === 'PAUSED')) drawFog(ctx, W, H, p.x, p.y, 240, t);

  // Floating texts with a pop-in scale
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const ft of e.floatingTexts) {
    const pop = 1 + Math.max(0, 1 - ft.age * 7) * 0.5;
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = `700 ${Math.round(ft.size * pop)}px 'Orbitron', 'Rajdhani', system-ui, sans-serif`;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();

  ctx.restore();

  if (e.flashAlpha > 0) {
    ctx.fillStyle = hexToRgba(e.flashColor, e.flashAlpha * 0.6);
    ctx.fillRect(0, 0, W, H);
  }
  drawVignette(ctx, W, H);
}
