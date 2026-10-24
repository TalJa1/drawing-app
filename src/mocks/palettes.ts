import type { Localized, Palette, Testimonial } from '@/types'

export const PALETTES: Palette[] = [
  {
    id: 'impressionist-morning',
    name: { en: 'Impressionist Morning', vi: 'Buổi sáng Ấn tượng' },
    colors: ['#9DC3E6', '#F7D9A8', '#E8A0A8', '#7FB28F', '#F2C14E', '#5B7DB1'],
  },
  {
    id: 'neon-noir',
    name: { en: 'Neon Noir', vi: 'Neon về đêm' },
    colors: ['#0B0F2A', '#FF2E88', '#00E5FF', '#7B2FFF', '#FFE45E', '#14F195'],
  },
  {
    id: 'autumn-ochre',
    name: { en: 'Autumn Ochre', vi: 'Hoàng thổ mùa thu' },
    colors: ['#C98B2B', '#E4572E', '#8C3B1F', '#F2A93B', '#4A3426', '#6B7F3A'],
  },
  {
    id: 'pastel-dream',
    name: { en: 'Pastel Dream', vi: 'Giấc mơ pastel' },
    colors: ['#F4C7D7', '#C9E4DE', '#FDE2B8', '#C6D8F0', '#DCCDF2', '#FFF6E5'],
  },
  {
    id: 'primary-bold',
    name: { en: 'Primary Bold', vi: 'Màu cơ bản rực rỡ' },
    colors: ['#E4322B', '#F7D116', '#1F5BB5', '#1B1A17', '#F6F1E7'],
  },
  {
    id: 'saigon-sunset',
    name: { en: 'Saigon Sunset', vi: 'Hoàng hôn Sài Gòn' },
    colors: ['#2B1B3D', '#C93C6B', '#F27A54', '#F2A93B', '#FCE38A', '#2E8B6F'],
  },
  {
    id: 'ukiyoe-indigo',
    name: { en: 'Ukiyo-e Indigo', vi: 'Chàm Ukiyo-e' },
    colors: ['#1F3A5F', '#4F7CAC', '#F1E4C8', '#C8553D', '#2B2B2B', '#FFFFFF'],
  },
  {
    id: 'lacquer-gold',
    name: { en: 'Lacquer & Gold', vi: 'Sơn mài & vàng' },
    colors: ['#120C0A', '#B8282E', '#D4AF37', '#F3E7C9', '#5A2A1A'],
  },
  {
    id: 'nordic-frost',
    name: { en: 'Nordic Frost', vi: 'Sương giá Bắc Âu' },
    colors: ['#E8EEF2', '#A9C2D4', '#5F7F99', '#2C3E50', '#D9A441'],
  },
  {
    id: 'desert-bloom',
    name: { en: 'Desert Bloom', vi: 'Hoa sa mạc' },
    colors: ['#E9C891', '#D97B48', '#B8495C', '#7A4E3A', '#5B8DB8', '#F4E3C1'],
  },
  {
    id: 'forest-floor',
    name: { en: 'Forest Floor', vi: 'Thảm rừng' },
    colors: ['#1E3D2F', '#2E8B6F', '#8DB580', '#C9B37E', '#6B4F36', '#E8DCC0'],
  },
  { id: 'fauve-fire', name: { en: 'Fauve Fire', vi: 'Lửa dã thú' }, colors: ['#FF5E3A', '#2EC4B6', '#FFBE0B', '#8338EC', '#3A86FF'] },
]

export const INSPIRATION_PROMPTS: Localized[] = [
  { en: 'A city made of teapots at sunset', vi: 'Một thành phố làm từ ấm trà lúc hoàng hôn' },
  { en: 'A whale swimming through the clouds', vi: 'Chú cá voi bơi giữa những đám mây' },
  { en: 'Your breakfast as a tiny landscape', vi: 'Bữa sáng của bạn biến thành một phong cảnh tí hon' },
  { en: 'A fox reading by candlelight', vi: 'Chú cáo đọc sách dưới ánh nến' },
  { en: 'A greenhouse on the moon', vi: 'Một nhà kính trên mặt trăng' },
  { en: 'The sound of rain, drawn only with lines', vi: 'Tiếng mưa, chỉ vẽ bằng những đường nét' },
  { en: 'A bicycle that grows flowers', vi: 'Chiếc xe đạp mọc ra hoa' },
  { en: 'Three cups of coffee with different moods', vi: 'Ba tách cà phê với ba tâm trạng khác nhau' },
  { en: 'A night market lit by lanterns', vi: 'Phiên chợ đêm rực rỡ đèn lồng' },
  { en: 'A tiny dragon guarding a cupcake', vi: 'Chú rồng tí hon canh giữ chiếc bánh cupcake' },
  { en: 'Your favourite song as abstract shapes', vi: 'Bài hát yêu thích của bạn dưới dạng hình khối trừu tượng' },
  { en: 'A lighthouse for lost butterflies', vi: 'Ngọn hải đăng cho những chú bướm lạc đường' },
  { en: 'A self-portrait as a vegetable', vi: 'Chân dung tự họa trong hình hài một loại rau củ' },
  { en: 'An umbrella that rains colour', vi: 'Chiếc ô đổ mưa sắc màu' },
  { en: 'A street in Hội An at dawn, in only three colours', vi: 'Một con phố Hội An lúc bình minh, chỉ với ba màu' },
  { en: 'A cat who is secretly a cloud', vi: 'Chú mèo thật ra là một đám mây' },
]

export const ART_FACTS: Localized[] = [
  {
    en: 'Ultramarine blue was once more expensive than gold — it was ground from lapis lazuli mined in Afghanistan.',
    vi: 'Màu xanh ultramarine từng đắt hơn cả vàng — nó được nghiền từ đá lapis lazuli khai thác ở Afghanistan.',
  },
  {
    en: 'The oldest known figurative cave painting, in Indonesia, is over 45,000 years old.',
    vi: 'Bức tranh hang động tượng hình cổ nhất được biết đến, ở Indonesia, có tuổi đời hơn 45.000 năm.',
  },
  {
    en: 'Vietnamese lacquer painting (sơn mài) can take months: dozens of layers are applied and sanded back by hand.',
    vi: 'Tranh sơn mài Việt Nam có thể mất hàng tháng: hàng chục lớp sơn được phủ rồi mài lại bằng tay.',
  },
  {
    en: 'Đông Hồ folk prints use paper made from the bark of the dó tree, coated with crushed scallop shells for shimmer.',
    vi: 'Tranh Đông Hồ in trên giấy dó, quét điệp nghiền từ vỏ sò để tạo ánh lấp lánh.',
  },
  {
    en: 'Before paint tubes were invented in 1841, painters stored oil paint in pig bladders.',
    vi: 'Trước khi tuýp màu được phát minh năm 1841, họa sĩ đựng sơn dầu trong bong bóng lợn.',
  },
  {
    en: 'Pointillist painters relied on the viewer’s eye to mix dots of pure colour.',
    vi: 'Các họa sĩ trường phái chấm điểm dựa vào mắt người xem để trộn những chấm màu thuần khiết.',
  },
  {
    en: 'Japanese woodblock prints travelled to Europe as packing paper — and inspired the Impressionists.',
    vi: 'Tranh khắc gỗ Nhật Bản từng sang châu Âu như giấy gói hàng — và truyền cảm hứng cho trường phái Ấn tượng.',
  },
  {
    en: 'Graphite pencils contain no lead — the name comes from a 16th-century mistake.',
    vi: 'Bút chì than chì không chứa chì — cái tên đến từ một nhầm lẫn ở thế kỷ 16.',
  },
  {
    en: 'Complementary colours placed side by side make each other look brighter.',
    vi: 'Hai màu bổ túc đặt cạnh nhau sẽ làm nhau trông rực rỡ hơn.',
  },
  {
    en: 'Watercolour paper is often sized with gelatine so paint sits on the surface instead of sinking in.',
    vi: 'Giấy màu nước thường được phủ keo gelatin để màu nằm trên bề mặt thay vì thấm sâu.',
  },
]

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Mai L.',
    avatarSeed: 'mai',
    role: { en: 'Nurse, draws on night breaks', vi: 'Y tá, vẽ trong giờ nghỉ ca đêm' },
    quote: {
      en: 'The judge told me my linework was “brave”. I framed that sentence. Then I drew 30 days in a row.',
      vi: 'Giám khảo khen nét vẽ của tôi “dũng cảm”. Tôi đóng khung câu đó. Rồi tôi vẽ liền 30 ngày.',
    },
  },
  {
    name: 'Theo R.',
    avatarSeed: 'theo',
    role: { en: 'Retired engineer', vi: 'Kỹ sư về hưu' },
    quote: {
      en: 'I never understood complementary colours until the Colour Lab let me play with them. Now my grandkids ask me for tips.',
      vi: 'Tôi chưa từng hiểu màu bổ túc cho đến khi Phòng Thí Nghiệm Màu cho tôi thử. Giờ các cháu còn hỏi mẹo của tôi.',
    },
  },
  {
    name: 'Linh P.',
    avatarSeed: 'linh',
    role: { en: 'Art student', vi: 'Sinh viên mỹ thuật' },
    quote: {
      en: 'The Art Atlas is my favourite study buddy — Đông Hồ prints next to Ukiyo-e next to Pop Art. Gorgeous.',
      vi: 'Atlas Nghệ thuật là bạn học yêu thích của mình — tranh Đông Hồ cạnh Ukiyo-e cạnh Pop Art. Quá đẹp.',
    },
  },
  {
    name: 'Sam K.',
    avatarSeed: 'sam-k',
    role: { en: 'Software developer', vi: 'Lập trình viên' },
    quote: {
      en: 'Ten minutes of colouring a mandala after work beats any meditation app I’ve tried.',
      vi: 'Mười phút tô mandala sau giờ làm hiệu quả hơn mọi ứng dụng thiền tôi từng thử.',
    },
  },
]
