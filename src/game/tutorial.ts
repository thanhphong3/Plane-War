import { tr } from '../i18n';

export type LessonId = 'move' | 'shards' | 'graze' | 'dash' | 'parry' | 'emp' | 'overdrive';

export interface Lesson {
  id: LessonId;
  /** Progress needed to clear the lesson. */
  target: number;
  title: () => string;
  /** What to do, for touch and for keyboard. */
  touch: () => string;
  keys: () => string;
  /** Shown under the goal as a reason why the move matters. */
  why: () => string;
}

/** Flight Training: one mechanic per lesson, in the order the game leans on them. */
export const LESSONS: Lesson[] = [
  {
    id: 'move',
    target: 1400,
    title: () => tr('Fly', 'Bay'),
    touch: () => tr('Drag anywhere on the screen to steer.', 'Kéo ở bất kỳ đâu trên màn hình để lái.'),
    keys: () => tr('Or use WASD / arrow keys.', 'Hoặc dùng WASD / phím mũi tên.'),
    why: () => tr('Your finger never covers the ship: drag from wherever is comfortable.', 'Ngón tay không bao giờ che tàu: kéo từ chỗ nào thoải mái.'),
  },
  {
    id: 'shards',
    target: 12,
    title: () => tr('Collect Shards', 'Nhặt Mảnh'),
    touch: () => tr('Fly over the gold shards.', 'Bay qua các mảnh vàng.'),
    keys: () => tr('Each one raises your combo.', 'Mỗi mảnh tăng combo của bạn.'),
    why: () => tr('Shards buy ships and upgrades in the Hangar.', 'Mảnh dùng để mua tàu và nâng cấp ở Xưởng tàu.'),
  },
  {
    id: 'graze',
    target: 6,
    title: () => tr('Graze', 'Sượt Đạn'),
    touch: () => tr('Skim past enemy bullets without touching them.', 'Lượn sát đạn địch mà không chạm vào.'),
    keys: () => tr('Bullets have a tiny hitbox: only the bright core hurts.', 'Đạn có vùng va chạm rất nhỏ: chỉ lõi sáng mới gây sát thương.'),
    why: () => tr('Grazes score big and charge Overdrive. Hits are harmless in training.', 'Sượt đạn cho nhiều điểm và nạp Quá Tải. Trúng đạn không sao trong lúc tập.'),
  },
  {
    id: 'dash',
    target: 3,
    title: () => tr('Dash Smash', 'Lướt Húc'),
    touch: () => tr('Double-tap to Dash, then ram the drone mines.', 'Chạm đúp để Lướt, rồi húc vào mìn bay.'),
    keys: () => tr('Keyboard: Space or Shift.', 'Bàn phím: Space hoặc Shift.'),
    why: () => tr('Nothing hurts you mid-Dash. Your guns are off for this lesson.', 'Đang Lướt thì không gì hại được bạn. Súng tạm tắt trong bài này.'),
  },
  {
    id: 'parry',
    target: 2,
    title: () => tr('Parry', 'Phản Đòn'),
    touch: () => tr('Dash INTO the orange Plasma Core.', 'Lướt VÀO Lõi Plasma màu cam.'),
    keys: () => tr('The cyan ring marks it as parryable.', 'Vòng xanh cho biết có thể phản đòn.'),
    why: () => tr('Bosses throw these. A parry sends them straight back.', 'Boss hay ném thứ này. Phản đòn sẽ bắn ngược nó về boss.'),
  },
  {
    id: 'emp',
    target: 1,
    title: () => tr('EMP Bomb', 'Bom EMP'),
    touch: () => tr('Tap the EMP button when the screen fills up.', 'Bấm nút EMP khi màn hình đầy địch.'),
    keys: () => tr('Keyboard: E or B.', 'Bàn phím: E hoặc B.'),
    why: () => tr('It wipes every enemy and bullet and turns them into shards.', 'Nó xóa sạch địch và đạn, biến chúng thành mảnh.'),
  },
  {
    id: 'overdrive',
    target: 1,
    title: () => tr('Overdrive', 'Quá Tải'),
    touch: () => tr('Graze and collect until the Overdrive bar is full.', 'Sượt đạn và nhặt mảnh cho tới khi thanh Quá Tải đầy.'),
    keys: () => tr('It fires on its own once full.', 'Nó tự kích hoạt khi đầy.'),
    why: () => tr('Overdrive: invincible, double score, and your guns go wild.', 'Quá Tải: bất tử, gấp đôi điểm, súng bắn dữ dội.'),
  },
];

export const lessonAt = (step: number): Lesson | null => LESSONS[step] ?? null;
