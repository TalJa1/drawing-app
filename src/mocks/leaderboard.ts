import type { LeaderboardEntry } from '@/types'

/** Twenty fictional artists. Clearly sample data — no real people. */
const RAW: [string, string, number, number, string][] = [
  ['Lan Inkwell', 'lan-inkwell', 18450, 1320, 'VN'],
  ['Kofi Brushwright', 'kofi', 17210, 980, 'GH'],
  ['Mira Watercolour', 'mira', 16020, 1510, 'IN'],
  ['Hiro Linework', 'hiro', 14980, 760, 'JP'],
  ['Ana Gouache', 'ana-g', 13890, 1100, 'BR'],
  ['Minh Sơn Mài', 'minh-sm', 12740, 1260, 'VN'],
  ['Sofia Pastel', 'sofia', 11920, 640, 'ES'],
  ['Theo Charcoal', 'theo-c', 10880, 890, 'FR'],
  ['Aiyana Dots', 'aiyana', 9940, 1180, 'AU'],
  ['Bảo Ngọc', 'bao-ngoc', 9120, 720, 'VN'],
  ['Lucas Sketch', 'lucas', 8460, 540, 'DE'],
  ['Zara Collage', 'zara', 7710, 830, 'GB'],
  ['Kenji Ink', 'kenji', 6980, 410, 'JP'],
  ['Fatima Tessera', 'fatima', 6250, 670, 'MA'],
  ['Diego Mural', 'diego-m', 5590, 590, 'MX'],
  ['Thu Hà', 'thu-ha', 4930, 760, 'VN'],
  ['Noah Hatch', 'noah', 4180, 350, 'US'],
  ['Ingrid Fjord', 'ingrid', 3520, 280, 'NO'],
  ['Amara Ochre', 'amara', 2760, 460, 'NG'],
  ['Quang Đông Hồ', 'quang', 1980, 390, 'VN'],
]

export const LEADERBOARD_SAMPLE: LeaderboardEntry[] = RAW.map(([name, avatarSeed, xp, weeklyXp, country], i) => ({
  id: `sample-${i + 1}`,
  name,
  avatarSeed,
  xp,
  weeklyXp,
  level: 0, // computed by the API from xp
  country,
  sample: true,
}))
