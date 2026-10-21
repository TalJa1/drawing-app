import type { Difficulty, Template, TemplateCategory } from '@/types'
import { cat, dragon, elephant, fox, koi, owl, butterfly } from './animals'
import { citySkyline, countryside, lanterns, lighthouse, mountainLake, mushroomHouse } from './scenes'
import {
  cupcake,
  fruitBowl,
  guitar,
  hands,
  mandalaLotus,
  mandalaStar,
  mandalaSun,
  pho,
  portrait,
  rose,
  sunflower,
  teapot,
  tulips,
  vase,
} from './objects'

export const UNLOCK_LEVEL: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 5,
  master: 8,
}

const MINUTES: Record<Difficulty, number> = { beginner: 10, intermediate: 18, advanced: 28, master: 40 }

let order = 0
const tpl = (
  id: string,
  svg: string,
  category: TemplateCategory,
  difficulty: Difficulty,
  en: string,
  vi: string,
  suggestedPalette: string[],
  tags: string[] = [],
  popularity = 50,
): Template => ({
  id,
  svg,
  category,
  difficulty,
  title: { en, vi },
  minutes: MINUTES[difficulty] + ((order * 3) % 7),
  unlockLevel: UNLOCK_LEVEL[difficulty],
  suggestedPalette,
  popularity,
  // stagger "release dates" so sorting by newest is meaningful
  createdAt: new Date(Date.UTC(2026, 0, 1) + order++ * 6 * 86_400_000).toISOString(),
  tags,
})

export const TEMPLATES: Template[] = [
  tpl('fox', fox, 'animals', 'beginner', 'Sitting Fox', 'Cáo ngồi', ['#E4572E', '#F6F1E7', '#4A3426', '#2E8B6F', '#F2A93B'], ['fox', 'cute'], 96),
  tpl('cat', cat, 'animals', 'beginner', 'Curious Cat', 'Mèo tò mò', ['#C98B2B', '#F6F1E7', '#2F80C4', '#C93C6B', '#4A3426'], ['cat', 'pet'], 92),
  tpl('butterfly', butterfly, 'animals', 'beginner', 'Garden Butterfly', 'Bướm trong vườn', ['#F2A93B', '#3A3FA8', '#C93C6B', '#2E8B6F', '#1B1A17'], ['insect', 'symmetry'], 88),
  tpl('sunflower', sunflower, 'flowers', 'beginner', 'Sunflower', 'Hoa hướng dương', ['#F2A93B', '#C98B2B', '#4A3426', '#2E8B6F', '#9DC3E6'], ['flower', 'summer'], 90),
  tpl('tulips', tulips, 'flowers', 'beginner', 'Three Tulips', 'Ba bông tulip', ['#C93C6B', '#E4572E', '#F2A93B', '#2E8B6F', '#F6F1E7'], ['spring'], 74),
  tpl('teapot', teapot, 'objects', 'beginner', 'Afternoon Teapot', 'Ấm trà buổi chiều', ['#2F80C4', '#F6F1E7', '#C98B2B', '#C93C6B', '#2E8B6F'], ['still life'], 70),
  tpl('vase', vase, 'objects', 'beginner', 'Vase of Daisies', 'Bình hoa cúc', ['#3A3FA8', '#F2A93B', '#F6F1E7', '#2E8B6F', '#E4572E'], ['still life', 'flower'], 66),
  tpl('fruit-bowl', fruitBowl, 'food', 'beginner', 'Fruit Bowl', 'Bát trái cây', ['#E4572E', '#F2A93B', '#2E8B6F', '#8E4A7A', '#C98B2B'], ['still life'], 78),
  tpl('cupcake', cupcake, 'food', 'beginner', 'Party Cupcake', 'Bánh cupcake', ['#F4A6B8', '#C93C6B', '#F6F1E7', '#2F80C4', '#F2A93B'], ['sweet'], 84),
  tpl('countryside', countryside, 'landscapes', 'beginner', 'Countryside Cottage', 'Ngôi nhà đồng quê', ['#9DC3E6', '#2E8B6F', '#F2A93B', '#E4572E', '#C98B2B'], ['farm', 'summer'], 80),
  tpl('lighthouse', lighthouse, 'architecture', 'beginner', 'Lighthouse at Dusk', 'Ngọn hải đăng lúc hoàng hôn', ['#E4572E', '#F6F1E7', '#2F80C4', '#3A3FA8', '#F2A93B'], ['sea'], 82),
  tpl('owl', owl, 'animals', 'intermediate', 'Night Owl', 'Cú đêm', ['#4A3426', '#C98B2B', '#F2A93B', '#3A3FA8', '#F6F1E7'], ['bird', 'night'], 86),
  tpl('koi', koi, 'animals', 'intermediate', 'Koi Pond', 'Hồ cá koi', ['#E4572E', '#F6F1E7', '#2F80C4', '#2E8B6F', '#C93C6B'], ['fish', 'water'], 81),
  tpl('elephant', elephant, 'animals', 'intermediate', 'Gentle Elephant', 'Chú voi hiền', ['#8C8C9A', '#C93C6B', '#F2A93B', '#2E8B6F', '#9DC3E6'], ['safari'], 72),
  tpl('mountain-lake', mountainLake, 'landscapes', 'intermediate', 'Mountain Lake', 'Hồ trên núi', ['#2F80C4', '#2E8B6F', '#F6F1E7', '#3A3FA8', '#F2A93B'], ['nature'], 77),
  tpl('city-skyline', citySkyline, 'architecture', 'intermediate', 'City at Night', 'Thành phố về đêm', ['#3A3FA8', '#F2A93B', '#1B1A17', '#C93C6B', '#2F80C4'], ['urban', 'night'], 69),
  tpl('rose', rose, 'flowers', 'intermediate', 'Garden Rose', 'Hoa hồng', ['#C93C6B', '#E4572E', '#2E8B6F', '#F4A6B8', '#4A3426'], ['romantic'], 75),
  tpl('guitar', guitar, 'objects', 'intermediate', 'Acoustic Guitar', 'Đàn guitar', ['#C98B2B', '#4A3426', '#E4572E', '#F2A93B', '#1B1A17'], ['music'], 64),
  tpl('mushroom-house', mushroomHouse, 'fantasy', 'intermediate', 'Mushroom House', 'Ngôi nhà nấm', ['#E4572E', '#F6F1E7', '#2E8B6F', '#3A3FA8', '#F2A93B'], ['fairy tale'], 91),
  tpl('pho', pho, 'food', 'intermediate', 'Bowl of Phở', 'Tô phở', ['#F2A93B', '#E4572E', '#2E8B6F', '#F6F1E7', '#2F80C4'], ['vietnam', 'noodles'], 79),
  tpl('lanterns', lanterns, 'objects', 'intermediate', 'Hội An Lanterns', 'Đèn lồng Hội An', ['#E4572E', '#F2A93B', '#C93C6B', '#3A3FA8', '#2E8B6F'], ['vietnam', 'festival'], 83),
  tpl('mandala-lotus', mandalaLotus, 'patterns', 'intermediate', 'Lotus Mandala', 'Mandala hoa sen', ['#C93C6B', '#F2A93B', '#2E8B6F', '#3A3FA8', '#F6F1E7'], ['mandala', 'calm'], 87),
  tpl('portrait', portrait, 'portraits', 'advanced', 'Simple Portrait', 'Chân dung đơn giản', ['#E8C4A8', '#4A3426', '#C93C6B', '#2F80C4', '#F2A93B'], ['face'], 68),
  tpl('mandala-star', mandalaStar, 'patterns', 'advanced', 'Star Mandala', 'Mandala ngôi sao', ['#3A3FA8', '#D4AF37', '#2F80C4', '#C93C6B', '#F6F1E7'], ['mandala', 'geometry'], 73),
  tpl('hands', hands, 'portraits', 'master', 'Open Hand', 'Bàn tay mở', ['#E8C4A8', '#C98B2B', '#C93C6B', '#3A3FA8', '#F6F1E7'], ['anatomy'], 58),
  tpl('dragon', dragon, 'fantasy', 'master', 'Little Dragon', 'Chú rồng nhỏ', ['#2E8B6F', '#F2A93B', '#C93C6B', '#3A3FA8', '#E4572E'], ['myth'], 89),
  tpl('mandala-sun', mandalaSun, 'patterns', 'master', 'Sun Mandala', 'Mandala mặt trời', ['#F2A93B', '#E4572E', '#C98B2B', '#3A3FA8', '#D4AF37'], ['mandala', 'radial'], 71),
]

export const TEMPLATE_MAP: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'animals',
  'landscapes',
  'portraits',
  'objects',
  'flowers',
  'architecture',
  'fantasy',
  'patterns',
  'food',
]
