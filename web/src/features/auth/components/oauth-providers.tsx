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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  IconDiscord,
  IconGithub,
  IconGoogle,
  IconLinuxDo,
  IconTelegram,
  IconWeChat,
} from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useOAuthLogin } from '../hooks/use-oauth-login'
import { getMainLine } from '../lib/main-line'
import type { SystemStatus } from '../types'

type OAuthProvidersProps = {
  status: SystemStatus | null
  disabled?: boolean
  className?: string
  onWeChatLogin?: () => void
  isWeChatLoading?: boolean
  redirectTo?: string
}

type ProviderButton = {
  key: string
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  /** The provider redirects back to a callback registered on the main line */
  usesCallback: boolean
}

export function OAuthProviders({
  status,
  disabled = false,
  className,
  onWeChatLogin,
  isWeChatLoading = false,
  redirectTo,
}: OAuthProvidersProps) {
  const { t } = useTranslation()
  const {
    isLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleCustomOAuthLogin,
  } = useOAuthLogin(status, redirectTo)

  const providerButtons: ProviderButton[] = []

  if (status?.wechat_login && onWeChatLogin) {
    providerButtons.push({
      key: 'wechat',
      label: t('Continue with WeChat'),
      onClick: onWeChatLogin,
      icon: <IconWeChat className='h-4 w-4' />,
      disabled: isWeChatLoading,
      usesCallback: false,
    })
  }

  if (status?.github_oauth) {
    providerButtons.push({
      key: 'github',
      label: githubButtonText || t('Continue with GitHub'),
      onClick: handleGitHubLogin,
      icon: <IconGithub className='h-4 w-4' />,
      disabled: githubButtonDisabled,
      usesCallback: true,
    })
  }

  if (status?.discord_oauth) {
    providerButtons.push({
      key: 'discord',
      label: t('Continue with Discord'),
      onClick: handleDiscordLogin,
      icon: <IconDiscord className='h-4 w-4' />,
      usesCallback: true,
    })
  }

  if (status?.oidc_enabled) {
    const oidcDisplayName = status.oidc_display_name?.trim() || 'OIDC'
    providerButtons.push({
      key: 'oidc',
      label: t('Continue with {{name}}', {
        name: oidcDisplayName,
      }),
      onClick: handleOIDCLogin,
      icon:
        oidcDisplayName.toLowerCase() === 'google' ? <IconGoogle /> : undefined,
      usesCallback: true,
    })
  }

  if (status?.linuxdo_oauth) {
    providerButtons.push({
      key: 'linuxdo',
      label: t('Continue with LinuxDO'),
      onClick: handleLinuxDOLogin,
      icon: <IconLinuxDo className='h-4 w-4' />,
      usesCallback: true,
    })
  }

  if (status?.telegram_oauth) {
    providerButtons.push({
      key: 'telegram',
      label: t('Continue with Telegram'),
      onClick: handleTelegramLogin,
      icon: <IconTelegram data-icon='inline-start' />,
      usesCallback: true,
    })
  }

  // Custom OAuth providers
  const customProviders = status?.custom_oauth_providers
  if (customProviders && customProviders.length > 0) {
    for (const provider of customProviders) {
      providerButtons.push({
        key: `custom-${provider.slug}`,
        label: t('Continue with {{name}}', { name: provider.name }),
        onClick: () => handleCustomOAuthLogin(provider),
        usesCallback: true,
      })
    }
  }

  if (providerButtons.length === 0) return null

  const mainLine = getMainLine(
    status?.server_address,
    window.location.origin,
    redirectTo
  )
  const sendsToMainLine =
    mainLine !== null && providerButtons.some((p) => p.usesCallback)
  const buttonClassName = 'relative h-11 w-full justify-center'

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {providerButtons.map((provider) => {
        // Icons sit at a fixed inline-start so labels stay centered and aligned.
        const icon = provider.icon && (
          <span aria-hidden='true' className='absolute start-4 flex'>
            {provider.icon}
          </span>
        )
        if (mainLine && provider.usesCallback) {
          return (
            <Button
              key={provider.key}
              role='link'
              variant='outline'
              className={buttonClassName}
              render={<a href={mainLine.signInUrl} />}
            >
              {icon}
              {provider.label}
            </Button>
          )
        }
        return (
          <Button
            key={provider.key}
            variant='outline'
            type='button'
            disabled={disabled || isLoading || provider.disabled}
            onClick={provider.onClick}
            className={buttonClassName}
          >
            {icon}
            {provider.label}
          </Button>
        )
      })}
      {sendsToMainLine && (
        <p className='text-muted-foreground text-center text-xs'>
          {t('Third-party sign-in continues on {{host}}', {
            host: mainLine.host,
          })}
        </p>
      )}
    </div>
  )
}
