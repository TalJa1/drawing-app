import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useStudio } from '@/store/studio'
import { Tooltip } from '@/components/Tooltip'
import { TOOLS } from '../tools'

/** Vertical tool rail (desktop) / horizontal dock (mobile). */
export function ToolRail({ orientation = 'vertical', className }: { orientation?: 'vertical' | 'horizontal'; className?: string }) {
  const { t } = useTranslation()
  const tool = useStudio((s) => s.tool)
  const color = useStudio((s) => s.color)
  const setTool = useStudio((s) => s.setTool)
  const vertical = orientation === 'vertical'

  return (
    <div
      role="toolbar"
      aria-label={t('studio.toolsLabel')}
      aria-orientation={orientation}
      className={cn(
        'paper flex items-center gap-1 border border-line shadow-lift',
        vertical ? 'flex-col rounded-[22px] p-1.5' : 'no-scrollbar overflow-x-auto rounded-[20px] p-1.5',
        className,
      )}
      data-tour="tools"
    >
      {TOOLS.map((def, i) => {
        const sep = i > 0 && TOOLS[i - 1].group !== def.group
        const active = tool === def.id
        const btn = (
          <button
            type="button"
            aria-label={t(`studio.tools.${def.id}`)}
            aria-pressed={active}
            onClick={() => setTool(def.id)}
            className={cn(
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
              active ? 'text-paper' : 'text-ink-soft hover:bg-ink/[0.06] hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tool-active-${orientation}`}
                className="absolute inset-0 rounded-2xl bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <def.icon size={19} className="relative" strokeWidth={active ? 2.2 : 1.8} />
            {active && ['pencil', 'pen', 'marker', 'watercolour', 'airbrush', 'chalk', 'bucket', 'line', 'rect', 'ellipse'].includes(def.id) && (
              <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-paper" style={{ background: color }} />
            )}
          </button>
        )
        return (
          <div key={def.id} className={cn('flex shrink-0', vertical ? 'flex-col items-center' : 'items-center')}>
            {sep && <span aria-hidden className={cn('bg-line', vertical ? 'my-1 h-px w-6' : 'mx-1 h-6 w-px')} />}
            {vertical ? (
              <Tooltip label={t(`studio.tools.${def.id}`)} shortcut={def.shortcut} side="right">
                {btn}
              </Tooltip>
            ) : (
              btn
            )}
          </div>
        )
      })}
    </div>
  )
}
