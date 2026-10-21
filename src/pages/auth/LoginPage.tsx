import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn } from 'lucide-react'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { TextField } from '@/components/Form'
import { Button } from '@/components/Button'
import { login } from '@/api/auth'
import { ApiError } from '@/api/client'
import { toast } from '@/store/ui'

const schema = z.object({
  email: z.string().trim().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
  password: z.string().min(6, 'auth.errors.passwordShort'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (data: Form) => {
    try {
      const { user } = await login(data)
      toast({ title: t('auth.welcomeBack', { name: user.displayName }), tone: 'success' })
      navigate('/collection')
    } catch (e) {
      setError('root', { message: e instanceof ApiError && e.status === 401 ? 'auth.errors.invalid' : 'common.errorGeneric' })
    }
  }

  return (
    <AuthLayout
      title={
        <>
          {t('auth.loginTitleA')} <em>{t('auth.loginTitleB')}</em>
        </>
      }
      lede={t('auth.loginLede')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
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
          autoComplete="current-password"
          {...register('password')}
          error={errors.password && t(errors.password.message!)}
        />
        {errors.root && (
          <p role="alert" className="text-sm text-accent-ink">
            {t(errors.root.message!)}
          </p>
        )}
        <Button type="submit" variant="pigment" size="lg" icon={<LogIn size={18} />} disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('nav.signIn')}
        </Button>
        <p className="text-center text-sm text-ink-soft">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="link-ink">
            {t('auth.createAccount')}
          </Link>
        </p>
        <p className="text-center text-sm text-ink-faint">
          <Link to="/" className="hover:text-ink">
            {t('auth.continueGuest')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
