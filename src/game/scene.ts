import { GameState, ShipDef } from '../types/game';
import { drawBossEntity } from './bossArt';
import { canvasFont } from '../i18n';
import { LEVELS, LevelDef, LevelTheme } from './campaign';
import { EngineState } from './engine';
import {
  GridWell,
  drawBackground,
  drawBullet,
  drawDashHint,
  drawFog,
  drawGem,
  drawGlow,
  fxPrefs,
  drawHazard,
  drawLaser,
  drawLightning,
  drawPowerup,
  drawShip,
  drawVignette,
  drawWingDrone,
  hexToRgba,
} from './render';

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Neon look used before the first Endless biome kicks in. */
const DEFAULT_THEME: LevelTheme = {
  top: '#03030c',
  bottom: '#0a0f26',
  grid: '#22d3ee',
  nebula: ['#7c3aed', '#0891b2', '#db2777'],
};

const biomeTheme = (i: number) => (i < 0 ? DEFAULT_THEME : LEVELS[i % LEVELS.length].theme);

/** Endless biomes: the current sector look, cross-faded from the previous one. */
function endlessTheme(e: EngineState): LevelTheme | undefined {
  if (e.biomeTo < 0) return undefined;
  const a = biomeTheme(e.biomeFrom);
  const b = biomeTheme(e.biomeTo);
  // Quantised to 24 steps: smooth to the eye, and only a handful of distinct colours hit the glow cache
  const k = Math.round(Math.max(0, Math.min(1, e.biomeBlend)) * 24) / 24;
  if (k >= 1) return b;
  return {
    top: mixHex(a.top, b.top, k),
    bottom: mixHex(a.bottom, b.bottom, k),
    grid: mixHex(a.grid, b.grid, k),
    nebula: [mixHex(a.nebula[0], b.nebula[0], k), mixHex(a.nebula[1], b.nebula[1], k), mixHex(a.nebula[2], b.nebula[2], k)],
  };
}

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

  const inRun = st === 'PLAYING' || st === 'PAUSED' || st === 'PERK_SELECT' || st === 'REVIVE';

  // Gravity wells bend the grid: bosses pull it in, a Dash ripples it outward
  const wells: GridWell[] = [];
  if (e.boss) {
    const b = e.boss;
    wells.push({ x: b.x, y: b.y, r: b.r * (b.kind === 'singularity' ? 3.4 : 2.6), s: b.kind === 'singularity' ? 0.42 : 0.24 });
  }
  if (inRun && p.dashTimer > 0) wells.push({ x: p.x, y: p.y, r: 130, s: -0.5 * Math.min(1, p.dashTimer / 0.38) });
  const theme = level?.theme ?? (st === 'MENU' ? undefined : endlessTheme(e));
  drawBackground(ctx, W, H, t, e.gridOffsetY, e.bgStars, e.isFeverActive && st === 'PLAYING', !!e.boss, e.warp, theme, wells);

  ctx.save();
  const shake = e.screenShake * e.fxShake;
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
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
  for (const b of e.bullets) drawBullet(ctx, b, t);
  ctx.restore();

  for (const h of e.hazards) if (h.type !== 'shot') drawHazard(ctx, h, t, p.x, p.y);
  if (e.dashHintId >= 0 && st === 'PLAYING') {
    const target = e.hazards.find((h) => h.id === e.dashHintId);
    if (target) drawDashHint(ctx, target, t);
  }
  if (e.boss) drawBossEntity(ctx, e.boss, t, p.x, p.y, W);
  for (const h of e.hazards) if (h.type === 'shot') drawHazard(ctx, h, t, p.x, p.y);

  // Holo Echo decoys: flickering ghost ships that soak up fire, pulsing faster before they blow
  for (const d of e.decoys) {
    const k = d.life / d.maxLife;
    const pulse = Math.sin(t * (10 + (1 - k) * 30));
    drawGlow(ctx, d.x, d.y, p.radius * (2.4 + pulse * 0.3), '#e879f9', 0.35 + (1 - k) * 0.3);
    ctx.save();
    ctx.strokeStyle = hexToRgba('#f0abfc', 0.25 + (1 - k) * 0.4);
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = t * 30;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 30 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(d.x, d.y);
    ctx.globalAlpha = 0.35 + Math.max(0, pulse) * 0.25;
    drawShip(ctx, ship.id, p.radius, '#e879f9', '#86198f', t, 0.6);
    ctx.restore();
  }

  // Player
  if (inRun && !e.isDying) {
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
    if (blinking) ctx.globalAlpha = fxPrefs.reduceFlash ? 0.6 : Math.sin(t * 40) < 0 ? 0.35 : 1;

    // Combo halo on the floor under the ship: violet at x10, gold and spinning at x20
    if (e.combo >= 10 && !e.isFeverActive) {
      const hot = e.combo >= 20;
      const col = hot ? '#fbbf24' : '#e879f9';
      drawGlow(ctx, 0, p.radius * 0.6, p.radius * (hot ? 3 : 2.4), col, 0.22 + Math.sin(t * 6) * 0.06);
      ctx.save();
      ctx.strokeStyle = hexToRgba(col, 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, p.radius * 0.8, p.radius * 1.7, p.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (hot) {
        ctx.strokeStyle = hexToRgba('#fde68a', 0.85);
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 60;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, p.radius * 0.8, p.radius * 2.3, p.radius * 0.78, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

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

    // Muzzle flash at the nose
    if (p.muzzleFlash > 0) {
      const mf = p.muzzleFlash;
      const ny = -p.radius * 1.55;
      drawGlow(ctx, 0, ny, p.radius * 1.3 * mf, mainColor, mf * 0.9);
      drawGlow(ctx, 0, ny, p.radius * 0.6 * mf, '#ffffff', mf);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexToRgba('#ffffff', 0.8 * mf);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (k - 1.5) * 0.55;
        const len = p.radius * (k === 1 || k === 2 ? 1.1 : 0.6) * mf;
        ctx.moveTo(0, ny);
        ctx.lineTo(Math.cos(a) * len, ny + Math.sin(a) * len);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Sovereign's wingman drones
    if (ship.id === 'sovereign') {
      p.drones.forEach((d, k) => drawWingDrone(ctx, d.x, d.y, t, mainColor, k, p.volley % 2 === 0 ? p.muzzleFlash : 0));
    }
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

  // Graze sparks & chain lightning
  for (const a of e.grazeArcs) drawLightning(ctx, a.x1, a.y1, a.x2, a.y2, a.color, a.alpha);

  if (level?.fog && inRun) drawFog(ctx, W, H, p.x, p.y, 240, t);

  // Floating texts with a pop-in scale
  const font = canvasFont();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const ft of e.floatingTexts) {
    const pop = 1 + Math.max(0, 1 - ft.age * 7) * 0.5;
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = `700 ${Math.round(ft.size * pop)}px ${font}`;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();

  ctx.restore();

  if (e.flashAlpha > 0) {
    // Reduce Flashing keeps a faint tint so hits still read, without full-screen strobes
    const a = e.fxReduceFlash ? Math.min(0.08, e.flashAlpha * 0.15) : e.flashAlpha * 0.6;
    ctx.fillStyle = hexToRgba(e.flashColor, a);
    ctx.fillRect(0, 0, W, H);
  }
  drawVignette(ctx, W, H);
}
