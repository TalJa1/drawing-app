import type { Localized, RankLabel, SubScores } from '@/types'

export type SubKey = keyof SubScores

/** Phrase pools for the mock AI judge — a kind but honest art teacher. */
export const STRENGTHS: Record<SubKey, Localized[]> = {
  lineAccuracy: [
    { en: 'Your colour stays beautifully inside the lines — that’s real control.', vi: 'Màu của bạn nằm gọn gàng trong nét — đó là sự kiểm soát thật sự.' },
    { en: 'Clean, confident edges. The shapes read crisply from across the room.', vi: 'Cạnh gọn, tự tin. Các hình đọc rõ ràng dù nhìn từ xa.' },
  ],
  composition: [
    { en: 'Colour is spread with lovely balance across the whole picture.', vi: 'Màu được phân bố cân bằng đẹp mắt trên cả bức tranh.' },
    { en: 'Every area feels considered — nothing has been forgotten.', vi: 'Mọi vùng đều được chăm chút — không chỗ nào bị bỏ quên.' },
  ],
  proportion: [
    { en: 'You followed the template’s structure faithfully; the forms feel solid.', vi: 'Bạn bám sát cấu trúc của mẫu; các khối trông vững chãi.' },
    { en: 'Shapes are completed fully, giving the drawing a finished, professional look.', vi: 'Các hình được hoàn thiện trọn vẹn, tạo vẻ chỉn chu, chuyên nghiệp.' },
  ],
  harmony: [
    { en: 'Your colours get along like old friends — a genuinely harmonious palette.', vi: 'Các màu của bạn hợp nhau như bạn cũ — một bảng màu thật sự hài hòa.' },
    { en: 'Lovely hue relationships; the palette feels intentional, not accidental.', vi: 'Quan hệ màu đẹp; bảng màu có chủ đích, không phải ngẫu nhiên.' },
  ],
  suitability: [
    { en: 'Great colour choices for this subject — it feels true to its character.', vi: 'Lựa chọn màu tuyệt vời cho đề tài này — đúng với tinh thần của nó.' },
    { en: 'A rich variety of hues without tipping into chaos.', vi: 'Sắc màu phong phú mà không rơi vào hỗn loạn.' },
  ],
  aesthetics: [
    { en: 'Strong contrast between lights and darks makes the image glow.', vi: 'Tương phản sáng tối mạnh khiến bức tranh rực sáng.' },
    { en: 'The saturation is pitch-perfect: vivid where it matters, calm elsewhere.', vi: 'Độ bão hòa vừa vặn: rực rỡ đúng chỗ, êm dịu ở nơi khác.' },
  ],
}

export const WEAKNESSES: Record<SubKey, Localized[]> = {
  lineAccuracy: [
    { en: 'Some colour wanders outside the outlines, which softens the shapes.', vi: 'Một số màu tràn ra ngoài nét, làm các hình bớt rõ ràng.' },
    { en: 'A few edges look a little rushed.', vi: 'Vài cạnh trông hơi vội vàng.' },
  ],
  composition: [
    { en: 'Parts of the picture are still blank, so the eye doesn’t travel evenly.', vi: 'Một số phần của tranh còn trống, nên mắt không di chuyển đều.' },
    { en: 'The colour is clustered in one area; the rest feels unfinished.', vi: 'Màu tập trung ở một vùng; phần còn lại trông chưa xong.' },
  ],
  proportion: [
    { en: 'Several shapes are only partly filled, so the forms feel lighter than they could.', vi: 'Nhiều hình mới chỉ được tô một phần, nên khối trông nhẹ hơn mức có thể.' },
    { en: 'The structure of the template isn’t fully expressed yet.', vi: 'Cấu trúc của mẫu chưa được thể hiện đầy đủ.' },
  ],
  harmony: [
    { en: 'Some colours are fighting each other rather than working together.', vi: 'Một vài màu đang “đánh nhau” thay vì hòa hợp.' },
    { en: 'The palette feels a little random — a guiding scheme would help.', vi: 'Bảng màu hơi ngẫu nhiên — một phối màu định hướng sẽ có ích.' },
  ],
  suitability: [
    { en: 'The palette is very limited, so the subject loses some character.', vi: 'Bảng màu quá hạn chế nên đề tài mất bớt cá tính.' },
    { en: 'Many hues compete at once; the picture gets busy.', vi: 'Quá nhiều sắc màu cùng tranh nhau; bức tranh bị rối.' },
  ],
  aesthetics: [
    { en: 'Lights and darks are very similar, so the image looks flat.', vi: 'Sáng và tối quá giống nhau nên tranh trông phẳng.' },
    { en: 'Everything is at the same intensity, so nothing stands out.', vi: 'Mọi thứ cùng một cường độ nên không có gì nổi bật.' },
  ],
}

export const TIPS: Record<SubKey, Localized[]> = {
  lineAccuracy: [
    { en: 'Use the **Paint bucket** for big areas, then a small brush at 2–3 px for edges — or lock the line-art and lower the brush size near outlines.', vi: 'Dùng **Thùng sơn** cho vùng lớn, rồi cọ nhỏ 2–3 px cho mép — hoặc khóa lớp nét và giảm cỡ cọ gần đường viền.' },
    { en: 'Turn **smoothing** up to 50% in brush settings; it steadies shaky lines along edges.', vi: 'Tăng **làm mượt** lên 50% trong cài đặt cọ; nó giữ nét ổn định dọc theo mép.' },
  ],
  composition: [
    { en: 'Before details, give every area a quick base colour — then refine. This keeps the whole picture balanced.', vi: 'Trước khi làm chi tiết, hãy phủ màu nền nhanh cho mọi vùng — rồi mới tinh chỉnh. Cách này giữ cả bức tranh cân bằng.' },
    { en: 'Fill the background too: even a soft wash makes the subject sit inside a world.', vi: 'Hãy tô cả nền: chỉ một lớp loang nhẹ cũng khiến chủ thể nằm trong một thế giới.' },
  ],
  proportion: [
    { en: 'Work shape by shape: finish one region completely before moving on, and use the coverage ring as a guide.', vi: 'Làm từng hình một: hoàn thiện một vùng rồi mới chuyển sang vùng khác, dùng vòng tiến độ làm thước đo.' },
    { en: 'Try the **ghost hint** button — it flashes the regions you haven’t touched yet.', vi: 'Thử nút **gợi ý mờ** — nó nhấp nháy những vùng bạn chưa tô.' },
  ],
  harmony: [
    { en: 'Try a **complementary pair** (e.g. blue + orange) for the main areas and keep other colours as quiet neutrals.', vi: 'Thử một **cặp bổ túc** (vd. xanh lam + cam) cho vùng chính và giữ các màu khác ở dạng trung tính dịu.' },
    { en: 'Pick from the **suggested palette** for this template, or build an analogous scheme in the Colour Lab.', vi: 'Chọn từ **bảng màu gợi ý** cho mẫu này, hoặc tạo phối tương đồng trong Phòng thí nghiệm màu.' },
  ],
  suitability: [
    { en: 'Aim for 3–5 main hues: enough variety for interest, few enough for unity.', vi: 'Hướng tới 3–5 màu chính: đủ đa dạng để thú vị, đủ ít để thống nhất.' },
    { en: 'Think about the subject’s mood: warm colours for cosy scenes, cool colours for calm or night scenes.', vi: 'Nghĩ về tâm trạng đề tài: màu nóng cho cảnh ấm cúng, màu lạnh cho cảnh tĩnh lặng hoặc ban đêm.' },
  ],
  aesthetics: [
    { en: 'Add **shading**: use a darker version of each colour on one side of every shape to suggest light.', vi: 'Thêm **đổ bóng**: dùng phiên bản đậm hơn của mỗi màu ở một phía của từng hình để gợi ánh sáng.' },
    { en: 'Save your brightest, most saturated colour for the focal point and calm everything else down.', vi: 'Dành màu sáng và rực nhất cho tiêu điểm, làm dịu mọi thứ khác.' },
  ],
}

export const GENERAL: Record<RankLabel, Localized[]> = {
  starter: [
    { en: 'Every artist starts with a blank page — and you have begun. Now let’s fill it with colour.', vi: 'Mọi nghệ sĩ đều bắt đầu từ trang trắng — và bạn đã bắt đầu. Giờ hãy lấp đầy nó bằng màu sắc.' },
  ],
  rising: [
    { en: 'There’s a real picture emerging here. A little more completion and it will start to sing.', vi: 'Một bức tranh thật sự đang hiện ra. Hoàn thiện thêm chút nữa là nó sẽ bắt đầu “cất tiếng hát”.' },
  ],
  steady: [
    { en: 'Solid, thoughtful work. Your hand is clearly getting steadier.', vi: 'Một tác phẩm chắc chắn, chu đáo. Tay bạn rõ ràng đang vững vàng hơn.' },
  ],
  gallery: [
    { en: 'This would look right at home on a gallery wall. Lovely, confident choices.', vi: 'Bức này hoàn toàn xứng đáng treo trong phòng tranh. Những lựa chọn đáng yêu và tự tin.' },
  ],
  masterpiece: [
    { en: 'Wow. Control, harmony and finish — this is a true masterpiece.', vi: 'Tuyệt vời. Kiểm soát, hài hòa và hoàn thiện — đây là một kiệt tác thật sự.' },
  ],
}

export const JUDGE_NOTES: Record<RankLabel, Localized[]> = {
  starter: [
    { en: 'Brave first marks! Next time, let’s give every shape a colour. — your judge', vi: 'Những nét đầu tiên thật dũng cảm! Lần tới, hãy cho mỗi hình một màu nhé. — giám khảo' },
    { en: 'A quiet canvas is full of possibility. I can’t wait to see it bloom.', vi: 'Một bức tranh lặng lẽ chứa đầy khả năng. Mình nóng lòng muốn thấy nó nở hoa.' },
  ],
  rising: [
    { en: 'I see the start of something special — keep going!', vi: 'Mình thấy khởi đầu của điều đặc biệt — tiếp tục nhé!' },
    { en: 'Good instincts. Finish the shapes and watch it come alive.', vi: 'Bản năng tốt. Hoàn thiện các hình và xem nó sống dậy.' },
  ],
  steady: [
    { en: 'Steady hands, warm heart. This one made me smile.', vi: 'Tay vững, lòng ấm. Bức này làm mình mỉm cười.' },
    { en: 'You’re finding your voice. I can hear it in the colours.', vi: 'Bạn đang tìm thấy tiếng nói riêng. Mình nghe thấy nó trong màu sắc.' },
  ],
  gallery: [
    { en: 'Frame it. Seriously — frame this one.', vi: 'Đóng khung nó đi. Thật đấy — bức này đáng đóng khung.' },
    { en: 'I lingered on this one longer than I meant to. That’s the best compliment I have.', vi: 'Mình nán lại ngắm bức này lâu hơn dự định. Đó là lời khen tốt nhất mình có.' },
  ],
  masterpiece: [
    { en: 'The old masters would nod at this. Bravo!', vi: 'Các bậc thầy xưa hẳn sẽ gật gù trước bức này. Hoan hô!' },
    { en: 'I have nothing to correct — only to admire.', vi: 'Mình chẳng có gì để sửa — chỉ có thể ngưỡng mộ.' },
  ],
}
