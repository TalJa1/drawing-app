/* The art of the tool sprites: the stand-alone SVG of every tool in each state (see toolSprites.ts for the rest).

   Ported from "Art Spark tool cursor sprite studio" (the studio's getToolSpriteSVG): polished walnut, brushed brass, glass and
   gum rubber, with the paper shadow that gets shorter when the tool is pressed and longer when it lifts. Differences from the
   studio, all of them because a cursor is a picture that is drawn once and then only moved:
    - every sprite is a stand-alone SVG (the studio shared its gradients through the page; an <img> cannot see the page);
    - no CSS: transforms are attributes, the shadow is built from filter primitives that every engine has, nothing is animated
      (the studio's spray / ripple / crumb loops cannot run inside an image, and an endless loop is what a cursor must not have);
    - the pigment is written into the sprite as #RRGGBB, so the cursor shows the colour that will be drawn.
   The shapes of the chalk are new (the studio has no chalk); they are drawn in the same materials.

   Only the spriteStore imports this file, and only through import(): it is ~25 KB that most pages never need. */
import { SPRITE_VIEW, spriteHex, type SpriteKind, type SpritePigment, type SpriteState } from './toolSprites'

const CONTOUR = '#23160E'

// ---------- shared materials ----------

const stops = (list: [number, string, number?][]) =>
  list.map(([o, c, a]) => `<stop offset="${o}%" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')
const grad = (id: string, x1: number, y1: number, x2: number, y2: number, list: [number, string, number?][]) =>
  `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops(list)}</linearGradient>`

const MATERIALS: Record<string, string> = {
  'walnut-wood': grad('walnut-wood', 0, 0, 100, 100, [
    [0, '#24150E'],
    [28, '#4A2E20'],
    [44, '#8C6752'],
    [58, '#3D2418'],
    [86, '#1E110A'],
    [100, '#382216'],
  ]),
  'walnut-cylinder': grad('walnut-cylinder', 20, 15, 80, 85, [
    [0, '#23140D'],
    [30, '#593827'],
    [46, '#9A745E'],
    [62, '#361F14'],
    [90, '#1A0E08'],
    [100, '#3A2217'],
  ]),
  'rosewood-grad': grad('rosewood-grad', 15, 15, 85, 85, [
    [0, '#4A1F18'],
    [35, '#7D392D'],
    [48, '#B36556'],
    [70, '#57241B'],
    [100, '#2E110C'],
  ]),
  'cedar-cone': grad('cedar-cone', 15, 15, 85, 85, [
    [0, '#CFA072'],
    [40, '#F5D7B8'],
    [75, '#C99665'],
    [100, '#9E6E42'],
  ]),
  'beechwood-grad': grad('beechwood-grad', 10, 10, 90, 90, [
    [0, '#E6C194'],
    [32, '#F7DFC2'],
    [68, '#C89B68'],
    [100, '#8F6339'],
  ]),
  'ochre-cap': grad('ochre-cap', 15, 15, 85, 85, [
    [0, '#C97E1A'],
    [38, '#F5B84E'],
    [52, '#FFE094'],
    [80, '#B86F14'],
    [100, '#7D4908'],
  ]),
  'brushed-brass': grad('brushed-brass', 15, 15, 85, 85, [
    [0, '#8A6421'],
    [25, '#D9B15B'],
    [45, '#FFF0B8'],
    [65, '#B58938'],
    [85, '#6E4E16'],
    [100, '#A67C2E'],
  ]),
  'copper-pot': grad('copper-pot', 0, 15, 100, 85, [
    [0, '#6E3522'],
    [32, '#C76D4E'],
    [48, '#F5A887'],
    [72, '#8F442B'],
    [100, '#4A1F12'],
  ]),
  'polished-steel': grad('polished-steel', 10, 10, 90, 90, [
    [0, '#7A8288'],
    [35, '#D7DFE6'],
    [50, '#FFFFFF'],
    [75, '#8C969E'],
    [100, '#495057'],
  ]),
  'glass-tube': grad('glass-tube', 15, 15, 85, 85, [
    [0, '#D8EEF2', 0.78],
    [35, '#FFFFFF', 0.92],
    [65, '#B7DDE6', 0.55],
    [100, '#7FAFC2', 0.75],
  ]),
  'cream-bristle': grad('cream-bristle', 15, 15, 85, 85, [
    [0, '#FDFBF7'],
    [55, '#F2E6D0'],
    [100, '#D6C3A5'],
  ]),
  soft: `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`,
}

/** The paper shadow of each state, with the studio's offsets and strengths. */
const SHADOW: Record<SpriteState, { dx: number; dy: number; blur: number; alpha: number; colour: string; grow: number }> = {
  idle: { dx: 8, dy: 10, blur: 3.2, alpha: 0.24, colour: '#2D2014', grow: 30 },
  down: { dx: 2, dy: 2.5, blur: 1.3, alpha: 0.34, colour: '#26190E', grow: 30 },
  up: { dx: 11, dy: 13, blur: 4.4, alpha: 0.19, colour: '#2D2014', grow: 35 },
}

/** Built from primitives (not feDropShadow) so that every engine draws the same shadow. */
function shadowFilter(state: SpriteState): string {
  const s = SHADOW[state]
  return (
    `<filter id="shadow" x="-${s.grow}%" y="-${s.grow}%" width="${100 + 2 * s.grow}%" height="${100 + 2 * s.grow}%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${s.blur}"/>` +
    `<feOffset dx="${s.dx}" dy="${s.dy}" result="cast"/>` +
    `<feFlood flood-color="${s.colour}" flood-opacity="${s.alpha}"/>` +
    `<feComposite in2="cast" operator="in"/>` +
    `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter>`
  )
}

// ---------- geometry helpers ----------

interface Pose {
  tx?: number
  ty?: number
  rot?: number
  scale?: number
}
/** `transform-origin` + `transform` of CSS, as one SVG transform. */
function pose(ox: number, oy: number, p: Pose): string {
  const { tx = 0, ty = 0, rot = 0, scale = 1 } = p
  if (!tx && !ty && !rot && scale === 1) return ''
  return ` transform="translate(${ox} ${oy}) translate(${tx} ${ty}) rotate(${rot}) scale(${scale}) translate(${-ox} ${-oy})"`
}
/** The whole tool leans towards the paper when pressed and away from it after the release. */
const POSE: Record<SpriteState, Pose> = {
  idle: {},
  down: { tx: 3, ty: 4, rot: -6 },
  up: { tx: -3, ty: -4, rot: 5 },
}

/** What every tool shares: the shadow, the lean of the state, then its own parts. */
function figure(state: SpriteState, origin: readonly [number, number], parts: string, own?: Pose): string {
  return `<g filter="url(#shadow)"${pose(origin[0], origin[1], own ?? POSE[state])}>${parts}</g>`
}

const droplet = (state: SpriteState, c: string, x: number, y: number) =>
  state === 'up'
    ? `<g opacity="0.85" transform="translate(-6 -8)"><path d="M${x} ${y - 6} C${x + 3} ${y - 2} ${x + 3} ${y + 2} ${x} ${y + 2} C${x - 3} ${y + 2} ${x - 3} ${y - 2} ${x} ${y - 6} Z" fill="${c}" stroke="${CONTOUR}" stroke-width="1"/><circle cx="${x - 5}" cy="${y - 5}" r="1.8" fill="${c}"/></g>`
    : ''

const edge = (width = 1.5) => `stroke="${CONTOUR}" stroke-width="${width}" stroke-linejoin="round"`

// ---------- the tools ----------

type Build = (state: SpriteState, c: string) => string

const TOOL: Record<SpriteKind, Build> = {
  pencil: (s, c) =>
    (s === 'down'
      ? `<path d="M 10 89 L 22 85 M 13 93 L 26 88 M 17 96 L 29 91" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`
      : '') +
    droplet(s, c, 18, 86) +
    figure(
      s,
      [25, 82],
      `<path d="M 80 14 C 84 10, 90 10, 94 14 C 98 18, 98 24, 94 28 L 88 34 L 74 20 Z" fill="#D96B52" ${edge()}/>` +
        `<path d="M 82 16 C 85 13, 89 13, 91 15" stroke="#FBD0C4" stroke-width="1.3" stroke-linecap="round" opacity="0.65"/>` +
        `<path d="M 74 20 L 88 34 L 80 42 L 66 28 Z" fill="url(#brushed-brass)" ${edge()}/>` +
        `<path d="M 71 23 L 85 37" stroke="${c}" stroke-width="2.4"/>` +
        `<path d="M 66 28 L 80 42 L 44 78 L 30 64 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
        `<path d="M 70 32 L 34 68" stroke="#9E7B66" stroke-width="2.2" opacity="0.65"/>` +
        `<path d="M 75 37 L 39 73" stroke="#1A0E08" stroke-width="1.2" opacity="0.55"/>` +
        `<path d="M 30 64 C 33 66, 36 69, 39 72 C 41 74, 42 76, 44 78 L 18 90 Z" fill="url(#cedar-cone)" ${edge()}/>` +
        `<path d="M 25.5 82.5 L 28.5 85.5 L 18 90 Z" fill="${c}" stroke="${CONTOUR}" stroke-width="1.4" stroke-linejoin="round"/>`,
    ),

  pen: (s, c) => {
    const down = s === 'down'
    const left = down ? 'M 36 56 L 26 62 L 16 88 L 30 70 Z' : 'M 36 56 L 26 62 L 19 88 L 31 70 Z'
    const right = down ? 'M 50 70 L 44 80 L 21 90 L 31 70 Z' : 'M 50 70 L 44 80 L 19 88 L 31 70 Z'
    return (
      (down
        ? `<ellipse cx="19" cy="89" rx="7" ry="4" fill="${c}" opacity="0.88"/><circle cx="19" cy="89" r="10" stroke="${c}" stroke-width="1.5"/>`
        : '') +
      droplet(s, c, 19, 88) +
      figure(
        s,
        [28, 78],
        `<path d="M 80 16 C 85 11, 91 11, 95 15 C 99 19, 98 25, 93 30 L 86 23 Z" fill="url(#ochre-cap)" ${edge()}/>` +
          `<path d="M 80 16 C 67 26, 55 38, 43 50 L 56 63 C 68 51, 80 39, 93 30 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
          `<path d="M 82 20 C 70 30, 58 41, 47 53" stroke="#B8937B" stroke-width="2" stroke-linecap="round" opacity="0.65"/>` +
          `<path d="M 43 50 L 56 63 L 50 70 L 36 56 Z" fill="url(#brushed-brass)" ${edge()}/>` +
          `<path d="M 40 53 L 53 66" stroke="${c}" stroke-width="2.5"/>` +
          `<path d="${left}" fill="url(#polished-steel)" ${edge(1.4)}/>` +
          `<path d="${right}" fill="url(#polished-steel)" ${edge(1.4)}/>` +
          `<path d="M 19 88 L 33 68" stroke="${c}" stroke-width="${down ? 3.4 : 2}" stroke-linecap="round"/>` +
          `<circle cx="34" cy="67" r="3" fill="${c}" stroke="${CONTOUR}" stroke-width="1.3"/>` +
          `<path d="M 19 88 L 25 78 L 28 81 Z" fill="${c}" opacity="0.85"/>`,
      )
    )
  },

  marker: (s, c) =>
    (s === 'down' ? `<path d="M 10 84 L 27 93 L 23 98 L 6 89 Z" fill="${c}" opacity="0.9"/>` : '') +
    droplet(s, c, 18, 86) +
    figure(
      s,
      [28, 78],
      `<path d="M 75 14 L 94 33 C 97 30, 97 24, 93 20 L 88 15 C 84 11, 78 11, 75 14 Z" fill="${c}" ${edge()}/>` +
        `<path d="M 75 14 L 94 33 L 54 73 L 35 54 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
        `<path d="M 76 21 L 41 56" stroke="#A88978" stroke-width="3" stroke-linecap="round" opacity="0.55"/>` +
        `<path d="M 64 25 L 83 44" stroke="${c}" stroke-width="5"/>` +
        `<path d="M 64 25 L 83 44" stroke="#FFFFFF" stroke-width="1.2" opacity="0.4"/>` +
        `<path d="M 35 54 L 54 73 L 40 81 L 27 68 Z" fill="url(#brushed-brass)" ${edge()}/>` +
        `<path d="${s === 'down' ? 'M 27 68 L 40 81 L 26 91 L 14 84 Z' : 'M 27 68 L 40 81 L 25 91 L 15 84 Z'}" fill="${c}" ${edge()}/>` +
        `<path d="M 27 68 L 16 84 L 24 89" fill="#FFFFFF" opacity="0.25"/>`,
    ),

  airbrush: (s, c) => {
    const down = s === 'down'
    const mist = down
      ? `<path d="M 28 74 L 2 84 L 14 102 Z" fill="${c}" opacity="0.22"/>` +
        [
          [20, 80, 2.6],
          [12, 85, 3.2],
          [19, 90, 2.8],
          [9, 94, 2.2],
          [15, 78, 2.2],
          [8, 88, 3],
          [16, 96, 2.5],
        ]
          .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
          .join('')
      : `<circle cx="19" cy="82" r="2" fill="${c}" opacity="0.85"/><circle cx="13" cy="87" r="2.5" fill="${c}" opacity="0.65"/><circle cx="20" cy="90" r="1.8" fill="${c}" opacity="0.75"/>`
    const trigger =
      `<g${down ? pose(55, 45, { tx: -2, ty: 4, rot: -8 }) : ''}>` +
      `<path d="M 52 36 L 58 42 L 53 47 L 47 41 Z" fill="url(#brushed-brass)" ${edge(1.4)}/>` +
      `<path d="M 46 31 C 50 27, 57 29, 61 33 C 64 36, 62 40, 58 39 L 48 35 Z" fill="url(#ochre-cap)" ${edge()}/></g>`
    return (
      mist +
      droplet(s, c, 18, 84) +
      figure(
        s,
        [35, 72],
        trigger +
          `<path d="M 72 22 C 77 17, 84 17, 89 22 C 94 27, 94 34, 89 39 L 71 57 L 54 40 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
          `<path d="M 75 26 L 59 42" stroke="#B8937B" stroke-width="2" stroke-linecap="round" opacity="0.6"/>` +
          `<path d="M 54 40 L 71 57 L 48 80 L 31 63 Z" fill="url(#brushed-brass)" ${edge()}/>` +
          `<circle cx="51" cy="60" r="6.5" fill="url(#glass-tube)" stroke="${CONTOUR}" stroke-width="1.4"/>` +
          `<path d="M 46 61 A 5.5 5.5 0 0 0 56 61 Z" fill="${c}"/>` +
          `<path d="M 31 63 L 48 80 L 28 77 L 26 75 Z" fill="url(#polished-steel)" ${edge()}/>` +
          `<circle cx="27" cy="76" r="2.2" fill="${c}"/>`,
      )
    )
  },

  // Not in the studio: a stick of chalk in a brass holder, with a tip worn in the pigment. Same materials, same lean.
  chalk: (s, c) =>
    (s === 'down'
      ? `<path d="M 10 90 Q 20 95 34 90" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>` +
        [
          [12, 84, 1.8],
          [17, 95, 2.2],
          [27, 94, 1.6],
          [8, 91, 1.4],
        ]
          .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.8"/>`)
          .join('')
      : '') +
    (s === 'up'
      ? `<g opacity="0.75" transform="translate(-4 -6)"><circle cx="16" cy="86" r="3" fill="#FDFBF7"/><circle cx="21" cy="81" r="2" fill="#FDFBF7"/><circle cx="12" cy="82" r="1.5" fill="#FDFBF7"/></g>`
      : '') +
    figure(
      s,
      [25, 82],
      `<path d="M 80 14 C 84 10, 90 10, 94 14 C 98 18, 98 24, 94 28 L 88 34 L 74 20 Z" fill="url(#ochre-cap)" ${edge()}/>` +
        `<path d="M 80 18 C 84 14.5, 88 14.5, 90.5 16" stroke="#FFF6D6" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>` +
        `<path d="M 74 20 L 88 34 L 54 68 L 40 54 Z" fill="url(#brushed-brass)" ${edge()}/>` +
        `<path d="M 54 40 L 68 54" stroke="${c}" stroke-width="2.6"/>` +
        `<path d="M 71 29 L 47 53" stroke="#FFF0B8" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>` +
        `<path d="M 43.4 57.4 L 50.6 64.6 L 26.6 88.6 L 19.4 81.4 Z" fill="url(#cream-bristle)" ${edge()}/>` +
        `<path d="M 29.4 71.4 L 36.6 78.6 L 26.6 88.6 C 24 91.2, 20.2 91.6, 18.2 89.4 C 16.6 87.6, 17.2 83.6, 19.4 81.4 Z" fill="${c}" opacity="0.92" ${edge(1.3)}/>` +
        `<path d="M 42 58 L 24 79" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
        `<circle cx="38" cy="63" r="0.9" fill="#B8A287"/><circle cx="33" cy="68" r="0.8" fill="#B8A287"/><circle cx="40" cy="60" r="0.7" fill="#B8A287"/>`,
    ),

  bucket: (s, c) => {
    const pot: Pose = s === 'down' ? { tx: 2, ty: 3, rot: -26 } : s === 'up' ? { tx: -2, ty: -3, rot: 10 } : {}
    const spill =
      s === 'down'
        ? `<path d="M 32 58 C 23 66, 20 77, 22 88" stroke="${c}" stroke-width="8" stroke-linecap="round"/>` +
          `<path d="M 31 58 C 24 66, 21 77, 23 87" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>` +
          `<ellipse cx="23" cy="89" rx="15" ry="6" fill="${c}" stroke="${CONTOUR}" stroke-width="1.3"/>` +
          `<ellipse cx="21" cy="88" rx="8" ry="2.5" fill="#FFFFFF" opacity="0.35"/>`
        : `<path d="M 27 66 C 27 66, 33 74, 33 79 C 33 82.5, 30.3 85, 27 85 C 23.7 85, 21 82.5, 21 79 C 21 74, 27 66, 27 66 Z" fill="${c}" ${edge()}/>` +
          `<circle cx="25" cy="78" r="1.6" fill="#FFFFFF" opacity="0.75"/>`
    return (
      spill +
      droplet(s, c, 25, 82) +
      figure(
        s,
        [54, 54],
        `<path d="M 48 28 C 60 12, 82 14, 84 32" stroke="url(#polished-steel)" stroke-width="2.5" stroke-linecap="round"/>` +
          `<rect x="63" y="14" width="14" height="6" rx="3" transform="rotate(15 63 14)" fill="url(#walnut-wood)" stroke="${CONTOUR}" stroke-width="1.3"/>` +
          `<path d="M 35 42 L 72 25 L 86 56 C 88 62, 85 69, 78 72 L 55 82 C 48 85, 41 82, 38 76 Z" fill="url(#copper-pot)" ${edge(1.6)}/>` +
          `<path d="M 46 44 L 58 74" stroke="#FCD5B8" stroke-width="3.5" stroke-linecap="round" opacity="0.45"/>` +
          `<ellipse cx="53.5" cy="33.5" rx="21" ry="7.5" transform="rotate(-24 53.5 33.5)" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
          `<ellipse cx="53.5" cy="34" rx="17.5" ry="5.2" transform="rotate(-24 53.5 34)" fill="${c}" stroke="${CONTOUR}" stroke-width="1.2"/>` +
          `<path d="M 42 37 C 48 33, 56 30, 64 29" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`,
        pot,
      )
    )
  },

  eraser: (s) =>
    (s === 'down'
      ? `<circle cx="14" cy="86" r="2.6" fill="#E57A64" stroke="${CONTOUR}" stroke-width="1.2"/>` +
        `<circle cx="22" cy="93" r="2" fill="#F2A493" stroke="${CONTOUR}" stroke-width="1.2"/>` +
        `<circle cx="33" cy="91" r="2.4" fill="#E57A64" stroke="${CONTOUR}" stroke-width="1.2"/>`
      : '') +
    figure(
      s,
      [32, 76],
      `<path d="M 64 18 L 88 42 C 91 45, 91 50, 88 53 L 76 65 L 48 37 L 60 18 C 61 17, 63 17, 64 18 Z" fill="url(#cream-bristle)" ${edge()}/>` +
        `<path d="M 44 33 L 76 65 L 57 84 L 25 52 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
        `<path d="M 41 36 L 73 68" stroke="url(#brushed-brass)" stroke-width="2.5"/>` +
        `<path d="M 29 48 L 61 80" stroke="url(#brushed-brass)" stroke-width="2.5"/>` +
        `<circle cx="52" cy="58" r="4.5" fill="url(#ochre-cap)" stroke="${CONTOUR}" stroke-width="1.2"/>` +
        `<path d="${
          s === 'down'
            ? 'M 25 52 L 57 84 L 41 92 C 34 95, 23 92, 16 85 C 12 80, 13 72, 17 66 Z'
            : 'M 25 52 L 57 84 L 42 94 C 36 97, 28 96, 22 90 L 16 84 C 11 79, 11 71, 15 65 Z'
        }" fill="#E3735E" ${edge()}/>` +
        `<path d="M 27 56 L 17 69 C 15 73, 16 78, 20 82" stroke="#F9B5A7" stroke-width="2" stroke-linecap="round" opacity="0.75"/>`,
    ),

  smudge: (s, c) =>
    (s === 'down'
      ? `<ellipse cx="21" cy="88" rx="16" ry="8" fill="${c}" opacity="0.32" filter="url(#soft)"/><ellipse cx="21" cy="88" rx="10" ry="4.5" fill="${c}" opacity="0.5"/>`
      : '') +
    figure(
      s,
      [26, 80],
      `<path d="M 78 14 C 82 11, 88 12, 92 16 C 96 20, 96 26, 92 30 L 82 40 L 68 26 Z" fill="url(#cream-bristle)" ${edge()}/>` +
        `<path d="M 68 26 L 82 40 L 44 78 L 30 64 Z" fill="url(#cream-bristle)" ${edge()}/>` +
        `<path d="M 62 32 L 74 48 M 52 42 L 64 58 M 42 52 L 54 68" stroke="#B8A287" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M 55 39 L 69 53 L 61 61 L 47 47 Z" fill="url(#walnut-cylinder)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 53 41 L 67 55" stroke="url(#brushed-brass)" stroke-width="2"/>` +
        `<path d="${s === 'down' ? 'M 30 64 L 44 78 L 14 91 L 17 85 Z' : 'M 30 64 L 44 78 L 18 90 Z'}" fill="url(#cedar-cone)" ${edge()}/>` +
        `<path d="M 24 72 L 35 83 L 18 90 Z" fill="${c}" stroke="${CONTOUR}" stroke-width="1.4" stroke-linejoin="round"/>`,
    ),

  eyedropper: (s, c) => {
    const down = s === 'down'
    const bulb = down
      ? 'M 64 28 C 70 24, 75 18, 82 14 C 86 11, 92 15, 89 20 C 85 27, 79 33, 76 40 Z'
      : 'M 63 27 L 77 13 C 83 8, 91 9, 95 14 C 99 19, 98 27, 92 33 L 78 43 Z'
    return (
      (down
        ? `<circle cx="19" cy="89" r="11" stroke="${c}" stroke-width="2.5" opacity="0.85"/><circle cx="19" cy="89" r="16" stroke="#FFFFFF" stroke-width="1.5" opacity="0.7"/>`
        : '') +
      droplet(s, c, 19, 89) +
      figure(
        s,
        [26, 82],
        `<path d="${bulb}" fill="url(#ochre-cap)" ${edge()}/>` +
          `<path d="M 72 22 C 78 16, 84 14, 88 16" stroke="#FFF4D4" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>` +
          `<path d="M 57 32 L 73 48 L 67 54 L 51 38 Z" fill="url(#brushed-brass)" ${edge()}/>` +
          `<path d="M 51 38 L 67 54 L 33 84 L 18 90 L 24 75 Z" fill="url(#glass-tube)" ${edge()}/>` +
          `<path d="${s === 'idle' ? 'M 28 70 L 37 79 L 18 90 L 24 75 Z' : 'M 44 46 L 58 60 L 32 83 L 18 90 L 24 75 Z'}" fill="${c}" opacity="0.9"/>` +
          (down
            ? `<circle cx="34" cy="74" r="2" fill="#FFFFFF" opacity="0.85"/><circle cx="42" cy="64" r="1.5" fill="#FFFFFF" opacity="0.85"/>`
            : '') +
          `<path d="M 53 43 L 26 75" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>` +
          `<path d="M 48 56 L 52 60 M 42 62 L 46 66 M 36 68 L 40 72" stroke="${CONTOUR}" stroke-width="1.2" stroke-linecap="round" opacity="0.65"/>`,
      )
    )
  },

  ruler: (s, c) =>
    (s === 'down'
      ? `<line x1="14" y1="92" x2="88" y2="18" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="20" cy="86" r="5" fill="${c}" stroke="#FFFFFF" stroke-width="1.5"/>`
      : '') +
    figure(
      s,
      [30, 78],
      `<path d="M 74 14 L 94 34 L 38 90 L 18 70 Z" fill="url(#rosewood-grad)" ${edge()}/>` +
        `<circle cx="58" cy="50" r="5" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.3"/>` +
        `<path d="M 74 14 L 80 20 L 24 76 L 18 70 Z" fill="url(#brushed-brass)" ${edge(1.4)}/>` +
        `<path d="M 68 20 L 72 24 M 61 27 L 64 30 M 54 34 L 59 39 M 47 41 L 50 44 M 40 48 L 45 53 M 33 55 L 36 58 M 26 62 L 31 67" stroke="${CONTOUR}" stroke-width="1.3" stroke-linecap="round"/>` +
        `<circle cx="22" cy="74" r="3.5" fill="${c}" stroke="${CONTOUR}" stroke-width="1.2"/>`,
    ),

  square: (s, c) =>
    (s === 'down'
      ? `<rect x="24" y="28" width="56" height="54" rx="2" stroke="${c}" stroke-width="2.5" stroke-dasharray="5 4" fill="${c}" fill-opacity="0.08"/>`
      : '') +
    figure(
      s,
      [26, 82],
      `<path d="M 22 20 H 38 V 84 H 22 Z" fill="url(#polished-steel)" ${edge()}/>` +
        `<path d="M 32 28 H 38 M 34 36 H 38 M 32 44 H 38 M 34 52 H 38 M 32 60 H 38" stroke="${CONTOUR}" stroke-width="1.3" stroke-linecap="round"/>` +
        `<path d="M 22 68 H 88 V 86 H 22 Z" fill="url(#walnut-wood)" ${edge()}/>` +
        `<path d="M 22 68 H 42 V 86 H 22 Z" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<circle cx="28" cy="74" r="2" fill="#23140D"/><circle cx="35" cy="74" r="2" fill="#23140D"/><circle cx="28" cy="81" r="2" fill="#23140D"/>` +
        `<circle cx="22" cy="86" r="4" fill="${c}" stroke="#FFFFFF" stroke-width="1.3"/>`,
    ),

  compass: (s, c) =>
    (s === 'down'
      ? `<path d="M 26 86 A 38 38 0 0 0 78 78" stroke="${c}" stroke-width="3" stroke-dasharray="5 3" stroke-linecap="round"/><circle cx="28" cy="86" r="4" fill="${c}"/>`
      : '') +
    figure(
      s,
      [28, 86],
      `<rect x="49" y="10" width="8" height="14" rx="2" fill="url(#ochre-cap)" stroke="${CONTOUR}" stroke-width="1.4"/>` +
        `<path d="M 51 24 L 56 26 L 34 74 L 28 72 Z" fill="url(#brushed-brass)" ${edge()}/>` +
        `<path d="M 31 73 L 28 87" stroke="url(#polished-steel)" stroke-width="2.6" stroke-linecap="round"/>` +
        `<g${s === 'down' ? pose(53, 25, { rot: -12 }) : ''}>` +
        `<path d="M 55 24 L 50 26 L 68 72 L 74 70 Z" fill="url(#brushed-brass)" ${edge()}/>` +
        `<rect x="66" y="66" width="10" height="7" rx="1.5" transform="rotate(-20 66 66)" fill="url(#walnut-wood)" stroke="${CONTOUR}" stroke-width="1.3"/>` +
        `<path d="M 71 71 L 76 84 L 70 84 Z" fill="${c}" ${edge(1.3)}/></g>` +
        `<line x1="36" y1="52" x2="68" y2="52" stroke="url(#polished-steel)" stroke-width="2.5"/>` +
        `<rect x="49" y="47" width="6" height="10" rx="2" fill="url(#ochre-cap)" stroke="${CONTOUR}" stroke-width="1.3"/>` +
        `<circle cx="53" cy="24" r="6" fill="url(#walnut-cylinder)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<circle cx="53" cy="24" r="2.5" fill="url(#brushed-brass)"/>`,
    ),

  hand: (s, c) => {
    const down = s === 'down'
    const palm = down
      ? `<path d="M 34 48 C 34 39, 41 36, 44 43 V 52 H 34 Z" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 44 46 C 44 37, 52 35, 54 42 V 52 H 44 Z" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 54 47 C 54 38, 62 37, 64 43 V 53 H 54 Z" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 64 50 C 64 42, 71 41, 73 47 V 56 H 64 Z" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 32 50 H 74 V 68 C 74 77, 66 83, 54 83 H 44 C 35 83, 30 76, 30 67 Z" fill="url(#beechwood-grad)" ${edge()}/>` +
        `<path d="M 26 58 C 26 52, 34 51, 46 54 C 49 55, 49 61, 44 62 L 29 63 Z" fill="url(#cedar-cone)" ${edge()}/>` +
        `<line x1="35" y1="45" x2="72" y2="47" stroke="#8F6339" stroke-width="1.4"/>`
      : `<rect x="35" y="21" width="8.5" height="29" rx="4.2" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<rect x="45" y="16" width="9" height="33" rx="4.5" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<rect x="55.5" y="20" width="8.5" height="29" rx="4.2" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<rect x="65.5" y="28" width="8" height="24" rx="4" fill="url(#beechwood-grad)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 35 31 H 43.5 M 45 27 H 54 M 55.5 30 H 64 M 65.5 37 H 73.5" stroke="#8F6339" stroke-width="1.4"/>` +
        `<path d="M 34 56 L 20 46 C 17 44, 15 48, 17 52 L 29 67 Z" fill="url(#beechwood-grad)" ${edge()}/>` +
        `<circle cx="29" cy="60" r="4.5" fill="url(#cedar-cone)" stroke="${CONTOUR}" stroke-width="1.3"/>` +
        `<path d="M 33 46 H 74 V 65 C 74 75, 65 82, 54 82 H 44 C 36 82, 31 76, 31 67 Z" fill="url(#beechwood-grad)" ${edge()}/>` +
        `<path d="M 40 52 C 48 50, 58 51, 65 55" stroke="#FFF5E6" stroke-width="2" stroke-linecap="round" opacity="0.65"/>`
    return figure(
      s,
      [54, 56],
      palm +
        `<rect x="40" y="81" width="27" height="8" rx="3" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 43 85 H 64" stroke="${c}" stroke-width="2.4"/>`,
      down ? { tx: 2, ty: 3, scale: 0.95 } : POSE[s],
    )
  },

  zoom: (s, c) => {
    const down = s === 'down'
    const mark = down ? c : CONTOUR
    return figure(
      s,
      [44, 44],
      `<path d="M 60 60 L 67 53 L 92 78 L 83 87 Z" fill="url(#walnut-cylinder)" ${edge()}/>` +
        `<path d="M 64 58 L 86 80" stroke="#B8937B" stroke-width="2" stroke-linecap="round" opacity="0.65"/>` +
        `<path d="M 92 78 C 96 82, 96 87, 92 91 C 88 95, 83 95, 79 91 L 83 87 Z" fill="url(#ochre-cap)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<path d="M 55 55 L 62 48 L 68 54 L 61 61 Z" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.5"/>` +
        `<circle cx="43" cy="43" r="25" fill="url(#brushed-brass)" stroke="${CONTOUR}" stroke-width="1.6"/>` +
        `<circle cx="43" cy="43" r="20.5" fill="url(#glass-tube)" stroke="${CONTOUR}" stroke-width="1.4"/>` +
        `<path d="M 28 34 A 16 16 0 0 1 48 27" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.9"/>` +
        `<path d="M 31 53 A 15 15 0 0 0 55 51" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>` +
        `<line x1="35" y1="43" x2="51" y2="43" stroke="${mark}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<line x1="43" y1="35" x2="43" y2="51" stroke="${mark}" stroke-width="2.4" stroke-linecap="round"/>`,
      down ? { tx: 2, ty: 3, scale: 1.12 } : POSE[s],
    )
  },
}

/** The stand-alone SVG of a tool in a state, in the given pigment. */
export function spriteSvg(kind: SpriteKind, state: SpriteState, pigment: SpritePigment): string {
  const body = TOOL[kind](state, spriteHex(pigment))
  const defs = [shadowFilter(state)]
  const used = new Set([...body.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]))
  for (const [id, markup] of Object.entries(MATERIALS)) if (used.has(id)) defs.push(markup)
  const [x, y, w, h] = SPRITE_VIEW
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" fill="none">` +
    `<defs>${defs.join('')}</defs>${body}</svg>`
  )
}
