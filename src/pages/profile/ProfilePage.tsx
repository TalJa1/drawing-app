import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dices, Download, LogIn, Sparkles, Trash2 } from 'lucide-react'
import { Page, SectionHeading } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Button, ButtonLink } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Select, Slider, Switch, TextField } from '@/components/Form'
import { XPBar } from '@/components/Gamification'
import { Highlight } from '@/components/art/Brush'
import { updateProfile } from '@/api/auth'
import { exportData, deleteAllData } from '@/api/account'
import { clearDemoData, isDemoActive, seedDemoData } from '@/api/demo'
import { queryClient } from '@/app/queryClient'
import { useSession } from '@/store/session'
import { useSettings, type DrawingPrefs, type MotionPref, type ThemePref } from '@/store/settings'
import { useCollection } from '@/store/collection'
import { useLearn } from '@/store/learn'
import { useStudio } from '@/store/studio'
import { toast } from '@/store/ui'
import { downloadBlob } from '@/lib/utils'
import { useLevel } from '@/features/gamification/hooks'
import { LESSONS, TRACKS } from '@/mocks/lessons'
import { useL } from '@/i18n/useL'
import { cn } from '@/lib/utils'

const AVATAR_SEEDS = ['ink-fox', 'saffron-sun', 'umber-owl', 'rose-koi', 'viridian-leaf', 'cerulean-sea', 'ochre-hill', 'ultramarine-night', 'lotus', 'lantern', 'mandala', 'charcoal']

export default function ProfilePage() {
  const { t } = useTranslation()
  const L = useL()
  const user = useSession((s) => s.user)
  const settings = useSettings()
  const { level, rank } = useLevel()
  const lessons = useLearn((s) => s.lessons)
  const demoOn = useCollection((s) => s.artworks.some((a) => a.demo))
  const [name, setName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio)
  const [seed, setSeed] = useState(user.avatarSeed)
  const [saving, setSaving] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ displayName: name.trim() || user.displayName, bio: bio.trim(), avatarSeed: seed })
      toast({ title: t('profile.saved'), tone: 'success' })
    } catch {
      toast({ title: t('common.errorGeneric'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleDemo = async (on: boolean) => {
    setDemoBusy(true)
    try {
      if (on && !isDemoActive()) await seedDemoData()
      if (!on) await clearDemoData()
      await queryClient.invalidateQueries()
      toast({ title: on ? t('profile.demoLoaded') : t('profile.demoCleared'), tone: 'success' })
    } finally {
      setDemoBusy(false)
    }
  }

  const doExport = async () => {
    const blob = await exportData()
    downloadBlob(blob, `art-spark-data-${new Date().toISOString().slice(0, 10)}.json`)
    toast({ title: t('profile.exported'), tone: 'success' })
  }

  const doDelete = async () => {
    await deleteAllData()
    await queryClient.invalidateQueries()
    setConfirmDelete(false)
    toast({ title: t('profile.deleted'), tone: 'info' })
  }

  const setDrawing = (p: Partial<DrawingPrefs>) => {
    settings.setDrawing(p)
    // keep the live studio in sync with the new defaults
    if (p.pressure !== undefined) useStudio.getState().set({ pressure: p.pressure })
    if (p.smoothing !== undefined) useStudio.getState().set({ smoothing: p.smoothing })
    if (p.defaultTool) useStudio.getState().setTool(p.defaultTool)
  }

  return (
    <Page>
      <div className="container-art">
        <SectionHeading
          index="07"
          eyebrow={t('profile.eyebrow')}
          title={
            <>
              {t('profile.titleA')} <Highlight>{t('profile.titleB')}</Highlight>
            </>
          }
          lede={t('profile.lede')}
        />

        {user.isGuest && (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-[22px] border border-saffron/50 bg-saffron/10 p-5 sm:flex-row sm:items-center">
            <Sparkles className="text-ochre" />
            <p className="flex-1 text-ink-soft">{t('profile.guestNudge')}</p>
            <ButtonLink to="/login" variant="ink" size="sm" icon={<LogIn size={16} />}>
              {t('nav.signIn')}
            </ButtonLink>
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* ---------- profile ---------- */}
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-5">
              <Avatar seed={seed} size={96} label={t('profile.avatar')} />
              <div>
                <p className="font-display text-3xl leading-tight">{name || user.displayName}</p>
                <p className="text-ink-faint">
                  {L(rank.name)} · {t('gamification.level', { level })}
                </p>
              </div>
            </div>
            <XPBar className="mt-6" />
            <fieldset className="mt-6">
              <legend className="text-sm font-medium">{t('profile.chooseAvatar')}</legend>
              <div className="mt-3 grid grid-cols-6 gap-2">
                {AVATAR_SEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={seed === s}
                    aria-label={t('profile.avatarOption', { name: s })}
                    onClick={() => setSeed(s)}
                    className={cn('rounded-full p-0.5 transition-transform hover:scale-105', seed === s ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : '')}
                  >
                    <Avatar seed={s} size={44} />
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="mt-2" icon={<Dices size={15} />} onClick={() => setSeed(`seed-${Math.random().toString(36).slice(2, 8)}`)}>
                {t('profile.randomAvatar')}
              </Button>
            </fieldset>
            <div className="mt-6 grid gap-4">
              <TextField label={t('profile.displayName')} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bio" className="text-sm font-medium">
                  {t('profile.bio')}
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  value={bio}
                  maxLength={160}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  className="rounded-2xl border border-line-strong bg-card px-4 py-3 text-ink placeholder:text-ink-faint/70 hover:border-ink/40 focus:border-ink"
                />
              </div>
              <Button variant="pigment" onClick={() => void save()} disabled={saving}>
                {saving ? t('common.loading') : t('profile.save')}
              </Button>
            </div>
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="font-display text-xl">{t('profile.learning')}</h2>
              <ul className="mt-3 space-y-3">
                {TRACKS.map((tr) => {
                  const done = tr.lessons.filter((s) => lessons[s]?.completed).length
                  return (
                    <li key={tr.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{t(`learn.tracks.${tr.id}.name`)}</span>
                        <span className="tabular-nums text-ink-faint">
                          {done}/{tr.lessons.length}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-paper-3">
                        <div className="h-full rounded-full bg-viridian" style={{ width: `${(done / tr.lessons.length) * 100}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-sm text-ink-faint">
                {t('profile.lessonsDone', { count: Object.values(lessons).filter((l) => l.completed).length, total: LESSONS.length })}{' '}
                <Link to="/learn" className="link-ink">
                  {t('nav.learn')}
                </Link>
              </p>
            </div>
          </Card>

          {/* ---------- settings ---------- */}
          <div id="settings" className="scroll-mt-28 space-y-6">
            <Card className="space-y-5 p-6 sm:p-8">
              <h2 className="font-display text-2xl">{t('profile.appearance')}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select label={t('profile.language')} value={settings.language} onChange={(e) => settings.setLanguage(e.target.value as 'en' | 'vi')}>
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </Select>
                <Select label={t('profile.theme')} value={settings.theme} onChange={(e) => settings.setTheme(e.target.value as ThemePref)}>
                  <option value="system">{t('profile.themes.system')}</option>
                  <option value="light">{t('profile.themes.light')}</option>
                  <option value="dark">{t('profile.themes.dark')}</option>
                </Select>
                <Select label={t('profile.motion')} value={settings.motion} onChange={(e) => settings.setMotion(e.target.value as MotionPref)}>
                  <option value="system">{t('profile.motions.system')}</option>
                  <option value="reduce">{t('profile.motions.reduce')}</option>
                  <option value="full">{t('profile.motions.full')}</option>
                </Select>
              </div>
              <Switch checked={settings.sound} onChange={settings.setSound} label={t('profile.sound')} description={t('profile.soundHint')} />
              <Switch checked={settings.customCursor} onChange={settings.setCustomCursor} label={t('profile.cursor')} description={t('profile.cursorHint')} />
            </Card>

            <Card className="space-y-5 p-6 sm:p-8">
              <h2 className="font-display text-2xl">{t('profile.drawing')}</h2>
              <Select label={t('profile.defaultBrush')} value={settings.drawing.defaultTool} onChange={(e) => setDrawing({ defaultTool: e.target.value as DrawingPrefs['defaultTool'] })}>
                {(['pencil', 'pen', 'marker', 'watercolour'] as const).map((tool) => (
                  <option key={tool} value={tool}>
                    {t(`studio.tools.${tool}`)}
                  </option>
                ))}
              </Select>
              <Switch checked={settings.drawing.pressure} onChange={(v) => setDrawing({ pressure: v })} label={t('studio.pressure')} description={t('profile.pressureHint')} />
              <Slider label={t('studio.smoothing')} value={settings.drawing.smoothing} min={0} max={1} step={0.05} onChange={(v) => setDrawing({ smoothing: v })} format={(v) => `${Math.round(v * 100)}%`} />
              <Switch
                checked={!settings.onboardingDone}
                onChange={(v) => settings.setOnboardingDone(!v)}
                label={t('profile.tour')}
                description={t('profile.tourHint')}
              />
            </Card>

            <Card className="space-y-5 p-6 sm:p-8">
              <h2 className="font-display text-2xl">{t('profile.data')}</h2>
              <Switch checked={demoOn} onChange={(v) => void toggleDemo(v)} label={t('profile.demo')} description={demoBusy ? t('common.loading') : t('profile.demoHint')} />
              <Switch checked={settings.simulateErrors} onChange={settings.setSimulateErrors} label={t('profile.simulateErrors')} description={t('profile.simulateErrorsHint')} />
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" icon={<Download size={16} />} onClick={() => void doExport()}>
                  {t('profile.export')}
                </Button>
                <Button variant="ghost" icon={<Trash2 size={16} />} className="text-accent-ink" onClick={() => setConfirmDelete(true)}>
                  {t('profile.deleteAll')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('profile.deleteTitle')} description={t('profile.deleteBody')} size="sm">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="pigment" className="flex-1" onClick={() => void doDelete()}>
            {t('profile.deleteConfirm')}
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
