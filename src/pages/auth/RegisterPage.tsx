import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { TextField } from '@/components/Form'
import { Button } from '@/components/Button'
import { register as registerUser } from '@/api/auth'
import { authErrorKey } from './authErrors'
import { toast } from '@/store/ui'

const schema = z
  .object({
    displayName: z.string().trim().min(2, 'auth.errors.nameShort').max(40, 'auth.errors.nameLong'),
    email: z.string().trim().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
    password: z.string().min(8, 'auth.errors.passwordShort8'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'auth.errors.mismatch', path: ['confirm'] })
type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { displayName: '', email: '', password: '', confirm: '' } })

  const onSubmit = async (form: Form) => {
    try {
      const { user } = await registerUser({ displayName: form.displayName, email: form.email, password: form.password })
      toast({ title: t('auth.welcome', { name: user.displayName }), description: t('auth.welcomeBody'), tone: 'gold' })
      navigate('/practice')
    } catch (e) {
      setError('root', { message: authErrorKey(e) })
    }
  }

  return (
    <AuthLayout
      title={
        <>
          {t('auth.registerTitleA')} <em>{t('auth.registerTitleB')}</em>
        </>
      }
      lede={t('auth.registerLede')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <TextField
          label={t('auth.displayName')}
          autoComplete="nickname"
          {...register('displayName')}
          error={errors.displayName && t(errors.displayName.message!)}
        />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email && t(errors.email.message!)}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          {...register('password')}
          error={errors.password && t(errors.password.message!)}
        />
        <TextField
          label={t('auth.confirm')}
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
          error={errors.confirm && t(errors.confirm.message!)}
        />
        {errors.root && (
          <p role="alert" className="text-sm text-accent-ink">
            {t(errors.root.message!)}
          </p>
        )}
        <Button type="submit" variant="pigment" size="lg" icon={<UserPlus size={18} />} disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('auth.createAccount')}
        </Button>
        <p className="text-center text-sm text-ink-soft">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="link-ink">
            {t('nav.signIn')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
