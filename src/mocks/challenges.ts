import type { Challenge, Rank } from '@/types'

const c = (
  id: string,
  kind: Challenge['kind'],
  metric: Challenge['metric'],
  target: number,
  xp: number,
  icon: string,
  en: [string, string],
  vi: [string, string],
  param?: string,
): Challenge => ({
  id,
  kind,
  metric,
  target,
  xp,
  icon,
  param,
  title: { en: en[0], vi: vi[0] },
  description: { en: en[1], vi: vi[1] },
})

export const DAILY_POOL: Challenge[] = [
  c('d-daily-template', 'daily', 'dailyTemplate', 1, 60, 'sparkles', ["Today's Canvas", "Colour today's featured template."], ['Bức tranh hôm nay', 'Tô màu mẫu nổi bật của hôm nay.']),
  c('d-two-artworks', 'daily', 'artworks', 2, 50, 'brush', ['Double Feature', 'Finish two artworks today.'], ['Cú đúp', 'Hoàn thành hai tác phẩm hôm nay.']),
  c('d-high-score', 'daily', 'highScores', 1, 70, 'star', ['Aim High', 'Score 80+ on any template.'], ['Nhắm cao', 'Đạt 80+ điểm ở bất kỳ mẫu nào.']),
  c('d-lesson', 'daily', 'lessons', 1, 40, 'book', ['Daily Lesson', 'Complete one lesson.'], ['Bài học mỗi ngày', 'Hoàn thành một bài học.']),
  c('d-free', 'daily', 'freeDraws', 1, 40, 'feather', ['Blank Page Bravery', 'Save one free drawing.'], ['Dũng cảm với trang trắng', 'Lưu một bức vẽ tự do.']),
]

export const WEEKLY_POOL: Challenge[] = [
  c('w-five', 'weekly', 'practiceArtworks', 5, 150, 'layers', ['Five Frames', 'Colour five templates this week.'], ['Năm khung tranh', 'Tô màu năm mẫu trong tuần này.']),
  c('w-colour', 'weekly', 'colourScore', 3, 180, 'palette', ['Colour Confidence', 'Earn a colour score of 75+ three times.'], ['Tự tin sắc màu', 'Đạt điểm màu 75+ ba lần.'], '75'),
  c('w-quiz', 'weekly', 'quizzes', 3, 120, 'graduation', ['Quiz Week', 'Pass three lesson quizzes.'], ['Tuần trắc nghiệm', 'Vượt qua ba bài trắc nghiệm.']),
  c('w-animals', 'weekly', 'templateCategory', 2, 120, 'paw', ['Wild Week', 'Colour two animal templates.'], ['Tuần hoang dã', 'Tô màu hai mẫu động vật.'], 'animals'),
  c('w-chat', 'weekly', 'chat', 5, 80, 'message', ['Talk to the Muse', 'Exchange five messages with the AI muse.'], ['Trò chuyện cùng nàng thơ', 'Trao đổi năm tin nhắn với nàng thơ AI.']),
  c('w-lessons', 'weekly', 'lessons', 3, 150, 'library', ['Study Hall', 'Complete three lessons.'], ['Giờ tự học', 'Hoàn thành ba bài học.']),
]

export const SPECIAL_EVENTS: (Challenge & { months: number[]; theme: string[] })[] = [
  {
    ...c('s-autumn', 'special', 'colourScore', 5, 400, 'leaf', ['Autumn Colours Week', 'Paint five artworks with a colour score of 70+ while the leaves turn.'], ['Tuần lễ sắc thu', 'Vẽ năm tác phẩm đạt điểm màu 70+ khi lá chuyển mùa.'], '70'),
    months: [8, 9, 10],
    theme: ['#C98B2B', '#E4572E', '#8C3B1F', '#F2A93B', '#4A3426'],
  },
  {
    ...c('s-bloom', 'special', 'templateCategory', 4, 400, 'flower', ['Spring Bloom Festival', 'Colour four flower templates.'], ['Lễ hội hoa xuân', 'Tô màu bốn mẫu hoa.'], 'flowers'),
    months: [1, 2, 3, 4],
    theme: ['#F4A6B8', '#C93C6B', '#9BC59D', '#F7E1A0', '#FFFFFF'],
  },
  {
    ...c('s-summer', 'special', 'templateCategory', 4, 400, 'sun', ['Summer Landscapes', 'Colour four landscape templates.'], ['Phong cảnh mùa hè', 'Tô màu bốn mẫu phong cảnh.'], 'landscapes'),
    months: [5, 6, 7],
    theme: ['#2F80C4', '#F2A93B', '#2E8B6F', '#F6F1E7', '#E4572E'],
  },
  {
    ...c('s-winter', 'special', 'practiceArtworks', 6, 400, 'snowflake', ['Winter Lights', 'Finish six practice artworks as the year closes.'], ['Ánh sáng mùa đông', 'Hoàn thành sáu bài luyện tập khi năm khép lại.']),
    months: [11, 0],
    theme: ['#3A3FA8', '#D4AF37', '#F6F1E7', '#2E8B6F', '#C93C6B'],
  },
]

export const RANKS: Rank[] = [
  { id: 'doodler', minLevel: 1, name: { en: 'Doodler', vi: 'Người vẽ nguệch ngoạc' }, perk: { en: 'Every beginner template, every brush and the whole Art Atlas.', vi: 'Mọi mẫu cơ bản, mọi cọ vẽ và toàn bộ Atlas Nghệ thuật.' } },
  { id: 'sketcher', minLevel: 2, name: { en: 'Sketcher', vi: 'Người phác thảo' }, perk: { en: 'Unlocks intermediate templates — mandalas, koi, phở and more.', vi: 'Mở khóa mẫu trung cấp — mandala, cá koi, phở và hơn thế.' } },
  { id: 'colourist', minLevel: 5, name: { en: 'Colourist', vi: 'Người phối màu' }, perk: { en: 'Unlocks advanced templates like the portrait and the star mandala.', vi: 'Mở khóa mẫu nâng cao như chân dung và mandala ngôi sao.' } },
  { id: 'illustrator', minLevel: 8, name: { en: 'Illustrator', vi: 'Họa sĩ minh họa' }, perk: { en: 'Unlocks master templates: the dragon, the hand and the sun mandala.', vi: 'Mở khóa mẫu bậc thầy: chú rồng, bàn tay và mandala mặt trời.' } },
  { id: 'artisan', minLevel: 12, name: { en: 'Artisan', vi: 'Nghệ nhân' }, perk: { en: 'You have tried most of the atelier. Time to master it.', vi: 'Bạn đã thử gần hết xưởng vẽ. Giờ là lúc làm chủ nó.' } },
  { id: 'master', minLevel: 18, name: { en: 'Master', vi: 'Bậc thầy' }, perk: { en: 'Fellow artists look to your gallery for inspiration.', vi: 'Các họa sĩ khác tìm cảm hứng từ phòng tranh của bạn.' } },
  { id: 'grandmaster', minLevel: 25, name: { en: 'Grandmaster', vi: 'Đại sư' }, perk: { en: 'The highest rank in the atelier. Bravo.', vi: 'Danh hiệu cao nhất của xưởng vẽ. Hoan hô.' } },
]
