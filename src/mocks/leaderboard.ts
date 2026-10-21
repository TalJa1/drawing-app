import type { LeaderboardEntry } from '@/types'

/** Twenty fictional artists. Clearly sample data — no real people. */
const RAW: [string, string, number, number, string, boolean][] = [
  ['Lan Inkwell', 'lan-inkwell', 18450, 1320, 'VN', true],
  ['Kofi Brushwright', 'kofi', 17210, 980, 'GH', false],
  ['Mira Watercolour', 'mira', 16020, 1510, 'IN', true],
  ['Hiro Linework', 'hiro', 14980, 760, 'JP', false],
  ['Ana Gouache', 'ana-g', 13890, 1100, 'BR', false],
  ['Minh Sơn Mài', 'minh-sm', 12740, 1260, 'VN', true],
  ['Sofia Pastel', 'sofia', 11920, 640, 'ES', false],
  ['Theo Charcoal', 'theo-c', 10880, 890, 'FR', false],
  ['Aiyana Dots', 'aiyana', 9940, 1180, 'AU', false],
  ['Bảo Ngọc', 'bao-ngoc', 9120, 720, 'VN', true],
  ['Lucas Sketch', 'lucas', 8460, 540, 'DE', false],
  ['Zara Collage', 'zara', 7710, 830, 'GB', false],
  ['Kenji Ink', 'kenji', 6980, 410, 'JP', false],
  ['Fatima Tessera', 'fatima', 6250, 670, 'MA', false],
  ['Diego Mural', 'diego-m', 5590, 590, 'MX', false],
  ['Thu Hà', 'thu-ha', 4930, 760, 'VN', true],
  ['Noah Hatch', 'noah', 4180, 350, 'US', false],
  ['Ingrid Fjord', 'ingrid', 3520, 280, 'NO', false],
  ['Amara Ochre', 'amara', 2760, 460, 'NG', false],
  ['Quang Đông Hồ', 'quang', 1980, 390, 'VN', false],
]

export const LEADERBOARD_SAMPLE: LeaderboardEntry[] = RAW.map(([name, avatarSeed, xp, weeklyXp, country, isFriend], i) => ({
  id: `sample-${i + 1}`,
  name,
  avatarSeed,
  xp,
  weeklyXp,
  level: 0, // computed by the API from xp
  country,
  isFriend,
  sample: true,
}))
