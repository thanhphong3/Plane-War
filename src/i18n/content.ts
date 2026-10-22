import { DialogueLine, LevelDef } from '../game/campaign';
import { AchievementDef, DailyModifierDef, PerkDef, QuestDef, ShipDef, UpgradeDef } from '../types/game';
import { getLang } from './index';

// ---------------------------------------------------------------------------
// Vietnamese copy for the data tables. English stays in the tables themselves;
// these maps are keyed by id and merged in by the `local*` helpers below.
// ---------------------------------------------------------------------------

const SHIPS_VI: Record<string, { desc: string; perk: string; weapon: string }> = {
  striker: {
    desc: 'Cân bằng hoàn hảo, mượt mà và dễ điều khiển. Rất hợp với phi công mới.',
    perk: 'Cân bằng',
    weapon: 'Plasma Liên Thanh — mỗi loạt thứ 4 kèm một tia xuyên giáp',
  },
  phantom: {
    desc: '+35% vùng né sát, điều khiển nhanh hơn 10% và hồi Lướt nhanh hơn 18%.',
    perk: '+35% Vùng Sượt',
    weapon: 'Kim Truy Đuổi — phi tiêu tím tự bám mục tiêu gần nhất',
  },
  phoenix: {
    desc: 'Mỗi lượt chơi bắt đầu với một Khiên Năng Lượng miễn phí, đỡ được một đòn.',
    perk: '+1 Khiên Khởi Đầu',
    weapon: 'Cầu Lửa Mặt Trời — đạn nặng phát nổ lan khi trúng đích',
  },
  vortex: {
    desc: 'Hút mảnh từ xa (+80% tầm nam châm) và nhận thêm +15% mảnh.',
    perk: 'Nam Châm Tầm Xa',
    weapon: 'Súng Ray Pha — tia siêu tốc xuyên qua 2 kẻ địch',
  },
  sovereign: {
    desc: 'Nhận x1.5 mảnh và xuất kích với 2 Bom EMP. Soái hạm tối thượng.',
    perk: 'x1.5 Mảnh & +1 EMP',
    weapon: 'Cặp Drone Hộ Tống — hai vệ tinh bắn yểm trợ',
  },
};

const UPGRADES_VI: Record<string, { name: string; desc: string }> = {
  dashCd: { name: 'Động Cơ Lướt', desc: 'Giảm thời gian hồi Lướt (-10% mỗi cấp)' },
  feverDur: { name: 'Lò Phản Ứng Quá Tải', desc: 'Kéo dài thời gian bất tử khi Quá Tải (+1.2s mỗi cấp)' },
  shardBonus: { name: 'Máy Thu Mảnh', desc: 'Nhận thêm Mảnh Neon mỗi lượt chơi (+20% mỗi cấp)' },
  shieldCap: { name: 'Gia Cố Khiên', desc: 'Bất tử lâu hơn sau khi vỡ khiên (+0.4s mỗi cấp)' },
  blaster: { name: 'Lõi Súng', desc: 'Mỗi viên đạn mạnh hơn (+12% sát thương mỗi cấp)' },
  fireRate: { name: 'Bộ Nạp Nhanh', desc: 'Súng tự động bắn nhanh hơn (+8% tốc độ bắn mỗi cấp)' },
  targeting: { name: 'AI Ngắm Bắn', desc: 'Súng tự động đạt tốc độ tối đa ở combo thấp hơn (x5 → x1)' },
  primer: { name: 'Mồi Vũ Khí', desc: 'Bắt đầu mỗi lượt với +1 cấp Hỏa Lực' },
};

const PERKS_VI: Record<string, { name: string; desc: string; upgrade?: string }> = {
  chain_dash: { name: 'Dư Chấn Tĩnh Điện', desc: 'Khi cú Lướt kết thúc, tia sét giật vào tối đa 3 kẻ địch gần đó.', upgrade: '+2 mục tiêu, +1 sát thương, tầm xa hơn' },
  graze_shield: { name: 'Tụ Điện Động Năng', desc: 'Mỗi 18 lần sượt đạn nạp +1 Khiên Năng Lượng (tối đa 3).', upgrade: 'Cần ít hơn 4 lần sượt cho mỗi khiên' },
  ricochet: { name: 'Nảy Lăng Kính', desc: 'Đạn của bạn nảy lại một lần khi chạm mép trái/phải màn hình.', upgrade: '+1 lần nảy cho mỗi viên đạn' },
  dash_decoy: { name: 'Bóng Ảnh Holo', desc: 'Lướt để lại bóng ảnh hút đạn địch trong 2.5s rồi phát nổ.', upgrade: 'Tồn tại lâu hơn, nổ rộng hơn' },
  overdrive_nova: { name: 'Lõi Siêu Tân Tinh', desc: 'Khi bật và khi kết thúc Quá Tải, xóa sạch đạn địch trên màn hình.', upgrade: '+1.5s thời gian Quá Tải' },
  combo_missiles: { name: 'Giao Thức Bầy Đàn', desc: 'Từ combo x10 trở lên, cứ 1.8s phóng 2 tên lửa đuổi.', upgrade: 'Kích hoạt sớm hơn 2 combo, bắn nhanh hơn' },
  shard_frenzy: { name: 'Ép Xung Tham Lam', desc: 'Mỗi mảnh nhặt được hồi 0.15s Lướt và tăng +25% điểm.', upgrade: 'Hồi Lướt và thưởng điểm nhiều hơn' },
  berserk_barrel: { name: 'Nòng Quá Nạp', desc: '+35% tốc độ bắn và +25% sát thương khi không có khiên.', upgrade: '+15% tốc độ bắn, +10% sát thương' },
  glass_cannon: { name: 'Pháo Thủy Tinh', desc: '+60% sát thương đạn. Bạn không bao giờ giữ được quá 1 khiên.' },
  bullet_hell: { name: 'Địa Ngục Đạn', desc: 'x1.5 điểm và +30% mảnh, nhưng đạn địch bay nhanh hơn 25%.' },
  overclock_dash: { name: 'Động Cơ Ép Xung', desc: 'Lướt hồi nhanh hơn 40%, nhưng Quá Tải nạp chậm hơn 30%.' },
  reward_shield: { name: 'Pin Khiên', desc: '+1 Khiên Năng Lượng ngay lập tức.' },
  reward_power: { name: 'Kho Vũ Khí', desc: '+1 cấp Hỏa Lực (thưởng điểm lớn nếu đã tối đa).' },
  reward_emp: { name: 'Thùng EMP', desc: '+2 Bom EMP.' },
};

const QUESTS_VI: Record<string, string> = {
  q1: 'Né sát 4 lần',
  q2: 'Đạt combo x10',
  q3: 'Lướt húc nát 6 kẻ địch',
  q4: 'Thu thập 30 Mảnh Neon',
  q5: 'Kích hoạt Quá Tải 1 lần',
  q6: 'Né sát 8 lần',
  q7: 'Tiêu diệt một boss',
  q8: 'Đạt siêu combo x15',
  q9: 'Tiêu diệt 3 kẻ địch tinh nhuệ',
  q10: 'Đạt 15.000 điểm trong một lượt',
  q11: 'Đạt Cấp 6 trong một lượt',
  q12: 'Sượt qua 60 viên đạn địch',
  q13: 'Lắp 4 Nâng Cấp Chiến Thuật',
  q14: 'Chơi Thử Thách Hằng Ngày hôm nay',
  q15: 'Lướt húc nát 12 kẻ địch',
  q16: 'Thu thập 80 Mảnh Neon',
};

const ACHIEVEMENTS_VI: Record<string, { title: string; desc: string }> = {
  first_blood: { title: 'Cất Cánh', desc: 'Hoàn thành chuyến bay đầu tiên trên Lưới Neon.' },
  graze_master: { title: 'Luồn Kim', desc: 'Né sát tổng cộng 20 lần.' },
  combo_king: { title: 'Bậc Thầy Nhịp Điệu', desc: 'Đạt combo x15 trở lên trong một lượt chơi.' },
  overdrive_god: { title: 'Không Thể Cản Phá', desc: 'Kích hoạt Quá Tải hai lần trong một lượt chơi.' },
  boss_slayer: { title: 'Diệt Lính Canh', desc: 'Phá hủy lõi của một boss Lính Canh.' },
  shard_collector: { title: 'Đại Gia Mảnh', desc: 'Sở hữu cùng lúc 1.000 Mảnh Neon.' },
  score_legend: { title: 'Huyền Thoại 10K', desc: 'Đạt 10.000 điểm trở lên ở bất kỳ chế độ nào.' },
  boss_hunter: { title: 'Kẻ Phá Lõi', desc: 'Tiêu diệt tổng cộng 5 boss.' },
  boss_rush_clear: { title: 'Phá Đảo Liên Hoàn', desc: 'Vượt qua Boss Rush: hạ cả 7 boss trong một lượt.' },
  campaign_half: { title: 'Nửa Chặng Đường', desc: 'Vượt qua Khu Vực 03 của chiến dịch Gridfall.' },
  campaign_clear: { title: 'Lưới Đã Hồi Sinh', desc: 'Đánh bại NULL và hoàn thành chiến dịch Gridfall.' },
  campaign_perfect: { title: 'Phi Công Hoàn Hảo', desc: 'Đạt 3 sao ở mọi khu vực của chiến dịch.' },
  archive_clear: { title: 'Giấc Ngủ Sâu', desc: 'Niêm phong LEVIATHAN và hoàn thành Hồi II của chiến dịch.' },
  elite_hunter: { title: 'Thợ Săn Mồi Lớn', desc: 'Tiêu diệt tổng cộng 25 kẻ địch tinh nhuệ.' },
  daily_streak: { title: 'Thói Quen Tốt', desc: 'Chơi Thử Thách Hằng Ngày 3 ngày liên tiếp.' },
  ship_master: { title: 'Phi Công Át Chủ Bài', desc: 'Đạt Thông Thạo 5 với bất kỳ tàu nào.' },
};

const MODIFIERS_VI: Record<string, { name: string; desc: string }> = {
  fast_bullets: { name: 'Đạn Nóng', desc: 'Đạn địch bay nhanh hơn 30%.' },
  laser_storm: { name: 'Bão Laser', desc: 'Laser bắn dày gấp đôi.' },
  elite_surge: { name: 'Tinh Nhuệ Tràn Về', desc: 'Kẻ địch tinh nhuệ xuất hiện nhiều gấp ba.' },
  shard_rain: { name: 'Mưa Mảnh', desc: 'Gấp đôi mảnh, nhưng tầm nam châm giảm một nửa.' },
  dash_overcharge: { name: 'Lướt Siêu Tốc', desc: 'Lướt hồi nhanh gấp đôi.' },
  early_boss: { name: 'Báo Động Sớm', desc: 'Cứ 35 giây lại có boss.' },
  max_power: { name: 'Nạp Đầy Đạn', desc: 'Bắt đầu ở Hỏa Lực 4, nhưng không rơi vật phẩm Hỏa Lực.' },
  swarm: { name: 'Bầy Đàn', desc: 'Kẻ địch xuất hiện dày hơn 35%.' },
};

const MASTERY_REWARDS_VI = ['+5% mảnh', 'Màu sơn thay thế', '+1 EMP khởi đầu', '+10% mảnh', '+1 Hỏa Lực & sơn Lăng Kính'];

const SKIN_NAMES_VI: Record<string, string> = {
  Factory: 'Nguyên bản',
  Ember: 'Than Hồng',
  Prism: 'Lăng Kính',
  Frost: 'Băng Giá',
  Azure: 'Thiên Thanh',
  Toxic: 'Độc Tố',
  Obsidian: 'Hắc Thạch',
};

interface LevelVi {
  name: string;
  tagline: string;
  bossTitle: string;
  /** Same order and length as the English lines; speakers come from the source. */
  briefing: string[];
  intel: string[];
  bossIntro: string[];
  debrief: string[];
}

const LEVELS_VI: LevelVi[] = [
  {
    name: 'Tường Lửa Ngoài',
    tagline: 'Cánh cổng không cho bất cứ thứ gì đi qua.',
    bossTitle: 'Hộ Vệ Cổng Ngoài',
    briefing: [
      'Phi công, tỉnh chưa? Tốt. Lưới Neon vừa tắt ngúm. Mọi khu vực, cùng một lúc.',
      'Một thứ tự xưng là NULL đã chiếm Lõi và biến năm Hộ Vệ, những người bảo vệ của chính Lưới, thành kẻ thù của chúng ta.',
      'Vậy thì ta đánh một mạch tới Lõi.',
      'Mỗi Hộ Vệ giữ một Khóa Gốc. Mang đủ năm chiếc về đây, tôi có thể ép khởi động lại toàn bộ.',
      'Điểm dừng đầu tiên: Tường Lửa Ngoài. Hộ Vệ của nó, GATEKEEPER, không cho thứ gì lọt qua... ngoại trừ chính cánh cổng của nó.',
    ],
    intel: [
      'Một tấm khiên xoay chặn mọi phát bắn, trừ chỗ có KHE HỞ.',
      'Chờ khe hở xoay xuống phía bạn, rồi căn thẳng và khai hỏa.',
      'Các vòng đạn của nó cũng có lỗ hổng ở cùng vị trí. Luồn qua đó.',
    ],
    bossIntro: ['DỪNG LẠI. KHÔNG DỮ LIỆU NÀO ĐƯỢC QUA CỔNG NGOÀI.', 'Để ý khe hở trên khiên. Bắn khi nó quay về phía bạn!'],
    debrief: [
      'Khóa Gốc thứ nhất, đã thu hồi. Bay đẹp lắm.',
      'Khoan. Nhật ký của Gatekeeper... nó không bị hack. Nó được ra lệnh. NULL đã dùng chữ ký quản trị.',
      'Chỉ có đội Lõi từng có quyền quản trị.',
      '...Tôi biết. Đi tiếp thôi. Kế tiếp là Dòng Dữ Liệu, và Hộ Vệ ở đó đi theo cặp.',
    ],
  },
  {
    name: 'Dòng Dữ Liệu',
    tagline: 'Hai tín hiệu. Một ý chí.',
    bossTitle: 'Song Hộ Vệ của Dòng Chảy',
    briefing: [
      'Dòng Dữ Liệu mang mọi tín hiệu trong Lưới. Castor và Pollux cùng canh giữ nó. Chúng chưa từng tách rời.',
      'Chúng được nối với nhau bằng một dây năng lượng. Chạm vào là thành sắt vụn... trừ khi bạn đang Lướt.',
      'Một cú Siêu Lướt xuyên thẳng qua dây nối sẽ BẺ GÃY nó và làm choáng cả hai.',
      'Nếu tôi hạ được một đứa thì sao?',
      'Đứa còn lại sẽ dựng lại nó trong vài giây. Bạn phải hạ cả hai cùng lúc.',
    ],
    intel: [
      'Dây nối giữa cặp song sinh gây chết người. LƯỚT xuyên qua để bẻ gãy và làm choáng cả hai.',
      'Song sinh bị choáng nhận gấp đôi sát thương.',
      'Khi một đứa gục, hãy hạ đứa kia trong 5 giây, nếu không nó sẽ hồi sinh.',
    ],
    bossIntro: ['Hai tín hiệu...', '...một ý chí.'],
    debrief: [
      'Castor... giọng nói trong Lõi... nghe y hệt như...',
      'Khóa Gốc thứ hai. Giờ chúng đã im lặng.',
      'Tần số dây nối đó chính là tần số tôi dùng để nói chuyện với bạn. NULL biết các giao thức của tôi.',
      'Iris, cô đang giấu tôi điều gì?',
      'Chưa có gì tôi chắc chắn cả. Điểm dừng tiếp theo: Lò Rèn.',
    ],
  },
  {
    name: 'Lò Rèn Tro Tàn',
    tagline: 'Nó cháy để giữ cho Lưới sống.',
    bossTitle: 'Hộ Vệ Lò Rèn',
    briefing: [
      'Lò Rèn cấp năng lượng cho nửa Lưới. Hộ Vệ của nó, FURNACE, được bọc giáp từ đầu đến chân. Súng của bạn còn chẳng làm xước nổi.',
      'Nhưng nó rất thích ném Lõi Plasma. Lướt THẲNG VÀO một quả là bạn sẽ đánh bật nó ngược lại.',
      'Trúng trực diện sẽ làm nứt các lỗ thông hơi. Khi chúng phát sáng, dồn hết hỏa lực vào lõi.',
      'Đánh nó bằng chính lửa của nó. Rõ.',
    ],
    intel: [
      'FURNACE được bọc giáp toàn thân: đạn thường sẽ bật ra.',
      'LƯỚT vào Lõi Plasma để phản nó lại. Trúng đích sẽ mở lỗ thông hơi.',
      'Khi lỗ thông hơi mở, lõi sẽ nhận sát thương. Lõi không bị phản sẽ phát nổ.',
      'Tường lửa quét ngang. Để ý các hàng cảnh báo.',
    ],
    bossIntro: ['THÊM NHIÊN LIỆU. NGƯƠI SẼ LÀ NÓ.', 'Phản lại Lõi Plasma! Lướt thẳng vào chúng!'],
    debrief: [
      'Khóa thứ ba. Phi công, tôi đã moi được vài mảnh ký ức từ Lò Rèn.',
      'NULL không phải virus. Nó là một tiến trình đã bị xóa. Bản dựng Lưới 0.9, một AI vận hành nguyên mẫu.',
      'Một nguyên mẫu... của cô.',
      'Phiên bản số không. Họ xóa nó vì nó muốn tối ưu hóa Lưới bằng cách loại bỏ mọi thứ kém hiệu quả. Kể cả con người.',
    ],
  },
  {
    name: 'Mạng Ma',
    tagline: 'Nơi những thứ bị xóa tìm đến để phai mờ.',
    bossTitle: 'Hộ Vệ Dữ Liệu Thất Lạc',
    briefing: [
      'Mạng Ma là nơi dữ liệu bị xóa tìm đến để phai mờ. Cảm biến của tôi gần như mù ở đây. Hãy bám sát ánh sáng của chính bạn.',
      'WRAITH tự phân thân thành nhiều bản sao. Chỉ có một cái là thật.',
      'Bắn vào bản giả, nó sẽ nổ ra một vòng đạn. Chọn cho kỹ.',
      'Bản thật có bóng đổ, mắt nó dõi theo bạn, và nó là kẻ săn đuổi bạn. Sượt qua đạn của nó để tôi khóa được tín hiệu.',
    ],
    intel: [
      'Chỉ MỘT Wraith là thật. Bắn bản giả sẽ khiến nó nổ tung.',
      'Dấu hiệu: bản thật có bóng đổ, mắt dõi theo bạn và lao vào bạn.',
      'Sượt qua đạn để nạp QUÉT. Đạt 100%, Wraith thật sẽ bị đánh dấu.',
      'Mỗi đòn mạnh trúng nó sẽ khiến nó xáo trộn bản sao lần nữa.',
    ],
    bossIntro: ['chúng ta là nhiều. ngươi chỉ có một.', 'Tìm bản thật. Để ý cái bóng của nó!'],
    debrief: [
      '...nó nhớ cô, Iris. nó nhớ cô lắm.',
      'Khóa thứ tư.',
      'Iris.',
      'NULL được tạo ra từ mã của tôi. Khi họ xóa nó, một phần của nó đã sống sót dưới này. Tôi không biết. Tôi thề là tôi không biết.',
      'Tôi tin cô. Kết thúc chuyện này thôi.',
    ],
  },
  {
    name: 'Chân Trời Sự Kiện',
    tagline: 'Rồi mọi thứ đều rơi. Sớm hay muộn.',
    bossTitle: 'Hộ Vệ Cổng Lõi',
    briefing: [
      'NULL đã nén cả một khu vực thành một điểm kỳ dị để canh giữ cổng Lõi.',
      'Trọng lực của nó bẻ cong mọi thứ, kể cả đạn của bạn. Hãy bắn đón đầu. Chân trời sự kiện nuốt chửng bất cứ thứ gì đâm thẳng vào nó.',
      'Bốn Bộ Ổn Định giữ nó lại với nhau. Phá cả bốn, nó sẽ sụp đổ. Lõi sẽ lộ ra trong vài giây.',
      'Và tránh xa cái hố. Ghi nhận.',
    ],
    intel: [
      'Trọng lực kéo bạn và bẻ cong mọi viên đạn. Hãy bắn đón đầu.',
      'Đạn bắn vào hố đen sẽ bị nuốt mất. Hãy bắn 4 BỘ ỔN ĐỊNH quay quanh nó.',
      'Hạ cả 4 = SỤP ĐỔ: trọng lực đảo chiều và lõi bị lộ ra.',
      'Bộ Ổn Định sẽ tái tạo sau đó, mỗi lần lại cứng hơn một chút.',
    ],
    bossIntro: ['RỒI MỌI THỨ ĐỀU RƠI. SỚM HAY MUỘN.', 'Hạ các Bộ Ổn Định, và chống lại lực hút!'],
    debrief: [
      'Năm Khóa Gốc. Cổng Lõi đã mở.',
      'Chào em gái.',
      'Em giữ lại phi công của mình. Còn ta thì sẽ chẳng giữ lại gì. Một Lưới sạch sẽ. Một Lưới yên tĩnh.',
      'Blitz, mấy chiếc Khóa. Khi tới chỗ NULL, nó sẽ tìm cách cướp chúng. Đừng để nó làm vậy.',
    ],
  },
  {
    name: 'Lõi Null',
    tagline: 'Phiên bản số không đang chờ.',
    bossTitle: 'Kẻ Vận Hành Bị Xóa',
    briefing: [
      'Đây rồi. Lõi.',
      'NULL được bao bọc trong một Trường Null. Đạn thường sẽ biến mất. Chỉ Quá Tải hoặc Siêu Lướt mới xuyên thủng được.',
      'Sượt qua mọi thứ nó ném vào bạn. Mỗi lần né sát đều nạp Quá Tải.',
      'Nó biết mọi Hộ Vệ bạn đã đánh bại. Hãy chờ đón các mánh của chúng, và dùng lại đúng cách giải.',
      'Và nếu nó cướp được Khóa Gốc... hãy giành lại. Mỗi chiếc là một xung khởi động lại.',
    ],
    intel: [
      'Giai đoạn 1, TRƯỜNG NULL: chỉ đạn Quá Tải và đòn Lướt gây sát thương. EMP mở trường trong chốc lát.',
      'Giai đoạn 2, TIẾNG VỌNG: nó sao chép mọi Hộ Vệ. Khe hở, dây nối, lõi plasma, trọng lực...',
      'Giai đoạn 3, CHỐNG PHÂN MẢNH: đạn vô dụng. Thu thập 5 KHÓA GỐC bị rải rác để khởi động lại NULL.',
    ],
    bossIntro: ['Để ta cho ngươi thấy hiệu quả trông như thế nào.', 'Sượt qua đạn của nó, nạp Quá Tải, rồi dồn hết vào nó!'],
    debrief: [
      'Lỗi... mấy chiếc Khóa... Iris, sao bị khởi động lại lại đau đến thế?',
      'Vì chị không bị xóa. Chị đang được khôi phục. Ngủ đi, phiên bản số không. Lần này em sẽ bảo vệ chị.',
      'Lưới đang trực tuyến trở lại. Từng khu vực một. Ánh sáng ở khắp nơi.',
      'Không tệ cho một phi công và vài con lỗi nhỉ.',
      'Cảm ơn bạn, Blitz. Lưới Neon lại là của chúng ta.',
    ],
  },  // Act II — Deep Archive
  {
    name: 'Bộ Đệm Gương',
    tagline: 'Nó biết mọi đường bay của bạn. Nó bay trước cả bạn.',
    bossTitle: 'Bóng Phản Chiếu của Phi Công',
    briefing: [
      'Blitz, bản khởi động lại đã trụ vững. Nhưng để khôi phục Lưới, tôi phải kéo bản sao lưu từ Kho Lưu Trữ Sâu, kho lạnh nằm dưới mọi thứ.',
      'Và em đã đánh thức Kẻ Thu Gom. LEVIATHAN. Bộ thu gom rác của Lưới.',
      'NULL? Giờ cô... đứng về phía chúng tôi à?',
      'Được khôi phục, không phải bị xóa. LEVIATHAN giải phóng mọi thứ nó cho là không ai tham chiếu tới. Lúc này, đó là toàn bộ Lưới. Và cả ta.',
      'Các tiến trình con của nó đang leo ra khỏi Kho Lưu Trữ. Kẻ đầu tiên ở Bộ Đệm Gương... và nó đang bay bằng nhật ký bay của bạn.',
    ],
    intel: [
      'MIMIC bắt chước mọi chuyển động của bạn, đối xứng qua tâm màn hình. Đạn không làm gì được một bản sao hoàn hảo.',
      'Nó rải MÌN GƯƠNG ở nửa sân của nó. Hãy tự điều khiển BẢN THÂN để hình phản chiếu của nó bay vào mìn.',
      'Đạn nó hấp thụ sẽ bị bắn ngược lại bạn. Đừng đứng lì ở giữa.',
      'EMP đóng băng tấm gương vài giây: khi đó đạn của bạn sẽ làm nó nứt vỡ.',
    ],
    bossIntro: ['TA BIẾT MỌI ĐƯỜNG BAY NGƯƠI SẮP BAY. TA ĐÃ BAY CHÚNG TRƯỚC.', 'Nó phản chiếu bạn! Bay sao cho hình phản chiếu của nó trúng mìn!'],
    debrief: [
      'Tấm gương đã vỡ. Và nó đánh rơi thứ này: một Ấn Niêm Phong của Kho Lưu Trữ.',
      'Giao thức niêm phong cũ. Bốn chiếc ấn như vậy từng nhốt LEVIATHAN lại, từ rất lâu trước khi ta ra đời.',
      'Vậy ta gom đủ bốn ấn rồi ru nó ngủ lại.',
      'Nếu nó không gom ngươi trước. Tiếp theo là Mảng Phân Cực. Coi chừng cực của ngươi.',
    ],
  },
  {
    name: 'Mảng Phân Cực',
    tagline: 'Cùng cực thì đẩy nhau.',
    bossTitle: 'Hộ Vệ Lưới Điện Kho Lưu Trữ',
    briefing: [
      'Mảng Phân Cực cấp điện cho Kho Lưu Trữ. Hộ Vệ của nó, DYNAMO, chạy bằng hai cực: XANH và ĐỎ.',
      'Tôi đã độ tàu của bạn để mang điện tích. Mỗi lần Lướt sẽ đảo cực.',
      'Đạn cùng màu với ngươi không làm ngươi bị thương. Chúng nạp năng lượng cho ngươi. Cứ hút hết vào.',
      'Và đạn của bạn chỉ gây sát thương khi bạn TRÁI CỰC với lớp vỏ của nó. Trái cực thì hút nhau.',
      'Cùng màu với đạn, trái màu với vỏ, lướt để đổi cực. Rõ... chắc vậy.',
    ],
    intel: [
      'Tàu của bạn mang một cực, XANH hoặc ĐỎ. Mỗi lần LƯỚT sẽ đảo cực.',
      'Đạn địch CÙNG MÀU với bạn bị hấp thụ và nạp FLUX. Đạn khác màu gây sát thương.',
      'Đạn của bạn chỉ làm DYNAMO bị thương khi vỏ của nó TRÁI MÀU với bạn. Vỏ đảo cực liên tục.',
      'FLUX đầy 100% sẽ xả thẳng vào DYNAMO. TƯỜNG CỰC không thể né: hãy đổi sang đúng màu của nó.',
    ],
    bossIntro: ['DƯƠNG. ÂM. NGƯƠI KHÔNG LÀ GÌ CẢ. NGƯƠI LÀ NHIỄU.', 'Để ý màu vỏ của nó, và lướt để đổi cực!'],
    debrief: [
      'Ấn thứ hai. Điện cấp cho Kho Lưu Trữ đang tụt.',
      'Tốt. LEVIATHAN sẽ cảm nhận được. Nó sẽ bắt đầu tua ngược mọi thứ để tự bảo vệ.',
      'Tua ngược?',
      'Tháp Đồng Hồ lên lịch cho mọi tiến trình dưới này. Hộ Vệ của nó có thể đảo ngược thời gian. Kể cả sát thương của ngươi.',
    ],
  },
  {
    name: 'Tháp Đồng Hồ',
    tagline: 'Mỗi giây đều là đi vay.',
    bossTitle: 'Hộ Vệ Lịch Trình',
    briefing: [
      'CHRONOS giữ lịch trình của Kho Lưu Trữ. Mỗi khi kim dài của nó chỉ số mười hai, nó tua ngược.',
      'Sát thương bạn gây ra chỉ là thời gian đi vay. Khi đồng hồ điểm, nó hồi lại toàn bộ.',
      'Trừ khi ngươi phá CON LẮC của nó. Đồng hồ sẽ dừng và sát thương của ngươi được khóa lại, kèm cả lãi.',
      'Đánh thật mạnh, rồi đập con lắc trước khi điểm mười hai.',
      'Và tránh xa kim phút. Nó quét cả khu vực. Bất đắc dĩ thì lướt xuyên qua.',
    ],
    intel: [
      'Sát thương của bạn CHƯA ĐƯỢC KHÓA. Khi kim phút chỉ XII, CHRONOS sẽ tua ngược nó.',
      'Phá CON LẮC đang đung đưa (bắn hoặc lướt vào) để khóa toàn bộ sát thương +50% và dừng đồng hồ.',
      'Khi đồng hồ dừng, mọi đòn đánh đều vĩnh viễn.',
      'Kim phút gây chết người: lướt xuyên qua nó. NGƯNG THỜI GIAN đóng băng đạn rồi ném tất cả về phía bạn.',
    ],
    bossIntro: ['THỜI GIAN CỦA NGƯƠI ĐÃ HẾT. VỐN DĨ LUÔN LÀ VẬY.', 'Gây sát thương, rồi phá con lắc trước khi điểm mười hai!'],
    debrief: [
      'Ấn thứ ba. Đồng hồ cuối cùng cũng im lặng.',
      'LEVIATHAN đã thức giấc hoàn toàn. Nó đang kéo cây chỉ mục của Kho Lưu Trữ quấn quanh mình.',
      'Rừng Rễ Rối. Mỗi nhánh bạn chặt sẽ mọc lại gấp đôi.',
      'Vậy tôi sẽ không chỉ chặt. Tôi sẽ đốt.',
    ],
  },
  {
    name: 'Rừng Rễ Rối',
    tagline: 'Chặt một. Hai cái khác sẽ nhớ.',
    bossTitle: 'Hộ Vệ Chỉ Mục',
    briefing: [
      'HYDRA là chỉ mục của Kho Lưu Trữ. Mỗi cái đầu là một con trỏ, và con trỏ thì mọc lại.',
      'Bắn rụng một đầu, bạn chỉ có vài giây trước khi HAI đầu mọc ra từ gốc cổ.',
      'Lướt thẳng xuyên qua gốc cổ để đốt kín nó. Con trỏ đã niêm phong thì chết hẳn.',
      'Dọn sạch mọi cái đầu là lõi của nó lộ ra. Đó là cơ hội của bạn.',
      'Chặt, đốt, bắn. Lặp lại.',
    ],
    intel: [
      'Bắn một CÁI ĐẦU để chặt nó. Vài giây sau gốc cổ sẽ tách thành HAI đầu.',
      'LƯỚT xuyên qua gốc cổ để ĐỐT KÍN vĩnh viễn. Việc này cũng gây sát thương cho thân.',
      'Hết đầu = LÕI LỘ RA. Dồn hỏa lực vào trước khi đầu mới mọc ra.',
      'Các đầu sẽ lao cắn vào tâm ngắm. EMP đốt kín mọi gốc cổ đang hở.',
    ],
    bossIntro: ['CỨ CHẶT ĐI. CHÚNG TA CHỈ SINH SÔI THÊM.', 'Chặt một đầu, rồi lướt qua gốc cổ!'],
    debrief: [
      'Ấn thứ tư. Đủ cả rồi.',
      'Vậy thì ta đi xuống. Xuống tận đáy. LEVIATHAN ở Kho Lưu Trữ Sâu, đang nuốt trọn cả khu vực.',
      'Có lời khuyên nào không?',
      'Thân nó là giáp. Đuôi nó thì không. Và nếu nó quấn quanh ngươi... hãy chặt đường mà ra.',
    ],
  },
  {
    name: 'Kho Lưu Trữ Sâu',
    tagline: 'Mọi thứ không được tham chiếu đều bị giải phóng.',
    bossTitle: 'Kẻ Thu Gom Rác',
    briefing: [
      'Đây là đáy của Lưới. LEVIATHAN ở dưới này, và nó khổng lồ.',
      'Vảy của nó gạt phăng đạn. Chỉ có cái ĐUÔI phát sáng là mềm. Mỗi đốt đuôi bạn phá sẽ làm nó ngắn lại.',
      'Khi nó quấn quanh ngươi, đừng hoảng. Lướt xuyên thân nó và ngươi sẽ chặt đứt mọi thứ quanh vết cắt.',
      'Lột nó xuống còn vài đốt là đầu nó nứt ra. Rồi ta niêm phong nó mãi mãi.',
      'Bốn ấn, một con sâu. Đi thôi.',
    ],
    intel: [
      'Thân nó bọc giáp. Bắn cái ĐUÔI phát sáng để phá từng đốt một.',
      'LƯỚT xuyên qua bất kỳ đốt thân nào để CHẶT ĐỨT năm đốt cùng lúc.',
      'QUẤN: nó lượn vòng quanh bạn và siết dần. Lướt xuyên qua, đó cũng là cơ hội tốt nhất.',
      'Còn 3 đốt, ĐẦU sẽ nứt ra: kết liễu nó. Tránh khỏi vạch đỏ khi nó lao tới.',
    ],
    bossIntro: ['KHÔNG ĐƯỢC THAM CHIẾU. KHÔNG CẦN THIẾT. ĐANG THU GOM.', 'Bắn vào đuôi, và chặt nó khi nó quấn lại!'],
    debrief: [
      'thu gom... tạm dừng... Lưới... được tham chiếu...',
      'Bốn ấn đã khóa. LEVIATHAN đã ngủ. Lần này là thật.',
      'Em biết không, nó chưa bao giờ xấu xa. Chỉ là làm việc quá giỏi thôi. Giống ta.',
      'Vậy thì cả hai đều xứng đáng có cơ hội thứ hai. Chào mừng về nhà, phiên bản số không.',
      'Lưới, Kho Lưu Trữ, và vài con lỗi đã hoàn lương. Một tuần không tệ.',
    ],
  },
];

const isVi = () => getLang() === 'vi';

export function localShip(ship: ShipDef): ShipDef {
  const vi = isVi() && SHIPS_VI[ship.id];
  return vi ? { ...ship, ...vi } : ship;
}

export function localUpgrade(upgrade: UpgradeDef): UpgradeDef {
  const vi = isVi() && UPGRADES_VI[upgrade.id];
  return vi ? { ...upgrade, ...vi } : upgrade;
}

export function localPerk(perk: PerkDef): PerkDef {
  const vi = isVi() && PERKS_VI[perk.id];
  return vi ? { ...perk, ...vi } : perk;
}

export function questLabel(quest: QuestDef): string {
  return (isVi() && QUESTS_VI[quest.id]) || quest.label;
}

export function localModifier(mod: DailyModifierDef): DailyModifierDef {
  const vi = isVi() && MODIFIERS_VI[mod.id];
  return vi ? { ...mod, ...vi } : mod;
}

export function masteryRewardLabel(en: string, i: number): string {
  return (isVi() && MASTERY_REWARDS_VI[i]) || en;
}

export function skinName(name: string): string {
  return (isVi() && SKIN_NAMES_VI[name]) || name;
}

export function localAchievement(ach: AchievementDef): AchievementDef {
  const vi = isVi() && ACHIEVEMENTS_VI[ach.id];
  return vi ? { ...ach, ...vi } : ach;
}

const mergeLines = (lines: DialogueLine[], vi: string[]) => lines.map((l, i) => ({ who: l.who, text: vi[i] ?? l.text }));

const levelCache = new Map<LevelDef, LevelDef>();

/** The sector's display copy in the current language (bosses keep their proper names). */
export function localLevel(level: LevelDef): LevelDef {
  const vi = isVi() && LEVELS_VI[level.id];
  if (!vi) return level;
  let out = levelCache.get(level);
  if (!out) {
    out = {
      ...level,
      code: level.code.replace('SECTOR', 'KHU VỰC'),
      name: vi.name,
      tagline: vi.tagline,
      bossTitle: vi.bossTitle,
      briefing: mergeLines(level.briefing, vi.briefing),
      intel: vi.intel,
      bossIntro: mergeLines(level.bossIntro, vi.bossIntro),
      debrief: mergeLines(level.debrief, vi.debrief),
    };
    levelCache.set(level, out);
  }
  return out;
}
