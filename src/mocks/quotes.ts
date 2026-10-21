import type { Localized } from '@/types'

export interface Quote {
  text: Localized
  by: string
}

/** Short, widely-quoted lines plus a few original atelier sayings. */
export const QUOTES: Quote[] = [
  { by: 'Ralph Waldo Emerson', text: { en: 'Every artist was first an amateur.', vi: 'Mọi nghệ sĩ đều từng là người nghiệp dư.' } },
  { by: 'Claude Monet', text: { en: 'Colour is my day-long obsession, joy and torment.', vi: 'Màu sắc là nỗi ám ảnh, niềm vui và cả sự dày vò suốt ngày dài của tôi.' } },
  { by: 'Vincent van Gogh', text: { en: 'I dream of painting, and then I paint my dream.', vi: 'Tôi mơ về hội họa, rồi tôi vẽ nên giấc mơ của mình.' } },
  { by: 'Henri Matisse', text: { en: 'Creativity takes courage.', vi: 'Sáng tạo cần lòng dũng cảm.' } },
  { by: 'Salvador Dalí', text: { en: 'Have no fear of perfection — you will never reach it.', vi: 'Đừng sợ sự hoàn hảo — bạn sẽ chẳng bao giờ chạm tới nó đâu.' } },
  { by: 'Edgar Degas', text: { en: 'Art is not what you see, but what you make others see.', vi: 'Nghệ thuật không phải là điều bạn thấy, mà là điều bạn khiến người khác thấy.' } },
  { by: 'Bob Ross', text: { en: "We don't make mistakes, just happy little accidents.", vi: 'Chúng ta không mắc lỗi, chỉ có những tai nạn nhỏ vui vẻ.' } },
  { by: 'Paul Klee', text: { en: 'A line is a dot that went for a walk.', vi: 'Một đường nét là một dấu chấm đi dạo.' } },
  { by: 'Georgia O’Keeffe', text: { en: 'I found I could say things with colour and shapes that I couldn’t say any other way.', vi: 'Tôi nhận ra mình có thể nói bằng màu sắc và hình khối những điều không thể nói bằng cách nào khác.' } },
  { by: 'The Art Spark atelier', text: { en: 'Every masterpiece begins with one brave line.', vi: 'Mọi kiệt tác đều bắt đầu từ một nét vẽ dũng cảm.' } },
  { by: 'The Art Spark atelier', text: { en: 'Your eraser is a brush that paints with light.', vi: 'Cục tẩy của bạn là cây cọ vẽ bằng ánh sáng.' } },
  { by: 'The Art Spark atelier', text: { en: 'Coffee stains count as a medium if you sign them.', vi: 'Vết cà phê cũng là chất liệu nếu bạn ký tên lên đó.' } },
  { by: 'Leonardo da Vinci', text: { en: 'Art is never finished, only abandoned.', vi: 'Nghệ thuật không bao giờ hoàn thành, chỉ là bị bỏ dở.' } },
  { by: 'Frida Kahlo', text: { en: 'Feet, what do I need you for when I have wings to fly?', vi: 'Đôi chân ơi, ta cần ngươi làm gì khi ta đã có đôi cánh để bay?' } },
]
