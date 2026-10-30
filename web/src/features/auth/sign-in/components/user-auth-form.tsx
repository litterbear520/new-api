/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { Loader2, KeyRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { FieldSeparator } from '@/components/ui/field'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, wechatLoginByCode } from '@/features/auth/api'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { loginFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import {
  requestPasskeyAssertion,
  rememberPasskeyRPID,
  type PasskeyDomains,
} from '@/features/auth/passkey/assertion'
import { PasskeyDomainSelector } from '@/features/auth/passkey/components/passkey-domain-selector'
import type { AuthFormProps } from '@/features/auth/types'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { isPasskeySupported as detectPasskeySupport } from '@/lib/passkey'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: AuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [step, setStep] = useState<'identifier' | 'password'>('identifier')
  const focusAfterStepChange = useRef(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [passkeyDomains, setPasskeyDomains] = useState<PasskeyDomains | null>(
    null
  )
  const [passkeyRPID, setPasskeyRPID] = useState<string>()
  const passkeyOperation = useRef<AbortController | null>(null)
  useEffect(() => () => passkeyOperation.current?.abort(), [])
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const loginFailedMessage = t('Login failed')

  const { status } = useStatus()
  const passkeyLoginEnabled = Boolean(
    status?.passkey_login ?? status?.data?.passkey_login
  )
  const passwordLoginEnabled =
    (status?.password_login_enabled ??
      status?.data?.password_login_enabled ??
      true) !== false
  const passwordLoginEncryptionEnabled =
    (status?.password_login_encryption_enabled ??
      status?.data?.password_login_encryption_enabled ??
      false) === true
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginResult } = useAuthRedirect()

  const passkeyButtonDisabled = isPasskeyLoading || !passkeySupported
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const hasOAuthLogin = Boolean(
    status?.github_oauth ||
    status?.discord_oauth ||
    status?.oidc_enabled ||
    status?.linuxdo_oauth ||
    status?.telegram_oauth ||
    (status?.custom_oauth_providers?.length ?? 0) > 0
  )
  const hasAlternativeLogin =
    passkeyLoginEnabled || hasWeChatLogin || hasOAuthLogin

  useEffect(() => {
    detectPasskeySupport()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })
  const identifier = form.watch('username').trim()

  // Move focus only after the user switches steps, never on the first render,
  // so phones do not pop the keyboard as soon as the page opens.
  useEffect(() => {
    if (!focusAfterStepChange.current) return
    focusAfterStepChange.current = false
    form.setFocus(step === 'password' ? 'password' : 'username')
  }, [form, step])

  async function continueToPassword() {
    if (!(await form.trigger('username'))) return
    form.setValue('username', identifier)
    focusAfterStepChange.current = true
    setStep('password')
  }

  function backToIdentifier() {
    form.setValue('password', '')
    form.clearErrors('password')
    focusAfterStepChange.current = true
    setStep('identifier')
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (step === 'identifier') {
      event.preventDefault()
      void continueToPassword()
      return
    }
    void form.handleSubmit(onSubmit)(event)
  }

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsLoading(true)
    try {
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: submittedTurnstileToken,
        passwordEncryptionEnabled: passwordLoginEncryptionEnabled,
      })

      if (res.success) {
        form.setValue('password', '')
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Welcome back!'))
        }
      } else {
        handleServerError(createServerError(res, loginFailedMessage))
      }
    } catch (error: unknown) {
      handleServerError(AuthOperationError.from(error, loginFailedMessage))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenWeChatDialog = () => {
    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success) {
        handleWeChatDialogChange(false)
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Signed in via WeChat'))
        }
      } else {
        handleServerError(createServerError(res, loginFailedMessage))
      }
    } catch (error: unknown) {
      handleServerError(
        new AuthOperationError(loginFailedMessage, undefined, { cause: error })
      )
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  async function handlePasskeyLogin() {
    if (!passkeySupported) {
      toast.error(t('Passkey is not supported on this device'))
      return
    }

    if (!navigator?.credentials) {
      toast.error(t('Passkey is not available in this browser'))
      return
    }

    if (passkeyOperation.current) return
    const controller = new AbortController()
    passkeyOperation.current = controller
    setIsPasskeyLoading(true)
    try {
      const passkey = await requestPasskeyAssertion(
        (rpID) => beginPasskeyLogin(rpID, controller.signal),
        controller.signal,
        { rpID: passkeyRPID, onDomains: setPasskeyDomains }
      )
      const finish = await finishPasskeyLogin(
        passkey.flowToken,
        passkey.assertion,
        controller.signal
      )
      controller.signal.throwIfAborted()
      if (!finish.success) {
        throw createServerError(finish, t('Failed to complete Passkey login'))
      }

      rememberPasskeyRPID(passkey.rpID)
      if (await handleLoginResult(finish.data, redirectTo)) {
        toast.success(t('Signed in with Passkey'))
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(t('Passkey login was cancelled or timed out'))
      } else if (error instanceof Error) {
        handleServerError(AuthOperationError.from(error))
      } else {
        handleServerError(
          AuthOperationError.from(error, t('Passkey login failed'))
        )
      }
    } finally {
      if (passkeyOperation.current === controller) {
        passkeyOperation.current = null
      }
      setIsPasskeyLoading(false)
    }
  }

  const alternativeLoginMethods = (
    <>
      {passkeyLoginEnabled && (
        <div className='flex flex-col gap-1'>
          <Button
            type='button'
            variant='outline'
            disabled={passkeyButtonDisabled}
            onClick={handlePasskeyLogin}
            className='relative h-11 w-full justify-center'
          >
            <span aria-hidden='true' className='absolute start-4 flex'>
              {isPasskeyLoading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <KeyRound className='h-4 w-4' />
              )}
            </span>
            {t('Sign in with Passkey')}
          </Button>
          <PasskeyDomainSelector
            domains={passkeyDomains}
            value={passkeyRPID}
            onChange={setPasskeyRPID}
            disabled={passkeyButtonDisabled}
          />
          {!passkeySupported && (
            <p className='text-muted-foreground text-xs'>
              {t('Passkey is not supported on this device.')}
            </p>
          )}
        </div>
      )}

      {/* OAuth Providers */}
      <OAuthProviders
        status={status}
        redirectTo={redirectTo}
        disabled={isLoading}
        onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
        isWeChatLoading={isWeChatSubmitting}
      />
    </>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={handleFormSubmit}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {hasAlternativeLogin && alternativeLoginMethods}

        {hasAlternativeLogin && passwordLoginEnabled && (
          <FieldSeparator className='my-1'>{t('or')}</FieldSeparator>
        )}

        {passwordLoginEnabled && step === 'identifier' && (
          <>
            <FormField
              control={form.control}
              name='username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>
                    {t('Username or Email')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='username'
                      placeholder={t('Enter your username or email')}
                      className='h-11'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type='submit'
              className='h-11 w-full justify-center'
              disabled={!identifier}
            >
              {t('Continue')}
            </Button>
          </>
        )}

        {passwordLoginEnabled && step === 'password' && (
          <>
            <div className='border-border bg-muted/40 flex h-11 items-center justify-between gap-2 rounded-lg border ps-3.5 pe-1 text-sm'>
              <span className='truncate'>{identifier}</span>
              <Button
                type='button'
                variant='link'
                className='h-9'
                onClick={backToIdentifier}
              >
                {t('Change')}
              </Button>
            </div>
            {/* Lets password managers pair the saved account with the password. */}
            <input
              type='text'
              name='username'
              value={identifier}
              autoComplete='username'
              readOnly
              tabIndex={-1}
              aria-hidden='true'
              className='sr-only'
            />

            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>{t('Password')}</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete='current-password'
                      placeholder={t('Enter password')}
                      className='[&_input]:h-11'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Link
              to='/forgot-password'
              className='text-muted-foreground -mt-2 justify-self-end text-sm hover:opacity-75'
            >
              {t('Forgot password?')}
            </Link>

            {isTurnstileEnabled && (
              <Turnstile
                key={turnstileWidgetKey}
                siteKey={turnstileSiteKey}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
              />
            )}

            <Button
              type='submit'
              className='h-11 w-full justify-center gap-2'
              disabled={isLoading}
            >
              {isLoading && <Loader2 className='animate-spin' />}
              {t('Sign in')}
            </Button>
          </>
        )}
      </form>

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
          )}
          contentClassName='max-w-sm'
          headerClassName='text-left'
          contentHeight='auto'
          bodyClassName='space-y-4'
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={isWeChatSubmitting || !wechatCode.trim()}
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
