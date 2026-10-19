import React from 'react';
import {
  Crown,
  Flame,
  Gem,
  LucideProps,
  Rocket,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  crown: Crown,
  flame: Flame,
  gem: Gem,
  rocket: Rocket,
  shield: Shield,
  skull: Skull,
  sparkles: Sparkles,
  trophy: Trophy,
  zap: Zap,
};

/** Renders a lucide icon from a string key stored in game data. */
export const Icon: React.FC<{ name: string } & LucideProps> = ({ name, ...props }) => {
  const Cmp = ICONS[name] || Sparkles;
  return <Cmp {...props} />;
};

/** Shard currency glyph — a small gem tinted amber. */
export const ShardIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 14 }) => (
  <Gem size={size} className={`text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)] ${className}`} />
);
