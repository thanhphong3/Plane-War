import React, { useEffect, useRef } from 'react';
import { drawShip } from '../game/render';
import { ShipDef } from '../types/game';

interface ShipPreviewProps {
  ship: ShipDef;
  size?: number;
  animate?: boolean;
  locked?: boolean;
}

/** Renders the same vector ship art the game uses, at thumbnail size. */
export const ShipPreview: React.FC<ShipPreviewProps> = ({ ship, size = 48, animate = false, locked = false }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let raf = 0;
    const render = (now: number) => {
      const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size * 0.46 + (animate ? Math.sin(t * 2.4) * size * 0.03 : 0));
      if (locked) ctx.globalAlpha = 0.35;
      drawShip(ctx, ship.id, size * 0.24, ship.color, ship.secondary, t, 0.6);
      ctx.restore();
      if (animate) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [ship, size, animate, locked]);

  return <canvas ref={ref} style={{ width: size, height: size }} className="block" />;
};
