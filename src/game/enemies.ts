import { tr } from '../i18n';
import { HazardEntity } from '../types/game';

type HazardType = HazardEntity['type'];

/** Display name of an enemy type (run report, "destroyed by" line). */
export const enemyLabel = (type: HazardType): string =>
  ({
    drone: tr('Drone mine', 'Mìn bay'),
    seeker: tr('Seeker', 'Tên lửa đuổi'),
    spinner: tr('Spinner', 'Lưỡi xoay'),
    turret: tr('Turret', 'Ụ súng'),
    shot: tr('Enemy fire', 'Đạn địch'),
    orb: tr('Plasma Core', 'Lõi Plasma'),
    splitter: tr('Splitter', 'Khối tách'),
    sniper: tr('Sniper', 'Xạ thủ'),
    kamikaze: tr('Kamikaze', 'Cảm tử'),
    shielder: tr('Bulwark', 'Thành Lũy'),
    mender: tr('Mender', 'Hộ Pháp'),
    bomber: tr('Bomber', 'Oanh tạc cơ'),
    mine: tr('Proximity mine', 'Mìn cảm ứng'),
  })[type];

/** IRIS introduces each newer enemy type the first time it shows up in a run. */
export const enemyIntel = (type: HazardType): string | null => {
  switch (type) {
    case 'shielder':
      return tr(
        'Bulwark inbound: its shield blocks shots from below. Dash through it or hit it from the side.',
        'Thành Lũy đang tới: khiên của nó chặn đạn từ phía dưới. Lướt xuyên qua hoặc bắn từ bên hông.'
      );
    case 'mender':
      return tr(
        'Mender spotted: its green beams make nearby enemies bulletproof. Take it out first.',
        'Phát hiện Hộ Pháp: tia xanh của nó khiến kẻ địch gần đó miễn nhiễm đạn. Hạ nó trước.'
      );
    case 'bomber':
      return tr(
        'Bomber on the wing: it drops proximity mines. Shoot them, or stay clear when they flash.',
        'Oanh tạc cơ đang bay qua: nó thả mìn cảm ứng. Bắn mìn, hoặc tránh xa khi chúng nhấp nháy.'
      );
    default:
      return null;
  }
};

/** Mines go off when the pilot comes this close (also drawn as their warning ring). */
export const MINE_TRIGGER_RADIUS = 85;

/** Menders ward up to this many enemies within this range. */
export const MENDER_RANGE = 210;
export const MENDER_LINKS = 3;

/** A Bulwark blocks bullets arriving within this angle (radians) of straight below it. */
export const SHIELD_ARC = 1.05;

/** True if a bullet at (bx, by) strikes a Bulwark's shield rather than its hull. */
export const hitsShield = (h: HazardEntity, bx: number, by: number) => {
  const a = Math.atan2(by - h.y, bx - h.x);
  return Math.abs(a - Math.PI / 2) < SHIELD_ARC;
};
