import type { ChatMode, Difficulty, Localized } from '@/types'

export type Intent = 'greeting' | 'ideas' | 'colour' | 'composition' | 'history' | 'challenge' | 'feedback' | 'thanks' | 'unknown'

/** Keywords per intent, English + Vietnamese (accent-insensitive matching). */
export const INTENT_KEYWORDS: Record<Exclude<Intent, 'unknown'>, string[]> = {
  greeting: ['hello', 'hi', 'hey', 'good morning', 'xin chao', 'chao', 'alo'],
  ideas: ['idea', 'ideas', 'inspire', 'inspiration', 'what should i draw', 'prompt', 'y tuong', 've gi', 'cam hung', 'goi y'],
  colour: ['colour', 'color', 'palette', 'go well with', 'match', 'hex', 'mau', 'bang mau', 'phoi mau', 'hop voi'],
  composition: ['composition', 'compose', 'layout', 'balance', 'rule of thirds', 'focal', 'bo cuc', 'can bang', 'tieu diem'],
  history: [
    'history',
    'movement',
    'impressionism',
    'cubism',
    'renaissance',
    'baroque',
    'surrealism',
    'pop art',
    'ukiyo',
    'explain',
    "like i'm",
    'lich su',
    'truong phai',
    'trao luu',
    'giai thich',
    'dong ho',
    'son mai',
  ],
  challenge: ['challenge', 'plan', '7-day', '7 day', 'week', 'daily', 'routine', 'thu thach', 'ke hoach', '7 ngay', 'tuan'],
  feedback: ['feedback', 'my drawing', 'my artwork', 'improve my', 'critique', 'review', 'nhan xet', 'tranh cua toi', 'gop y', 'cai thien'],
  thanks: ['thank', 'thanks', 'cảm ơn', 'cam on', 'awesome', 'great'],
}

export const MODE_DEFAULT_INTENT: Record<ChatMode, Intent> = {
  ideas: 'ideas',
  colour: 'colour',
  composition: 'composition',
  history: 'history',
}

export const COLOUR_NAMES: { names: string[]; hex: string; label: Localized }[] = [
  { names: ['teal', 'xanh mong ket', 'xanh ngoc'], hex: '#1F8A8A', label: { en: 'teal', vi: 'xanh mòng két' } },
  { names: ['red', 'do'], hex: '#D7263D', label: { en: 'red', vi: 'đỏ' } },
  { names: ['orange', 'cam'], hex: '#F27A3A', label: { en: 'orange', vi: 'cam' } },
  { names: ['yellow', 'vang'], hex: '#F2C14E', label: { en: 'yellow', vi: 'vàng' } },
  { names: ['green', 'xanh la', 'luc'], hex: '#2E8B57', label: { en: 'green', vi: 'xanh lá' } },
  { names: ['blue', 'xanh duong', 'lam'], hex: '#2F80C4', label: { en: 'blue', vi: 'xanh dương' } },
  { names: ['navy'], hex: '#1F2F5A', label: { en: 'navy', vi: 'xanh navy' } },
  { names: ['purple', 'violet', 'tim'], hex: '#7B4BB5', label: { en: 'purple', vi: 'tím' } },
  { names: ['pink', 'hong'], hex: '#E86A92', label: { en: 'pink', vi: 'hồng' } },
  { names: ['brown', 'nau'], hex: '#7A4E3A', label: { en: 'brown', vi: 'nâu' } },
  { names: ['gold', 'vang kim'], hex: '#D4AF37', label: { en: 'gold', vi: 'vàng kim' } },
  { names: ['grey', 'gray', 'xam'], hex: '#8A8A8A', label: { en: 'grey', vi: 'xám' } },
]

export interface IdeaSeed {
  title: Localized
  description: Localized
  difficulty: Difficulty
  minutes: number
}

export const IDEA_POOL: IdeaSeed[] = [
  {
    title: { en: 'Breakfast still life', vi: 'Tĩnh vật bữa sáng' },
    description: {
      en: 'Your mug, a piece of fruit and a spoon under morning window light.',
      vi: 'Cốc của bạn, một quả trái cây và chiếc thìa dưới nắng sớm bên cửa sổ.',
    },
    difficulty: 'beginner',
    minutes: 15,
  },
  {
    title: { en: 'Five-minute pet gestures', vi: 'Dáng thú cưng 5 phút' },
    description: {
      en: 'Ten quick gesture sketches of a sleeping cat or dog.',
      vi: 'Mười bản phác dáng nhanh của chú mèo hoặc chó đang ngủ.',
    },
    difficulty: 'beginner',
    minutes: 10,
  },
  {
    title: { en: 'Window view in three values', vi: 'Khung cửa sổ ba sắc độ' },
    description: {
      en: 'Draw the view from your window using only light, middle and dark.',
      vi: 'Vẽ cảnh ngoài cửa sổ chỉ với sáng, trung và tối.',
    },
    difficulty: 'beginner',
    minutes: 20,
  },
  {
    title: { en: 'Leaf study', vi: 'Nghiên cứu chiếc lá' },
    description: {
      en: 'Pick up a fallen leaf and draw its veins with contour lines.',
      vi: 'Nhặt một chiếc lá rụng và vẽ gân lá bằng nét đường viền.',
    },
    difficulty: 'beginner',
    minutes: 12,
  },
  {
    title: { en: 'Shoe portrait', vi: 'Chân dung chiếc giày' },
    description: {
      en: 'Your most worn pair of shoes — every crease tells a story.',
      vi: 'Đôi giày bạn mang nhiều nhất — mỗi nếp nhăn kể một câu chuyện.',
    },
    difficulty: 'intermediate',
    minutes: 25,
  },
  {
    title: { en: 'Night market lanterns', vi: 'Đèn lồng chợ đêm' },
    description: {
      en: 'Glowing lanterns against deep blue — practise warm light in a cool scene.',
      vi: 'Đèn lồng rực sáng trên nền xanh thẫm — luyện ánh sáng ấm trong cảnh lạnh.',
    },
    difficulty: 'intermediate',
    minutes: 30,
  },
  {
    title: { en: 'Self-portrait in one colour', vi: 'Tự họa một màu' },
    description: {
      en: 'A monochrome self-portrait using a single hue in many values.',
      vi: 'Chân dung tự họa đơn sắc dùng một màu với nhiều sắc độ.',
    },
    difficulty: 'advanced',
    minutes: 40,
  },
  {
    title: { en: 'Tiny landscape thumbnails', vi: 'Phong cảnh tí hon' },
    description: {
      en: 'Six 5 cm landscapes testing different horizon heights.',
      vi: 'Sáu phong cảnh 5 cm thử các độ cao đường chân trời khác nhau.',
    },
    difficulty: 'beginner',
    minutes: 15,
  },
  {
    title: { en: 'Street corner in perspective', vi: 'Góc phố phối cảnh' },
    description: {
      en: 'Sketch a café on a corner using two-point perspective.',
      vi: 'Phác quán cà phê góc phố bằng phối cảnh hai điểm tụ.',
    },
    difficulty: 'advanced',
    minutes: 45,
  },
  {
    title: { en: 'Folk-print animal', vi: 'Con vật kiểu tranh dân gian' },
    description: {
      en: 'Draw a plump pig or rooster with Đông Hồ-style swirls and flat colour.',
      vi: 'Vẽ chú lợn hay gà mũm mĩm với hoa văn xoáy và màu phẳng kiểu Đông Hồ.',
    },
    difficulty: 'intermediate',
    minutes: 25,
  },
  {
    title: { en: 'Pattern from your kitchen', vi: 'Hoa văn từ căn bếp' },
    description: {
      en: 'Turn spoons, chillies and bowls into a repeating textile pattern.',
      vi: 'Biến thìa, ớt và bát thành hoa văn vải lặp lại.',
    },
    difficulty: 'intermediate',
    minutes: 30,
  },
  {
    title: { en: 'Dream creature', vi: 'Sinh vật trong mơ' },
    description: {
      en: 'Combine two animals into one surreal creature and give it a habitat.',
      vi: 'Ghép hai con vật thành một sinh vật siêu thực và vẽ nơi nó sống.',
    },
    difficulty: 'advanced',
    minutes: 35,
  },
]

export const SEVEN_DAY_PLAN: Localized[] = [
  {
    en: '**Day 1 – Lines:** 3 blind contour drawings of your hand (5 min each).',
    vi: '**Ngày 1 – Nét:** 3 bản vẽ mù bàn tay (mỗi bản 5 phút).',
  },
  { en: '**Day 2 – Shapes:** a still life of 3 objects, big shapes only.', vi: '**Ngày 2 – Hình:** tĩnh vật 3 đồ vật, chỉ vẽ mảng lớn.' },
  { en: '**Day 3 – Values:** shade an egg with all five tonal zones.', vi: '**Ngày 3 – Sắc độ:** tô bóng quả trứng đủ năm vùng tông.' },
  {
    en: '**Day 4 – Colour:** colour a beginner template with a complementary scheme.',
    vi: '**Ngày 4 – Màu:** tô một mẫu cơ bản theo phối bổ túc.',
  },
  { en: '**Day 5 – Gesture:** ten 30-second figure gestures.', vi: '**Ngày 5 – Dáng:** mười dáng người 30 giây.' },
  {
    en: '**Day 6 – Perspective:** a road with lamp posts in one-point perspective.',
    vi: '**Ngày 6 – Phối cảnh:** con đường với cột đèn phối cảnh một điểm tụ.',
  },
  {
    en: '**Day 7 – Free choice:** combine everything in a small scene you love. Celebrate!',
    vi: '**Ngày 7 – Tự chọn:** kết hợp mọi thứ trong một cảnh nhỏ bạn yêu thích. Ăn mừng nào!',
  },
]

export const COMPOSITION_TIPS: Localized[] = [
  {
    en: '**Place your subject on a third**, not in the dead centre — it instantly feels more dynamic.',
    vi: '**Đặt chủ thể ở một phần ba**, không phải chính giữa — tranh lập tức sinh động hơn.',
  },
  {
    en: '**Give it looking room:** leave more space in the direction your subject faces.',
    vi: '**Chừa khoảng nhìn:** để nhiều khoảng trống theo hướng chủ thể nhìn.',
  },
  {
    en: '**Use a leading line** (a road, river or arm) that ends at your focal point.',
    vi: '**Dùng đường dẫn** (con đường, dòng sông, cánh tay) kết thúc ở tiêu điểm.',
  },
  {
    en: '**Vary sizes:** one large, a few medium, many small shapes — never all equal.',
    vi: '**Đa dạng kích thước:** một hình lớn, vài hình vừa, nhiều hình nhỏ — đừng để bằng nhau.',
  },
  {
    en: '**Squint test:** if the big light and dark shapes don’t read clearly, simplify.',
    vi: '**Thử nheo mắt:** nếu mảng sáng tối lớn không rõ, hãy đơn giản hóa.',
  },
  {
    en: '**Overlap objects** to create depth instead of lining them up side by side.',
    vi: '**Chồng các vật lên nhau** để tạo chiều sâu thay vì xếp cạnh nhau.',
  },
]

export const MODE_OPENERS: Record<ChatMode, Localized> = {
  ideas: { en: 'Ooh, I love this kind of question! ✨', vi: 'Ồ, mình rất thích câu hỏi kiểu này! ✨' },
  colour: { en: 'Let’s mix some colour magic. 🎨', vi: 'Cùng pha chút phép màu sắc nhé. 🎨' },
  composition: { en: 'Let’s look at the structure together. 📐', vi: 'Cùng xem cấu trúc nhé. 📐' },
  history: { en: 'Pull up a chair — story time in the gallery. 🏛️', vi: 'Kéo ghế lại nào — giờ kể chuyện trong phòng tranh. 🏛️' },
}
