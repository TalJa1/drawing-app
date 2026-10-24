import type { ArtForm, CoverStyle, Difficulty } from '@/types'

type L3 = [string, string, string]
type L4 = [string, string, string, string]

const f = (
  slug: string,
  family: ArtForm['family'],
  coverStyle: CoverStyle,
  difficulty: Difficulty,
  palette: string[],
  name: [string, string],
  definition: [string, string],
  history: [string, string],
  examples: [L3, L3],
  tools: [L4, L4],
  exercise: [string, string],
  relatedLessons: string[],
): ArtForm => ({
  slug,
  family,
  coverStyle,
  difficulty,
  palette,
  name: { en: name[0], vi: name[1] },
  definition: { en: definition[0], vi: definition[1] },
  history: { en: history[0], vi: history[1] },
  examples: { en: examples[0], vi: examples[1] },
  tools: { en: tools[0], vi: tools[1] },
  exercise: { en: exercise[0], vi: exercise[1] },
  relatedLessons,
})

export const ART_FORMS: ArtForm[] = [
  f(
    'drawing',
    'drawing',
    'hatching',
    'beginner',
    ['#F6F1E7', '#1B1A17', '#6A6358'],
    ['Drawing', 'Vẽ chì / Phác họa'],
    [
      'Making marks on a surface with dry or wet tools — the foundation of almost every other art form.',
      'Tạo dấu vết trên bề mặt bằng dụng cụ khô hoặc ướt — nền tảng của hầu hết mọi loại hình nghệ thuật khác.',
    ],
    [
      'From charcoal on cave walls to Renaissance silverpoint studies and today’s sketchbook culture, drawing has always been how artists think on paper.',
      'Từ than trên vách hang đến nghiên cứu bút bạc thời Phục Hưng và văn hóa sổ phác thảo ngày nay, vẽ luôn là cách nghệ sĩ suy nghĩ trên giấy.',
    ],
    [
      ['Leonardo’s notebooks', 'Dürer’s Young Hare studies', 'Urban sketching journals'],
      ['Sổ tay của Leonardo', 'Nghiên cứu Chú thỏ non của Dürer', 'Nhật ký ký họa đô thị'],
    ],
    [
      ['Graphite pencils (2H–8B)', 'Charcoal and conté', 'Kneaded eraser', 'Smooth or toothy paper'],
      ['Bút chì (2H–8B)', 'Than và phấn conté', 'Tẩy dẻo', 'Giấy mịn hoặc giấy nhám'],
    ],
    [
      'Draw your non-dominant hand three times: in 30 seconds, 2 minutes and 10 minutes. Compare what each version noticed.',
      'Vẽ bàn tay không thuận ba lần: trong 30 giây, 2 phút và 10 phút. So sánh mỗi bản đã chú ý điều gì.',
    ],
    ['line-quality', 'contour-drawing', 'hatching-cross-hatching'],
  ),
  f(
    'oil-painting',
    'painting',
    'impasto',
    'advanced',
    ['#3E2C23', '#C9A66B', '#7A1E1E', '#1F3B4D'],
    ['Oil Painting', 'Sơn dầu'],
    [
      'Pigment bound in slow-drying oil, allowing rich blending, transparent glazes and thick impasto.',
      'Bột màu hòa trong dầu khô chậm, cho phép pha trộn phong phú, láng màu trong suốt và đắp dày.',
    ],
    [
      'Perfected in 15th-century Flanders and Venice, oil became Europe’s dominant painting medium for 500 years.',
      'Được hoàn thiện ở Flanders và Venice thế kỷ 15, sơn dầu trở thành chất liệu thống trị hội họa châu Âu suốt 500 năm.',
    ],
    [
      ['Vermeer’s luminous interiors', 'Van Gogh’s thick strokes', 'Indochina School portraits'],
      ['Nội thất rực sáng của Vermeer', 'Nét dày của Van Gogh', 'Chân dung trường phái Đông Dương'],
    ],
    [
      ['Oil paints and linseed oil', 'Bristle brushes', 'Palette knife', 'Primed canvas'],
      ['Màu dầu và dầu lanh', 'Cọ lông heo', 'Dao vẽ', 'Toan đã lót'],
    ],
    [
      'Paint an apple using only three values (light, middle, dark) with a palette knife — no brushes allowed.',
      'Vẽ một quả táo chỉ với ba sắc độ (sáng, trung, tối) bằng dao vẽ — không dùng cọ.',
    ],
    ['blending', 'light-and-shadow', 'still-life'],
  ),
  f(
    'watercolour',
    'painting',
    'washes',
    'intermediate',
    ['#9DC3E6', '#F7D9A8', '#E8A0A8', '#7FB28F'],
    ['Watercolour', 'Màu nước'],
    [
      'Transparent pigment carried by water, letting the white paper glow through. Loved for luminous washes and happy accidents.',
      'Bột màu trong suốt được nước mang đi, để giấy trắng ánh lên xuyên qua. Được yêu thích vì lớp màu loang rực sáng và những “tai nạn” thú vị.',
    ],
    [
      'Used in Chinese and Japanese painting for centuries and in European botanical and travel sketches since the 1700s.',
      'Được dùng trong hội họa Trung Hoa và Nhật Bản hàng thế kỷ, và trong ký họa thực vật, du hành châu Âu từ thế kỷ 18.',
    ],
    [
      ['Turner’s sketchbook skies', 'Botanical illustration', 'Travel journals'],
      ['Bầu trời trong sổ phác của Turner', 'Minh họa thực vật', 'Nhật ký du lịch'],
    ],
    [
      ['Pan or tube watercolours', 'Round soft brushes', 'Cold-press paper (300 gsm)', 'Two water jars'],
      ['Màu nước dạng bánh hoặc tuýp', 'Cọ tròn lông mềm', 'Giấy vân nguội (300 gsm)', 'Hai cốc nước'],
    ],
    [
      'Make a value strip: one colour, five boxes from pale to strong, adding pigment each time.',
      'Làm dải sắc độ: một màu, năm ô từ nhạt đến đậm, thêm màu mỗi lần.',
    ],
    ['watercolour-basics', 'hue-value-saturation', 'landscape-basics'],
  ),
  f(
    'acrylic',
    'painting',
    'blocks',
    'beginner',
    ['#E4572E', '#2F80C4', '#F2A93B', '#2E8B6F'],
    ['Acrylic Painting', 'Màu acrylic'],
    [
      'Fast-drying, water-based plastic paint that can look like watercolour when thin or oil when thick.',
      'Sơn gốc nước khô nhanh, có thể trông như màu nước khi pha loãng hoặc như sơn dầu khi đắp dày.',
    ],
    [
      'Invented in the 1940s–50s, acrylic powered Pop Art, murals and today’s street and studio painting.',
      'Ra đời thập niên 1940–50, acrylic là động lực của Pop Art, tranh tường và hội họa đường phố, xưởng vẽ ngày nay.',
    ],
    [
      ['Pop Art canvases', 'Contemporary murals', 'Aboriginal dot paintings'],
      ['Tranh Pop Art', 'Tranh tường đương đại', 'Tranh chấm thổ dân'],
    ],
    [
      ['Acrylic paints', 'Synthetic brushes', 'Stay-wet palette', 'Canvas board'],
      ['Màu acrylic', 'Cọ sợi tổng hợp', 'Bảng pha giữ ẩm', 'Bìa toan'],
    ],
    [
      'Paint a sunset in flat, hard-edged bands of colour — no blending, just bold steps.',
      'Vẽ hoàng hôn bằng các dải màu phẳng, viền sắc — không pha trộn, chỉ những bước màu mạnh.',
    ],
    ['colour-schemes', 'warm-and-cool'],
  ),
  f(
    'gouache',
    'painting',
    'blocks',
    'intermediate',
    ['#F4C7D7', '#C9E4DE', '#FDE2B8', '#3A3FA8'],
    ['Gouache', 'Màu bột (gouache)'],
    [
      'Opaque watercolour with a velvety, matte finish — perfect for flat illustration and poster design.',
      'Màu nước đục với bề mặt mịn như nhung — hoàn hảo cho minh họa phẳng và thiết kế áp phích.',
    ],
    [
      'A favourite of medieval illuminators, mid-century poster artists and animation background painters.',
      'Được ưa chuộng bởi người trang trí sách thời trung cổ, nghệ sĩ áp phích giữa thế kỷ 20 và họa sĩ vẽ nền hoạt hình.',
    ],
    [
      ['Matisse’s painted cut-out papers', 'Vintage travel posters', 'Animation backgrounds'],
      ['Giấy cắt tô màu của Matisse', 'Áp phích du lịch cổ điển', 'Nền phim hoạt hình'],
    ],
    [
      ['Gouache tubes', 'Flat and round brushes', 'Heavy paper', 'Mixing palette'],
      ['Tuýp gouache', 'Cọ dẹt và cọ tròn', 'Giấy dày', 'Bảng pha màu'],
    ],
    [
      'Paint a tiny 5×5 cm landscape thumbnail with just four colours and flat shapes.',
      'Vẽ một phong cảnh tí hon 5×5 cm chỉ với bốn màu và hình phẳng.',
    ],
    ['colour-schemes', 'texture'],
  ),
  f(
    'ink',
    'painting',
    'ink',
    'intermediate',
    ['#F4EFE4', '#1B1A17', '#5A5650', '#C8553D'],
    ['Ink & Brush', 'Mực & bút lông'],
    [
      'Painting and drawing with ink — from expressive brush wash to precise pen line.',
      'Vẽ bằng mực — từ nét lông loang đầy biểu cảm đến nét bút sắc gọn.',
    ],
    [
      'Ink painting flourished in China, Korea, Japan and Vietnam for over a thousand years, closely tied to calligraphy and poetry.',
      'Tranh mực phát triển rực rỡ ở Trung Quốc, Hàn Quốc, Nhật Bản và Việt Nam hơn một nghìn năm, gắn liền với thư pháp và thi ca.',
    ],
    [
      ['Song dynasty landscapes', 'Zen ensō circles', 'Pen-and-ink comics'],
      ['Phong cảnh thời Tống', 'Vòng tròn thiền ensō', 'Truyện tranh mực bút'],
    ],
    [
      ['Ink stick and stone, or bottled ink', 'Bamboo brush', 'Rice or xuan paper', 'Dip pen'],
      ['Thỏi mực và nghiên, hoặc mực chai', 'Bút lông tre', 'Giấy xuyến chỉ', 'Bút chấm mực'],
    ],
    [
      'Paint ten bamboo leaves in ten single strokes: press, pull, lift. No corrections!',
      'Vẽ mười lá tre bằng mười nét: ấn, kéo, nhấc. Không sửa!',
    ],
    ['line-quality', 'negative-space'],
  ),
  f(
    'printmaking',
    'print',
    'print',
    'intermediate',
    ['#F2E3C6', '#C8553D', '#2E6B4F', '#1B1A17'],
    ['Printmaking', 'Tranh in'],
    [
      'Creating an image on a block, plate or screen that can be inked and printed many times.',
      'Tạo hình trên bản khắc, bản kẽm hoặc khung lưới để có thể lên mực và in nhiều lần.',
    ],
    [
      'Woodblock printing spread from China; Đông Hồ, ukiyo-e and European etching made art affordable for everyone.',
      'Kỹ thuật in khắc gỗ lan ra từ Trung Quốc; tranh Đông Hồ, ukiyo-e và khắc axit châu Âu giúp mọi người đều mua được tranh.',
    ],
    [
      ['Đông Hồ New Year prints', 'Hokusai’s Great Wave', 'Warhol’s screen prints'],
      ['Tranh Tết Đông Hồ', 'Sóng lừng của Hokusai', 'Tranh in lụa của Warhol'],
    ],
    [
      ['Lino or wood block', 'Carving gouges', 'Brayer (roller)', 'Block-printing ink'],
      ['Bản khắc linoleum hoặc gỗ', 'Dao khắc', 'Con lăn mực', 'Mực in'],
    ],
    [
      'Carve a stamp from an eraser and print a repeating pattern on paper.',
      'Khắc con dấu từ cục tẩy và in một họa tiết lặp lại trên giấy.',
    ],
    ['texture', 'negative-space'],
  ),
  f(
    'sculpture',
    '3d',
    'stone',
    'advanced',
    ['#E8E2D6', '#C9C1B0', '#8A8478', '#4A3426'],
    ['Sculpture', 'Điêu khắc'],
    [
      'Art in three dimensions: carving away (stone, wood), building up (clay, wax), or assembling found materials.',
      'Nghệ thuật ba chiều: đẽo bớt (đá, gỗ), đắp thêm (đất, sáp) hoặc lắp ghép vật liệu có sẵn.',
    ],
    [
      'From the Venus of Willendorf to Greek marbles, Chăm Pa sandstone and steel public art.',
      'Từ tượng Venus Willendorf đến cẩm thạch Hy Lạp, sa thạch Chăm Pa và nghệ thuật công cộng bằng thép.',
    ],
    [
      ['Michelangelo’s David', 'Chăm Pa sandstone dancers', 'Contemporary public installations'],
      ['Tượng David của Michelangelo', 'Vũ nữ sa thạch Chăm Pa', 'Sắp đặt công cộng đương đại'],
    ],
    [
      ['Modelling clay', 'Wire armature', 'Carving tools', 'Turntable'],
      ['Đất nặn', 'Khung dây', 'Dụng cụ khắc', 'Bàn xoay'],
    ],
    [
      'Sculpt a small animal from a single ball of clay without adding pieces — pull and pinch only.',
      'Nặn một con vật nhỏ từ một viên đất duy nhất mà không thêm mảnh — chỉ kéo và véo.',
    ],
    ['basic-anatomy', 'light-and-shadow'],
  ),
  f(
    'ceramics',
    '3d',
    'clay',
    'intermediate',
    ['#C98B5B', '#2F80C4', '#F6F1E7', '#4A3426'],
    ['Ceramics', 'Gốm sứ'],
    [
      'Shaping clay into vessels or sculpture and firing it in a kiln, often finished with glass-like glazes.',
      'Tạo hình đất sét thành đồ đựng hoặc tượng rồi nung trong lò, thường phủ men như thủy tinh.',
    ],
    [
      'Among humanity’s oldest arts — from Jōmon pots to Chinese porcelain, Bát Tràng and Chu Đậu wares.',
      'Một trong những nghệ thuật lâu đời nhất — từ gốm Jōmon đến sứ Trung Hoa, gốm Bát Tràng và Chu Đậu.',
    ],
    [
      ['Blue-and-white porcelain', 'Bát Tràng ceramics', 'Japanese raku'],
      ['Sứ hoa lam', 'Gốm Bát Tràng', 'Gốm raku Nhật Bản'],
    ],
    [
      ['Clay', 'Pottery wheel', 'Kiln', 'Glazes'],
      ['Đất sét', 'Bàn xoay gốm', 'Lò nung', 'Men'],
    ],
    [
      'Draw a vase in profile, then mirror it to design a symmetrical pot with a painted band.',
      'Vẽ mặt nghiêng của chiếc bình, rồi lật đối xứng để thiết kế bình có dải hoa văn.',
    ],
    ['proportion', 'texture'],
  ),
  f(
    'photography',
    'lens',
    'lens',
    'beginner',
    ['#1B1A17', '#9C978E', '#F4EFE4', '#F2A93B'],
    ['Photography', 'Nhiếp ảnh'],
    [
      'Drawing with light: capturing images through a lens onto film or a digital sensor.',
      'Vẽ bằng ánh sáng: ghi hình qua ống kính lên phim hoặc cảm biến số.',
    ],
    [
      'Invented in the 1830s, photography freed painting from pure record-keeping and became an art of its own.',
      'Ra đời thập niên 1830, nhiếp ảnh giải phóng hội họa khỏi việc ghi chép thuần túy và trở thành một nghệ thuật riêng.',
    ],
    [
      ['Street photography', 'Portrait studios', 'Landscape photography'],
      ['Ảnh đường phố', 'Ảnh chân dung studio', 'Ảnh phong cảnh'],
    ],
    [
      ['Any camera or phone', 'Natural light', 'Tripod', 'Editing app'],
      ['Máy ảnh hoặc điện thoại', 'Ánh sáng tự nhiên', 'Chân máy', 'Ứng dụng chỉnh sửa'],
    ],
    [
      'Take five photos of the same object using the rule of thirds, a leading line, a frame, a reflection and negative space.',
      'Chụp năm ảnh cùng một vật dùng quy tắc một phần ba, đường dẫn, khung, phản chiếu và không gian âm.',
    ],
    ['rule-of-thirds', 'leading-lines', 'light-and-shadow'],
  ),
  f(
    'digital-art',
    'digital',
    'pixels',
    'beginner',
    ['#0B0F2A', '#FF2E88', '#00E5FF', '#7B2FFF'],
    ['Digital Art', 'Nghệ thuật số'],
    [
      'Art made with computers and tablets: digital painting, pixel art, 3D, animation and generative code.',
      'Nghệ thuật làm bằng máy tính và máy tính bảng: vẽ số, pixel art, 3D, hoạt hình và mã tạo sinh.',
    ],
    [
      'From 1960s plotter drawings to video-game pixels and today’s concept art and creative coding.',
      'Từ tranh vẽ máy in vẽ thập niên 1960 đến pixel trò chơi điện tử và concept art, lập trình sáng tạo ngày nay.',
    ],
    [
      ['Game concept art', 'Pixel art', 'Generative art'],
      ['Concept art trò chơi', 'Pixel art', 'Nghệ thuật tạo sinh'],
    ],
    [
      ['Tablet and stylus', 'Painting software', 'Layers and brushes', 'This very studio!'],
      ['Bảng vẽ và bút', 'Phần mềm vẽ', 'Lớp và cọ', 'Chính xưởng vẽ này!'],
    ],
    [
      'Open Free Draw, make three layers and paint a scene where each layer is a different depth (sky, hills, foreground).',
      'Mở Vẽ tự do, tạo ba lớp và vẽ cảnh mà mỗi lớp là một tầng chiều sâu (trời, đồi, tiền cảnh).',
    ],
    ['atmospheric-perspective', 'colour-schemes'],
  ),
  f(
    'illustration',
    'drawing',
    'washes',
    'beginner',
    ['#F2A93B', '#C93C6B', '#2E8B6F', '#2F80C4'],
    ['Illustration', 'Minh họa'],
    [
      'Images that tell a story or explain an idea — for books, magazines, packaging and screens.',
      'Hình ảnh kể chuyện hoặc giải thích ý tưởng — cho sách, tạp chí, bao bì và màn hình.',
    ],
    [
      'From illuminated manuscripts to golden-age picture books and today’s editorial and app illustration.',
      'Từ sách chép tay trang trí đến sách tranh thời hoàng kim và minh họa báo chí, ứng dụng ngày nay.',
    ],
    [
      ['Children’s picture books', 'Editorial magazine art', 'Botanical plates'],
      ['Sách tranh thiếu nhi', 'Minh họa tạp chí', 'Tranh thực vật'],
    ],
    [
      ['Pencils and fineliners', 'Watercolour or gouache', 'Sketchbook', 'Digital tablet'],
      ['Bút chì và bút kim', 'Màu nước hoặc gouache', 'Sổ phác thảo', 'Bảng vẽ số'],
    ],
    [
      'Illustrate a proverb in one image, e.g. “Có công mài sắt có ngày nên kim”.',
      'Minh họa một câu tục ngữ trong một hình, ví dụ “Có công mài sắt có ngày nên kim”.',
    ],
    ['rule-of-thirds', 'gesture-drawing', 'colour-psychology'],
  ),
  f(
    'comics-manga',
    'drawing',
    'panels',
    'intermediate',
    ['#FFFFFF', '#1B1A17', '#FF3B6B', '#00A8E8'],
    ['Comics & Manga', 'Truyện tranh & Manga'],
    [
      'Sequential art: panels, speech bubbles and expressive characters that tell stories through time.',
      'Nghệ thuật tuần tự: khung tranh, bong bóng thoại và nhân vật biểu cảm kể chuyện theo thời gian.',
    ],
    [
      'Rooted in Japanese emaki scrolls and newspaper strips, comics became a global medium spanning manga, bandes dessinées and webtoons.',
      'Bắt nguồn từ cuộn tranh emaki Nhật Bản và truyện tranh báo, truyện tranh trở thành phương tiện toàn cầu gồm manga, bande dessinée và webtoon.',
    ],
    [
      ['Manga series', 'Franco-Belgian albums', 'Webtoons'],
      ['Bộ manga', 'Album truyện Pháp-Bỉ', 'Webtoon'],
    ],
    [
      ['Pencil for layouts', 'Inking pens', 'Screentones', 'Ruler for panels'],
      ['Bút chì phác bố cục', 'Bút đi nét', 'Giấy tram', 'Thước kẻ khung'],
    ],
    [
      'Draw a 4-panel strip about your morning: setup, build-up, twist, punchline.',
      'Vẽ truyện 4 khung về buổi sáng của bạn: mở đầu, phát triển, bất ngờ, kết.',
    ],
    ['drawing-faces', 'gesture-drawing'],
  ),
  f(
    'calligraphy',
    'word',
    'letters',
    'intermediate',
    ['#F4EFE4', '#1B1A17', '#C8553D', '#D4AF37'],
    ['Calligraphy & Typography', 'Thư pháp & Nghệ thuật chữ'],
    [
      'The art of beautiful letters — by hand with brush or pen (calligraphy) or designed for print and screen (typography).',
      'Nghệ thuật của chữ đẹp — viết tay bằng bút lông, bút ngòi (thư pháp) hoặc thiết kế cho in ấn và màn hình (typography).',
    ],
    [
      'Chinese, Arabic and Western calligraphy are ancient arts; Vietnamese thư pháp chữ Việt blends brush energy with the Latin alphabet.',
      'Thư pháp Trung Hoa, Ả Rập và phương Tây là những nghệ thuật cổ xưa; thư pháp chữ Việt kết hợp năng lượng bút lông với chữ Latinh.',
    ],
    [
      ['Thư pháp chữ Việt at Tết fairs', 'Arabic Kufic script', 'Modern type design'],
      ['Thư pháp chữ Việt ở hội chợ Tết', 'Chữ Kufic Ả Rập', 'Thiết kế phông chữ hiện đại'],
    ],
    [
      ['Brush pen or broad nib', 'Ink', 'Guidelines', 'Smooth paper'],
      ['Bút lông hoặc ngòi dẹt', 'Mực', 'Dòng kẻ hướng dẫn', 'Giấy mịn'],
    ],
    [
      'Write your name ten times, each time making the thick downstrokes bolder and the upstrokes lighter.',
      'Viết tên bạn mười lần, mỗi lần làm nét xuống đậm hơn và nét lên mảnh hơn.',
    ],
    ['line-quality', 'negative-space'],
  ),
  f(
    'street-art',
    'street',
    'spray',
    'intermediate',
    ['#FF2E88', '#00E5FF', '#FFE45E', '#1B1A17'],
    ['Graffiti & Street Art', 'Graffiti & Nghệ thuật đường phố'],
    [
      'Art made in public space — tags, murals, stencils and paste-ups that turn cities into galleries.',
      'Nghệ thuật trong không gian công cộng — chữ ký, tranh tường, khuôn phun và dán giấy biến thành phố thành phòng tranh.',
    ],
    [
      'Born in 1970s New York subways, street art now includes commissioned murals worldwide, from Melbourne to Phùng Hưng street in Hanoi.',
      'Ra đời ở tàu điện ngầm New York thập niên 1970, nghệ thuật đường phố nay gồm cả tranh tường được đặt hàng khắp thế giới, từ Melbourne đến phố Phùng Hưng ở Hà Nội.',
    ],
    [
      ['Large-scale murals', 'Stencil art', 'Lettering “pieces”'],
      ['Tranh tường cỡ lớn', 'Tranh khuôn phun', 'Chữ graffiti “piece”'],
    ],
    [
      ['Spray paint', 'Caps of different widths', 'Stencils', 'Mask and gloves'],
      ['Sơn xịt', 'Đầu xịt nhiều cỡ', 'Khuôn', 'Khẩu trang và găng tay'],
    ],
    [
      'Design a bubble-letter version of your nickname with a drop shadow and highlight.',
      'Thiết kế biệt danh của bạn kiểu chữ bong bóng có bóng đổ và điểm sáng.',
    ],
    ['colour-schemes', 'texture'],
  ),
  f(
    'collage',
    'craft',
    'collage',
    'beginner',
    ['#F2E3C6', '#E4572E', '#2F80C4', '#F2A93B'],
    ['Collage', 'Cắt dán'],
    [
      'Assembling cut or torn materials — paper, photos, fabric — into a new image.',
      'Ghép các vật liệu cắt hoặc xé — giấy, ảnh, vải — thành một hình ảnh mới.',
    ],
    [
      'Picasso and Braque glued newspaper into Cubist paintings in 1912; Matisse later “painted with scissors”.',
      'Picasso và Braque dán báo vào tranh Lập thể năm 1912; Matisse sau đó “vẽ bằng kéo”.',
    ],
    [
      ['Cubist papier collé', 'Matisse’s cut-outs', 'Zine culture'],
      ['Papier collé Lập thể', 'Tranh cắt giấy của Matisse', 'Văn hóa zine'],
    ],
    [
      ['Old magazines', 'Scissors and craft knife', 'Glue stick', 'Coloured paper'],
      ['Tạp chí cũ', 'Kéo và dao rọc', 'Keo dán', 'Giấy màu'],
    ],
    [
      'Make a portrait using only shapes torn (not cut) from one colour family.',
      'Làm một bức chân dung chỉ bằng các mảnh xé (không cắt) từ một họ màu.',
    ],
    ['negative-space', 'colour-schemes'],
  ),
  f(
    'architecture',
    'space',
    'columns',
    'advanced',
    ['#E8D5B5', '#8A5A3B', '#5F7161', '#1F3B4D'],
    ['Architecture', 'Kiến trúc'],
    [
      'The art and science of designing buildings and spaces people live in.',
      'Nghệ thuật và khoa học thiết kế công trình, không gian con người sống.',
    ],
    [
      'From pyramids and Greek temples to Hội An merchant houses and contemporary bamboo pavilions.',
      'Từ kim tự tháp và đền Hy Lạp đến nhà cổ Hội An và các công trình tre đương đại.',
    ],
    [
      ['Gothic cathedrals', 'Hội An old town', 'Modern bamboo architecture'],
      ['Nhà thờ Gothic', 'Phố cổ Hội An', 'Kiến trúc tre hiện đại'],
    ],
    [
      ['Sketchbook and ruler', 'Perspective grids', 'Models (card, foam)', '3D software'],
      ['Sổ phác và thước', 'Lưới phối cảnh', 'Mô hình (bìa, xốp)', 'Phần mềm 3D'],
    ],
    [
      'Sketch your street in two-point perspective, starting from the nearest corner.',
      'Phác con phố của bạn bằng phối cảnh hai điểm tụ, bắt đầu từ góc gần nhất.',
    ],
    ['one-point-perspective', 'two-point-perspective'],
  ),
  f(
    'textile',
    'craft',
    'weave',
    'intermediate',
    ['#8C2F39', '#E2B13C', '#1F3B8C', '#F4E9D8'],
    ['Textile & Fibre Art', 'Nghệ thuật dệt & sợi'],
    [
      'Art made with thread, fabric and fibre — weaving, embroidery, batik, quilting and tapestry.',
      'Nghệ thuật làm bằng chỉ, vải và sợi — dệt, thêu, batik, chăn ghép và thảm thêu.',
    ],
    [
      'Textiles carry stories across cultures: the Bayeux Tapestry, Hmong embroidery, West African kente and Indonesian batik.',
      'Hàng dệt mang câu chuyện qua các nền văn hóa: thảm Bayeux, thổ cẩm H’Mông, vải kente Tây Phi và batik Indonesia.',
    ],
    [
      ['Hmong batik and embroidery', 'Kente cloth', 'Contemporary fibre sculpture'],
      ['Batik và thêu H’Mông', 'Vải kente', 'Điêu khắc sợi đương đại'],
    ],
    [
      ['Embroidery hoop and needle', 'Threads and yarns', 'Small loom', 'Wax and dye (batik)'],
      ['Khung thêu và kim', 'Chỉ và sợi', 'Khung dệt nhỏ', 'Sáp và thuốc nhuộm (batik)'],
    ],
    [
      'Design a repeating textile pattern on graph paper using only three motifs.',
      'Thiết kế hoa văn vải lặp lại trên giấy kẻ ô chỉ với ba họa tiết.',
    ],
    ['texture', 'colour-schemes'],
  ),
  f(
    'installation',
    'space',
    'space',
    'advanced',
    ['#0B0F2A', '#F2A93B', '#F6F1E7', '#7B2FFF'],
    ['Installation & Performance', 'Sắp đặt & Trình diễn'],
    [
      'Artworks that transform a whole space or happen live — you walk into them, or watch them unfold in time.',
      'Tác phẩm biến đổi cả không gian hoặc diễn ra trực tiếp — bạn bước vào trong đó, hoặc xem chúng diễn ra theo thời gian.',
    ],
    [
      'Emerging in the 1960s with “happenings”, installation and performance now fill museums, festivals and public squares.',
      'Xuất hiện thập niên 1960 với các “happening”, sắp đặt và trình diễn nay hiện diện ở bảo tàng, lễ hội và quảng trường.',
    ],
    [
      ['Immersive light rooms', 'Live performance art', 'Site-specific works'],
      ['Phòng ánh sáng đắm chìm', 'Nghệ thuật trình diễn trực tiếp', 'Tác phẩm cho địa điểm riêng'],
    ],
    [
      ['Found objects', 'Light and projection', 'Sound', 'Your body and time'],
      ['Đồ vật tìm được', 'Ánh sáng và trình chiếu', 'Âm thanh', 'Cơ thể và thời gian'],
    ],
    [
      'Rearrange one corner of your room into a “museum exhibit” about yourself, with a handwritten wall label.',
      'Sắp xếp một góc phòng thành “triển lãm bảo tàng” về chính bạn, kèm nhãn viết tay.',
    ],
    ['reading-a-painting', 'light-and-shadow'],
  ),
  f(
    'lacquer',
    'painting',
    'lacquer',
    'master',
    ['#120C0A', '#B8282E', '#D4AF37', '#F3E7C9'],
    ['Lacquer Painting', 'Sơn mài'],
    [
      'Vietnamese sơn mài: layers of natural resin, gold leaf and eggshell, sanded back to reveal glowing depth.',
      'Sơn mài Việt Nam: các lớp nhựa sơn tự nhiên, vàng lá và vỏ trứng được mài để lộ chiều sâu rực rỡ.',
    ],
    [
      'Lacquer craft is centuries old in East Asia; in 1930s Hanoi it became a fine-art painting medium unique to Vietnam.',
      'Nghề sơn đã có hàng thế kỷ ở Đông Á; ở Hà Nội thập niên 1930 nó trở thành chất liệu hội họa độc đáo của Việt Nam.',
    ],
    [
      ['Nguyễn Gia Trí’s gardens', 'Lacquer screens', 'Contemporary lacquer art'],
      ['Vườn xuân của Nguyễn Gia Trí', 'Bình phong sơn mài', 'Sơn mài đương đại'],
    ],
    [
      ['Natural lacquer (sơn ta)', 'Gold and silver leaf', 'Eggshell fragments', 'Sanding stones and water'],
      ['Sơn ta', 'Vàng và bạc lá', 'Mảnh vỏ trứng', 'Đá mài và nước'],
    ],
    [
      'In Free Draw, paint on a black background with only red, gold and ivory — then “sand” highlights with the eraser.',
      'Trong Vẽ tự do, vẽ trên nền đen chỉ với đỏ, vàng và ngà — rồi “mài” điểm sáng bằng cục tẩy.',
    ],
    ['hue-value-saturation', 'texture'],
  ),
]

export const ART_FORM_MAP: Record<string, ArtForm> = Object.fromEntries(ART_FORMS.map((x) => [x.slug, x]))
