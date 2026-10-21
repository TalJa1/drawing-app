/** Global SVG filters referenced by CSS/SVG across the app (url(#…)). */
export function SvgDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }} focusable="false">
      <defs>
        {/* organic watercolour edge */}
        <filter id="wash-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* rough brush edge */}
        <filter id="rough" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* splatter edges */}
        <filter id="splat" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* soft paper grain for generated paintings */}
        <filter id="canvas-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="g" />
          <feColorMatrix in="g" type="saturate" values="0" result="gs" />
          <feComponentTransfer in="gs" result="ga">
            <feFuncA type="table" tableValues="0 0.14" />
          </feComponentTransfer>
          <feComposite in="ga" in2="SourceGraphic" operator="in" result="gi" />
          <feBlend in="SourceGraphic" in2="gi" mode="multiply" />
        </filter>
        {/* brushy displacement for impressionist dabs */}
        <filter id="brushy" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="9" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="6" />
        </filter>
        <filter id="soft-blur">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="ink-bleed-f">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="2" result="n" />
          <feDisplacementMap in="b" in2="n" scale="10" />
        </filter>
      </defs>
    </svg>
  )
}

/** Fixed, very faint grain over the whole app. */
export function GrainOverlay() {
  return <div aria-hidden className="grain-overlay" />
}
