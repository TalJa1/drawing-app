/* ------------------------------------------------------------------
   Fake AI muse. Pattern-matches intent, builds a rich reply (markdown +
   cards) and streams it token by token like a real LLM endpoint (SSE).
   Replace `streamChatReply` with a fetch() to the real chat endpoint.
   ------------------------------------------------------------------ */
import type { ChatAttachment, ChatCard, ChatMode, ChatStreamEvent, Lang } from '@/types'
import { seeded, shuffle } from '@/lib/random'
import { fuzzyIncludes, matchesPhrase, sleep } from '@/lib/utils'
import { hexToHsl, hslToHex, scheme } from '@/lib/color'
import { COLOUR_NAMES, COMPOSITION_TIPS, IDEA_POOL, INTENT_KEYWORDS, MODE_DEFAULT_INTENT, MODE_OPENERS, SEVEN_DAY_PLAN, type Intent } from '@/mocks/chatReplies'
import { MOVEMENTS } from '@/mocks/movements'
import { TEMPLATES } from '@/mocks/templates'
import { PALETTES } from '@/mocks/palettes'
import { useSettings } from '@/store/settings'
import { ApiError } from './client'

export interface ChatRequest {
  message: string
  mode: ChatMode
  lang: Lang
  attachments?: ChatAttachment[]
  /** different seed → different (regenerated) answer */
  seed?: string
}

export interface ChatReply {
  intent: Intent
  text: string
  cards: ChatCard[]
}

export function detectIntent(message: string, mode: ChatMode, hasAttachment: boolean): Intent {
  if (hasAttachment) return 'feedback'
  const scores = (Object.keys(INTENT_KEYWORDS) as (keyof typeof INTENT_KEYWORDS)[]).map((intent) => ({
    intent,
    score: INTENT_KEYWORDS[intent].filter((k) => matchesPhrase(message, k)).length,
  }))
  scores.sort((a, b) => b.score - a.score)
  if (scores[0].score > 0) {
    // a greeting alone is a greeting; a greeting + question is the question
    const best = scores.find((s) => s.score > 0 && s.intent !== 'greeting' && s.intent !== 'thanks')
    if (best) return best.intent
    return scores[0].intent
  }
  return message.trim().split(/\s+/).length <= 2 ? 'unknown' : MODE_DEFAULT_INTENT[mode]
}

const L = (lang: Lang, en: string, vi: string) => (lang === 'vi' ? vi : en)

function findColour(message: string) {
  return COLOUR_NAMES.find((c) => c.names.some((n) => matchesPhrase(message, n)))
}

function harmonyPalettes(base: string, lang: Lang, label: string): ChatCard[] {
  const hsl = hexToHsl(base)
  const soft = (hex: string, l: number) => hslToHex({ ...hexToHsl(hex), l })
  return [
    { type: 'palette', name: L(lang, `Complementary ${label}`, `${label} bổ túc`), colors: [base, ...scheme(base, 'complementary').slice(1), soft(base, Math.min(0.92, hsl.l + 0.35)), '#1B1A17'] },
    { type: 'palette', name: L(lang, `Analogous ${label}`, `${label} tương đồng`), colors: [...scheme(base, 'analogous'), soft(base, 0.88), soft(base, 0.22)] },
    { type: 'palette', name: L(lang, `Split-complementary ${label}`, `${label} bổ túc chia`), colors: [...scheme(base, 'split'), '#F6F1E7'] },
  ]
}

/** Pure reply builder (unit-testable). */
export function buildReply(req: ChatRequest): ChatReply {
  const { message, mode, lang } = req
  const rng = seeded(`${message}|${mode}|${req.seed ?? ''}`)
  const intent = detectIntent(message, mode, !!req.attachments?.length)
  const opener = MODE_OPENERS[mode][lang]
  const cards: ChatCard[] = []
  let text: string

  switch (intent) {
    case 'greeting':
      text = L(lang,
        `Hello, fellow artist! 👋 I’m your muse. I can **dream up drawing ideas**, **suggest colour palettes**, **coach your composition**, or **tell stories from art history**. What are we making today?`,
        `Xin chào người bạn nghệ sĩ! 👋 Mình là nàng thơ của bạn. Mình có thể **nghĩ ra ý tưởng vẽ**, **gợi ý bảng màu**, **hướng dẫn bố cục**, hoặc **kể chuyện lịch sử nghệ thuật**. Hôm nay mình cùng vẽ gì nhé?`)
      break
    case 'thanks':
      text = L(lang, 'You’re so welcome! Go make something wonderful — and show me later. 🖌️', 'Không có gì đâu! Đi vẽ điều gì thật tuyệt nhé — rồi khoe mình sau. 🖌️')
      break
    case 'ideas': {
      const ideas = shuffle(rng, IDEA_POOL).slice(0, 5)
      const beginner = fuzzyIncludes(message, 'beginner') || fuzzyIncludes(message, 'moi bat dau') || fuzzyIncludes(message, 'nguoi moi')
      const list = (beginner ? shuffle(rng, IDEA_POOL.filter((i) => i.difficulty === 'beginner')).concat(ideas) : ideas).slice(0, 5)
      text = `${opener}\n\n${L(lang, 'Here are five ideas to get your brush moving:', 'Đây là năm ý tưởng để cây cọ của bạn chuyển động:')}\n\n${list
        .map((i, n) => `${n + 1}. **${i.title[lang]}** — ${i.description[lang]}`)
        .join('\n')}\n\n${L(lang, 'Want a ready-made line drawing instead? Try this template:', 'Muốn có sẵn bản nét để tô? Thử mẫu này nhé:')}`
      list.slice(0, 3).forEach((i) => cards.push({ type: 'idea', title: i.title[lang], description: i.description[lang], difficulty: i.difficulty, minutes: i.minutes }))
      const t = shuffle(rng, TEMPLATES.filter((x) => x.difficulty === 'beginner'))[0]
      cards.push({ type: 'template', templateId: t.id })
      break
    }
    case 'colour': {
      const c = findColour(message)
      if (c) {
        const label = c.label[lang]
        text = `${opener}\n\n${L(lang,
          `**${label[0].toUpperCase() + label.slice(1)}** is a wonderful anchor colour. A few combinations that work beautifully:\n\n- **Complementary:** pair it with its opposite for maximum glow — use the opposite only as a small accent.\n- **Analogous:** its neighbours on the wheel give a calm, unified mood.\n- **Split-complementary:** lively but easier to balance than a straight complement.\n\nTip: keep one colour dominant (~60%), one supporting (~30%) and one accent (~10%).`,
          `**${label[0].toUpperCase() + label.slice(1)}** là màu nền tảng tuyệt vời. Vài cách phối rất đẹp:\n\n- **Bổ túc:** ghép với màu đối diện để rực rỡ nhất — chỉ dùng màu đối diện làm điểm nhấn nhỏ.\n- **Tương đồng:** các màu láng giềng trên vòng màu tạo tâm trạng êm dịu, thống nhất.\n- **Bổ túc chia:** sinh động nhưng dễ cân bằng hơn phối bổ túc thuần.\n\nMẹo: để một màu chủ đạo (~60%), một màu hỗ trợ (~30%) và một điểm nhấn (~10%).`)}`
        cards.push(...harmonyPalettes(c.hex, lang, label))
      } else {
        const picks = shuffle(rng, PALETTES).slice(0, 3)
        text = `${opener}\n\n${L(lang,
          'Here are three curated palettes from the atelier. Click any swatch to copy it, or send the whole palette to the studio:',
          'Đây là ba bảng màu chọn lọc từ xưởng vẽ. Nhấn vào ô màu để sao chép, hoặc gửi cả bảng màu tới xưởng vẽ:')}\n\n${picks.map((p) => `- **${p.name[lang]}**`).join('\n')}\n\n${L(lang,
          'Tell me a colour (like *teal* or *rose*) and I’ll build harmonies around it.',
          'Hãy cho mình một màu (như *xanh mòng két* hay *hồng*) và mình sẽ dựng phối màu quanh nó.')}`
        picks.forEach((p) => cards.push({ type: 'palette', name: p.name[lang], colors: p.colors }))
      }
      break
    }
    case 'composition': {
      const tips = shuffle(rng, COMPOSITION_TIPS).slice(0, 4)
      text = `${opener}\n\n${L(lang, 'Four composition moves that make an instant difference:', 'Bốn bước bố cục tạo khác biệt ngay lập tức:')}\n\n${tips
        .map((t, i) => `${i + 1}. ${t[lang]}`)
        .join('\n')}\n\n${L(lang, 'Want to go deeper? This lesson walks through it with diagrams:', 'Muốn tìm hiểu sâu hơn? Bài học này giải thích kèm sơ đồ:')}`
      cards.push({ type: 'lesson', slug: rng() > 0.5 ? 'rule-of-thirds' : 'leading-lines' })
      break
    }
    case 'history': {
      const mv = MOVEMENTS.find((m) => fuzzyIncludes(message, m.name.en) || fuzzyIncludes(message, m.name.vi) || fuzzyIncludes(message, m.slug.replace(/-/g, ' '))) ?? shuffle(rng, MOVEMENTS)[0]
      const kid = fuzzyIncludes(message, "12") || fuzzyIncludes(message, 'like i') || fuzzyIncludes(message, 'tre em') || fuzzyIncludes(message, 'de hieu')
      text = `${opener}\n\n**${mv.name[lang]}** (${mv.period}) — ${mv.summary[lang]}\n\n${
        kid
          ? L(lang, '**In kid terms:** imagine ', '**Nói đơn giản:** hãy tưởng tượng ') +
            (lang === 'vi' ? `các họa sĩ cùng đồng ý một “luật chơi” mới: ${mv.keyIdeas.vi[0].toLowerCase()}. Họ thử nó cho tới khi cả thế giới phải chú ý!` : `a group of artists agreeing on a new game rule: ${mv.keyIdeas.en[0].toLowerCase()}. They kept playing until the whole world noticed!`) + '\n\n'
          : ''
      }${L(lang, '**How to spot it:**', '**Cách nhận diện:**')}\n${mv.spotIt[lang].map((s) => `- ${s}`).join('\n')}`
      cards.push({ type: 'palette', name: L(lang, `${mv.name.en} palette`, `Bảng màu ${mv.name.vi}`), colors: mv.palette })
      break
    }
    case 'challenge':
      text = `${opener}\n\n${L(lang, 'Here’s a gentle **7-day drawing challenge**. 15–20 minutes a day is plenty:', 'Đây là **thử thách vẽ 7 ngày** nhẹ nhàng. Mỗi ngày 15–20 phút là đủ:')}\n\n${SEVEN_DAY_PLAN.map((d) => `- ${d[lang]}`).join('\n')}\n\n${L(lang,
        'Each day you complete keeps your streak flame burning. 🔥 You’ve got this!',
        'Mỗi ngày hoàn thành sẽ giữ ngọn lửa chuỗi của bạn cháy sáng. 🔥 Bạn làm được mà!')}`
      cards.push({ type: 'template', templateId: 'sunflower' })
      break
    case 'feedback': {
      const hasImg = !!req.attachments?.length
      text = `${L(lang, 'Thank you for sharing your work with me! 💛', 'Cảm ơn bạn đã chia sẻ tác phẩm với mình! 💛')}\n\n${hasImg
        ? L(lang,
          'Here’s how I’d look at it, like a friendly critique:\n\n- **What works:** look for the area your eye goes to first — that’s your focal point, and it’s worth celebrating.\n- **Value check:** squint. Do the big light and dark shapes read clearly? If not, darken your shadows one step.\n- **Colour:** is there one dominant colour family? If everything competes, calm the background down.\n- **Edges:** keep crisp edges near the focal point, softer edges further away.\n\nFor a full scored review, submit a practice template to the **AI Judge**.',
          'Đây là cách mình nhìn nó, như một buổi góp ý thân thiện:\n\n- **Điểm tốt:** tìm vùng mắt bạn nhìn đầu tiên — đó là tiêu điểm, và đáng được khen.\n- **Kiểm tra sắc độ:** nheo mắt. Các mảng sáng tối lớn có rõ không? Nếu không, hãy đậm bóng thêm một bậc.\n- **Màu sắc:** có một họ màu chủ đạo không? Nếu mọi thứ tranh nhau, hãy làm dịu nền.\n- **Cạnh:** giữ cạnh sắc gần tiêu điểm, cạnh mềm hơn ở xa.\n\nĐể có đánh giá có điểm đầy đủ, hãy nộp một mẫu luyện tập cho **Giám khảo AI**.')
        : L(lang, 'Attach an image with the 📎 button (from your collection or your device) and I’ll give you friendly feedback.', 'Đính kèm hình bằng nút 📎 (từ bộ sưu tập hoặc thiết bị) và mình sẽ góp ý thân thiện cho bạn.')}`
      cards.push({ type: 'lesson', slug: 'hue-value-saturation' })
      break
    }
    default:
      text = L(lang,
        'Hmm, I’m not sure I understood — but I’m all ears! Try asking me for **drawing ideas**, **colours that go with teal**, **composition tips**, **a 7-day challenge**, or **“explain Impressionism like I’m 12”**.',
        'Hừm, mình chưa hiểu lắm — nhưng mình luôn lắng nghe! Hãy thử hỏi mình về **ý tưởng vẽ**, **màu hợp với xanh mòng két**, **mẹo bố cục**, **thử thách 7 ngày**, hoặc **“giải thích trường phái Ấn tượng cho trẻ 12 tuổi”**.')
  }
  return { intent, text, cards }
}

/** POST /chat/stream — Server-Sent-Events style stream of tokens then cards. */
export async function* streamChatReply(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  // "thinking" time before the first token
  await sleep(600 + Math.random() * 700)
  if (useSettings.getState().simulateErrors && Math.random() < 0.15) {
    throw new ApiError('The muse lost her train of thought. Try again?', 503, 'simulated_failure')
  }
  const reply = buildReply(req)
  const tokens = reply.text.match(/\s*\S+/g) ?? []
  for (const tok of tokens) {
    if (signal?.aborted) return
    yield { type: 'token', text: tok }
    await sleep(14 + Math.random() * 38)
  }
  for (const card of reply.cards) {
    if (signal?.aborted) return
    await sleep(120)
    yield { type: 'card', card }
  }
  yield { type: 'done' }
}

/** Suggest a short conversation title from the first message. */
export function titleFor(message: string): string {
  const t = message.replace(/\s+/g, ' ').trim()
  return t.length > 42 ? `${t.slice(0, 40)}…` : t
}
