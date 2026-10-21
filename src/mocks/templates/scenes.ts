import { circle, frame, INK, NONE, star, wrap } from './svg'

const pine = (x: number, base: number, h: number) =>
  `<rect x="${x - 7}" y="${base - 18}" width="14" height="26"/><path d="M${x} ${base - h} L ${x - h * 0.36} ${base - h * 0.45} L ${x - h * 0.2} ${base - h * 0.45} L ${x - h * 0.45} ${base - 10} L ${x + h * 0.45} ${base - 10} L ${x + h * 0.2} ${base - h * 0.45} L ${x + h * 0.36} ${base - h * 0.45} Z"/>`

export const mountainLake = wrap(`
${circle(900, 210, 62)}
<path d="M200 222 C 200 182 250 172 270 192 C 290 152 360 162 360 202 C 400 202 410 242 380 252 L 210 252 C 180 252 180 227 200 222 Z"/>
<path d="M640 160 C 640 135 675 128 690 142 C 705 115 755 122 755 150 C 785 150 790 178 768 184 L 650 184 C 628 184 626 165 640 160 Z"/>
<path d="M60 480 L 260 262 L 380 382 L 520 202 L 700 422 L 820 302 L 1000 472 L 1140 362 L 1140 540 L 60 540 Z"/>
<path d="M520 202 L 468 266 L 498 254 L 528 278 L 552 248 L 574 264 Z"/>
<path d="M260 262 L 224 302 L 250 294 L 270 308 L 290 292 Z"/>
<path d="M820 302 L 786 336 L 808 330 L 826 344 L 846 326 Z"/>
<path d="M60 560 C 250 470 400 520 560 540 C 760 562 900 482 1140 530 L 1140 600 L 60 600 Z"/>
${pine(150, 590, 130)}${pine(230, 585, 100)}${pine(980, 585, 120)}${pine(1060, 585, 150)}
<path d="M60 600 H1140 V840 H60 Z"/>
<path d="M180 650 L 340 650 M420 680 L 640 680 M150 730 L 300 730 M880 650 L 1060 650 M860 760 L 1080 760 M400 790 L 520 790" ${NONE} stroke-width="5"/>
<path d="M700 712 L 862 712 C 842 752 722 752 700 712 Z"/>
<path d="M782 708 L 782 600 L 846 700 Z"/>
<path d="M776 700 L 776 620 L 730 700 Z"/>
<path d="M700 770 C 740 760 820 760 862 770" ${NONE} stroke-width="5"/>
<path d="M440 150 q 14 -14 28 0 q 14 -14 28 0 M520 110 q 10 -10 20 0 q 10 -10 20 0" ${NONE} stroke-width="5"/>
${frame()}
`)

export const countryside = wrap(`
${circle(180, 180, 70)}
<path d="M180 80 L 180 60 M265 115 L 285 95 M290 185 L 315 185 M95 115 L 75 95 M265 255 L 285 275" ${NONE}/>
<path d="M60 520 C 300 380 560 420 760 500 C 900 452 1050 432 1140 470 L 1140 840 L 60 840 Z"/>
<rect x="850" y="340" width="34" height="70"/>
<rect x="700" y="420" width="200" height="140"/>
<path d="M680 428 L 800 330 L 920 428 Z"/>
${circle(800, 385, 20)}
<rect x="775" y="480" width="50" height="80"/>
${circle(815, 522, 4, INK)}
<rect x="718" y="450" width="40" height="40"/><path d="M738 450 L 738 490 M718 470 L 758 470" ${NONE} stroke-width="4"/>
<rect x="842" y="450" width="40" height="40"/><path d="M862 450 L 862 490 M842 470 L 882 470" ${NONE} stroke-width="4"/>
<rect x="322" y="440" width="36" height="170"/>
<path d="M340 470 C 250 482 228 392 290 360 C 278 296 360 266 402 306 C 452 286 506 336 474 386 C 524 426 474 488 402 468 C 380 490 360 490 340 470 Z"/>
${circle(310, 380, 14)}${circle(420, 350, 14)}${circle(440, 430, 14)}${circle(360, 330, 12)}
<path d="M60 650 C 300 560 600 600 1140 640 L 1140 840 L 60 840 Z"/>
<path d="M820 840 C 800 740 790 640 810 560 L 832 560 C 836 640 870 740 970 840 Z"/>
<path d="M100 620 L 100 700 M180 610 L 180 690 M260 604 L 260 684 M340 602 L 340 682 M420 604 L 420 684 M90 640 L 430 630 M90 668 L 430 660" ${NONE}/>
${circle(520, 740, 14)}${circle(560, 770, 12)}${circle(1040, 740, 14)}${circle(620, 720, 12)}${circle(150, 780, 14)}${circle(1000, 790, 12)}
<path d="M540 180 q 14 -14 28 0 q 14 -14 28 0 M620 140 q 10 -10 20 0 q 10 -10 20 0" ${NONE} stroke-width="5"/>
<path d="M880 160 C 880 125 925 118 940 138 C 960 108 1020 118 1020 152 C 1052 152 1058 186 1030 192 L 892 192 C 866 192 864 168 880 160 Z"/>
${frame()}
`)

function buildingWindows(x: number, y: number, w: number, h: number, cols: number, rows: number): string {
  let s = ''
  const ww = 18
  const wh = 26
  const gx = (w - cols * ww) / (cols + 1)
  const gy = 22
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + gx + c * (ww + gx)
      const wy = y + 26 + r * (wh + gy)
      if (wy + wh > y + h - 20) continue
      s += `<rect x="${wx.toFixed(1)}" y="${wy}" width="${ww}" height="${wh}" stroke-width="4"/>`
    }
  }
  return s
}

export const citySkyline = (() => {
  const back: [number, number, number, number][] = [
    [100, 350, 120, 450],
    [240, 250, 100, 550],
    [360, 400, 140, 400],
    [520, 200, 90, 600],
    [630, 330, 130, 470],
    [780, 280, 110, 520],
    [910, 380, 120, 420],
    [1040, 300, 90, 500],
  ]
  const front: [number, number, number, number][] = [
    [60, 560, 160, 240],
    [230, 520, 110, 280],
    [350, 600, 180, 200],
    [560, 500, 120, 300],
    [700, 580, 170, 220],
    [890, 540, 130, 260],
    [1030, 600, 110, 200],
  ]
  let s = circle(960, 170, 55)
  s += star(150, 150, 5, 18, 8) + star(420, 120, 5, 14, 6) + star(760, 160, 5, 16, 7) + star(1080, 110, 5, 12, 5)
  s += `<path d="M565 200 L 565 130 M548 200 L 565 160 L 582 200 Z"/>`
  s += `<path d="M795 280 L 835 230 L 875 280 Z"/>`
  for (const [x, y, w, h] of back)
    s +=
      `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>` +
      buildingWindows(x, y, w, Math.min(h, 220), Math.max(2, Math.floor(w / 40)), 4)
  for (const [x, y, w, h] of front)
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>` + buildingWindows(x, y, w, h, Math.max(2, Math.floor(w / 38)), 5)
  s += `<rect x="60" y="800" width="1080" height="40"/>`
  s += `<path d="M120 820 L 200 820 M330 820 L 430 820 M640 820 L 760 820 M920 820 L 1010 820" ${NONE} stroke-width="4"/>`
  s += frame()
  return wrap(s)
})()

const yl = (y: number) => 660 + ((640 - y) * 30) / 340
const yr = (y: number) => 1460 - yl(y)

export const lighthouse = wrap(`
${circle(200, 180, 46)}
<path d="M765 236 L 1110 168 L 1110 304 Z"/>
<path d="M695 236 L 350 168 L 350 304 Z"/>
<path d="M60 640 C 200 610 340 670 480 640 C 620 610 760 670 900 640 C 1000 620 1080 640 1140 630 L 1140 840 L 60 840 Z"/>
<path d="M120 720 C 200 705 280 735 360 720 M760 760 C 840 745 920 775 1000 760 M420 800 C 500 785 580 815 660 800" ${NONE} stroke-width="5"/>
<path d="M560 700 C 560 640 640 610 760 615 C 870 622 912 676 905 722 L 560 722 Z"/>
<path d="M600 690 C 640 670 690 668 720 680" ${NONE} stroke-width="5"/>
<path d="M660 640 L 690 300 L 770 300 L 800 640 Z"/>
<path d="M${yl(500)} 500 L ${yr(500)} 500 L ${yr(550)} 550 L ${yl(550)} 550 Z"/>
<path d="M${yl(370)} 370 L ${yr(370)} 370 L ${yr(420)} 420 L ${yl(420)} 420 Z"/>
<rect x="716" y="440" width="28" height="40" rx="14"/>
<path d="M715 640 L 715 600 A 15 15 0 0 1 745 600 L 745 640 Z"/>
<rect x="695" y="215" width="70" height="72"/>
<path d="M718 215 L 718 287 M742 215 L 742 287" ${NONE} stroke-width="4"/>
<rect x="668" y="284" width="124" height="20" rx="4"/>
<path d="M684 215 L 730 165 L 776 215 Z"/>
${circle(730, 156, 9)}
<path d="M150 600 L 290 600 C 280 630 170 630 150 600 Z"/>
<path d="M218 596 L 218 470 L 284 590 Z"/>
<path d="M212 590 L 212 500 L 160 590 Z"/>
<path d="M420 140 q 14 -14 28 0 q 14 -14 28 0 M500 200 q 10 -10 20 0 q 10 -10 20 0 M900 380 q 12 -12 24 0 q 12 -12 24 0" ${NONE} stroke-width="5"/>
${frame()}
`)

export const mushroomHouse = wrap(`
${circle(980, 170, 52)}${circle(1002, 156, 46, 'fill="#fff"')}
${star(200, 150, 5, 22, 9)}${star(420, 110, 5, 16, 7)}${star(800, 120, 5, 18, 8)}${star(1080, 300, 5, 14, 6)}
<path d="M60 760 C 300 722 900 722 1140 760 L 1140 840 L 60 840 Z"/>
<rect x="690" y="245" width="38" height="80"/>
<path d="M684 245 L 734 245 L 730 228 L 688 228 Z"/>
<path d="M470 760 C 480 650 490 560 500 480 L 700 480 C 710 560 720 650 730 760 Z"/>
<path d="M560 760 L 560 664 C 560 618 640 618 640 664 L 640 760 Z"/>
${circle(625, 712, 6, INK)}
${circle(540, 565, 30)}<path d="M540 535 L 540 595 M510 565 L 570 565" ${NONE} stroke-width="4"/>
${circle(668, 610, 24)}<path d="M668 586 L 668 634 M644 610 L 692 610" ${NONE} stroke-width="4"/>
<path d="M380 500 C 360 330 480 230 600 230 C 720 230 840 330 820 500 C 760 522 440 522 380 500 Z"/>
<ellipse cx="480" cy="390" rx="40" ry="30"/>
<ellipse cx="620" cy="320" rx="46" ry="32"/>
<ellipse cx="730" cy="410" rx="36" ry="28"/>
<ellipse cx="570" cy="450" rx="28" ry="20"/>
${circle(430, 470, 16)}${circle(780, 470, 14)}
<ellipse cx="600" cy="790" rx="42" ry="14"/><ellipse cx="560" cy="815" rx="40" ry="13"/>
<path d="M210 770 C 212 720 218 700 225 690 L 255 690 C 262 700 268 720 270 770 Z"/>
<path d="M190 700 C 185 640 300 640 290 700 Z"/>
<path d="M930 772 C 931 742 935 728 940 720 L 960 720 C 965 728 969 742 970 772 Z"/>
<path d="M915 728 C 912 688 990 688 985 728 Z"/>
<path d="M120 790 l 10 -30 l 10 30 M330 780 l 8 -26 l 8 26 M1060 790 l 10 -30 l 10 30 M820 782 l 8 -26 l 8 26" ${NONE}/>
${circle(380, 770, 12)}${circle(860, 760, 12)}
${frame()}
`)

/** Hội An lanterns hanging under a tiled eave. */
export const lanterns = (() => {
  const lantern = (x: number, top: number, h: number, bulge: number) => {
    const w = 62
    const bot = top + h
    const mid = top + h / 2
    let s = `<path d="M${x} 130 L ${x} ${top - 26}" fill="none"/>`
    s += `<rect x="${x - 36}" y="${top - 26}" width="72" height="26" rx="6"/>`
    const ks = [-1, -0.5, 0, 0.5, 1]
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i]
      const b = ks[i + 1]
      s += `<path d="M${x + a * w} ${top} Q ${x + a * bulge} ${mid} ${x + a * w} ${bot} L ${x + b * w} ${bot} Q ${x + b * bulge} ${mid} ${x + b * w} ${top} Z"/>`
    }
    s += `<path d="M${x - bulge * 0.92} ${mid} L ${x + bulge * 0.92} ${mid}" fill="none" stroke-width="5"/>`
    s += `<rect x="${x - 36}" y="${bot}" width="72" height="22" rx="6"/>`
    s += `<path d="M${x - 22} ${bot + 22} L ${x - 32} ${bot + 110} L ${x + 32} ${bot + 110} L ${x + 22} ${bot + 22} Z"/>`
    s += `<path d="M${x - 14} ${bot + 34} L ${x - 18} ${bot + 104} M${x} ${bot + 34} L ${x} ${bot + 104} M${x + 14} ${bot + 34} L ${x + 18} ${bot + 104}" fill="none" stroke-width="4"/>`
    return s
  }
  let s = `<path d="M60 60 L 1140 60 L 1140 120 C 900 152 300 152 60 120 Z"/>`
  for (let x = 90; x < 1140; x += 60)
    s += `<path d="M${x} ${118 + Math.sin((x - 600) / 300) * 4} q 30 30 60 0" fill="none" stroke-width="5"/>`
  // back row first so the front lanterns hide their strings
  s += lantern(410, 540, 150, 105)
  s += lantern(790, 570, 140, 100)
  s += lantern(240, 300, 230, 150)
  s += lantern(600, 220, 280, 175)
  s += lantern(960, 330, 210, 140)
  s += circle(120, 760, 30) + circle(1080, 760, 30)
  s += `<path d="M60 820 C 300 800 900 800 1140 820" ${NONE}/>`
  s += frame()
  return wrap(s)
})()
