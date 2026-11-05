import { useSettings } from '@/store/settings'
import type { Lang, SubScores } from '@/types'
import { AiTransportError } from './errors'
import type { JudgeTransport } from './judgeContract'

type Aspect = keyof SubScores
type Band = 'early' | 'developing' | 'strong'
type Copy = {
  summary: Record<Band, string>
  strength: Record<Aspect, string>
  tip: Record<Aspect, string>
  general: string
  exercise: Record<Aspect, string>
}
const ASPECTS: Aspect[] = ['lineAccuracy', 'composition', 'proportion', 'harmony', 'suitability', 'aesthetics']

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

/** Offline stand-in for the judge endpoint: canned feedback aimed at the weakest aspect. */
export function createMockJudgeTransport({ delayMs = 800 }: { delayMs?: number } = {}): JudgeTransport {
  const copy: Record<Lang, Copy> = {
    en: {
      summary: {
        early: 'A good start! A few focused habits will make the shapes read much more clearly.',
        developing: 'Nice work: the drawing reads clearly, and one or two small habits will lift it further.',
        strong: 'Lovely work, with confident colour and tidy shapes. Small refinements will make it shine.',
      },
      strength: {
        lineAccuracy: 'Your colour stays neatly inside the lines.',
        composition: 'Colour is spread evenly across the whole picture.',
        proportion: "The shapes keep the template's proportions well.",
        harmony: 'Your colours sit together pleasantly.',
        suitability: 'Your colours suit the subject and the suggested palette.',
        aesthetics: 'Lights and darks give the drawing a clear shape.',
      },
      tip: {
        lineAccuracy: 'Slow down near the outlines and finish each edge with a small brush so colour stays inside the lines.',
        composition: 'Fill the empty areas too, so colour spreads evenly across every part of the template.',
        proportion: 'Compare each filled shape with the template outline and keep its size and edges matching.',
        harmony: 'Pick two colours that sit next to each other on the colour wheel and repeat them across the drawing.',
        suitability: 'Start from the suggested palette and add one or two hues that fit the subject.',
        aesthetics: 'Add one darker shade and one lighter shade so the lights and darks stand out.',
      },
      general: 'Step back for a moment and look at the whole picture before adding details.',
      exercise: {
        lineAccuracy: 'Colour one small shape slowly, keeping a thin gap from the line, then close the gap carefully.',
        composition: 'Colour the background in one calm tone, then check that no area is left empty.',
        proportion: 'Trace the main shape lightly first, then fill it without changing its outline.',
        harmony: 'Make a mini palette of three related colours and use only those on a quick sketch.',
        suitability: 'Colour the subject twice: once with the suggested palette and once with your own picks.',
        aesthetics: 'Shade one object with three values: light, middle and dark.',
      },
    },
    vi: {
      summary: {
        early: 'Một khởi đầu tốt! Vài thói quen nhỏ sẽ giúp các hình rõ ràng hơn nhiều.',
        developing: 'Làm tốt lắm: bài vẽ đã rõ ràng, thêm một hai thói quen nhỏ sẽ nâng bài lên nữa.',
        strong: 'Bài vẽ rất đẹp, màu tự tin và hình gọn gàng. Vài tinh chỉnh nhỏ sẽ làm bài thêm nổi bật.',
      },
      strength: {
        lineAccuracy: 'Màu của bạn nằm gọn trong nét viền.',
        composition: 'Màu được trải đều khắp bức tranh.',
        proportion: 'Các hình giữ tỉ lệ của mẫu rất tốt.',
        harmony: 'Các màu bạn chọn đi với nhau thật dễ chịu.',
        suitability: 'Màu hợp với chủ đề và bảng màu gợi ý.',
        aesthetics: 'Sáng tối rõ ràng giúp bài vẽ có khối.',
      },
      tip: {
        lineAccuracy: 'Đi chậm lại gần nét viền và hoàn thiện mép bằng cọ nhỏ để màu không lem ra ngoài.',
        composition: 'Tô cả những vùng còn trống để màu trải đều trên mọi phần của mẫu.',
        proportion: 'So từng hình đã tô với nét viền của mẫu và giữ kích thước, mép khớp nhau.',
        harmony: 'Chọn hai màu đứng cạnh nhau trên vòng màu và lặp lại chúng khắp bài vẽ.',
        suitability: 'Bắt đầu từ bảng màu gợi ý rồi thêm một hai sắc hợp với chủ đề.',
        aesthetics: 'Thêm một sắc đậm hơn và một sắc nhạt hơn để vùng sáng tối nổi lên.',
      },
      general: 'Lùi lại một chút và nhìn cả bức tranh trước khi thêm chi tiết.',
      exercise: {
        lineAccuracy: 'Tô chậm một hình nhỏ, chừa một khe mảnh sát nét viền rồi khép khe thật cẩn thận.',
        composition: 'Tô nền bằng một tông màu dịu, rồi kiểm tra không còn vùng nào bị bỏ trống.',
        proportion: 'Phác nhẹ hình chính trước, rồi tô kín mà không làm đổi nét viền.',
        harmony: 'Pha một bảng màu nhỏ gồm ba màu gần nhau và chỉ dùng chúng cho một bản phác nhanh.',
        suitability: 'Tô chủ thể hai lần: một lần theo bảng màu gợi ý, một lần theo màu bạn tự chọn.',
        aesthetics: 'Đánh bóng một vật với ba sắc độ: sáng, trung gian và tối.',
      },
    },
  }
  return {
    async requestFeedback(req, signal) {
      signal.throwIfAborted()
      if (useSettings.getState().simulateErrors) throw new AiTransportError('upstream')
      await pause(delayMs, signal)
      const { sub, overall } = req.score
      const weakest = ASPECTS.reduce((low, key) => (sub[key] < sub[low] ? key : low))
      const strongest = ASPECTS.reduce((high, key) => (sub[key] > sub[high] ? key : high))
      const text = copy[req.lang]
      const band: Band = overall >= 75 ? 'strong' : overall >= 50 ? 'developing' : 'early'
      return {
        summary: text.summary[band],
        strengths: [text.strength[strongest]],
        tips: [text.tip[weakest], text.general],
        exercise: text.exercise[weakest],
      }
    },
  }
}

export const mockJudgeTransport = /* @__PURE__ */ createMockJudgeTransport()
