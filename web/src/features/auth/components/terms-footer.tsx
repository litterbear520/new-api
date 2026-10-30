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
import { Trans, useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

// Whole sentences per case, so each locale can order the links naturally.
const NOTICE_KEYS = {
  'sign-in': {
    both: 'By continuing, you agree to the {{systemName}} <terms>User Agreement</terms> and <privacy>Privacy Policy</privacy>.',
    terms:
      'By continuing, you agree to the {{systemName}} <terms>User Agreement</terms>.',
    privacy:
      'By continuing, you agree to the {{systemName}} <privacy>Privacy Policy</privacy>.',
  },
  'sign-up': {
    both: 'By signing up, you agree to the {{systemName}} <terms>User Agreement</terms> and <privacy>Privacy Policy</privacy>.',
    terms:
      'By signing up, you agree to the {{systemName}} <terms>User Agreement</terms>.',
    privacy:
      'By signing up, you agree to the {{systemName}} <privacy>Privacy Policy</privacy>.',
  },
} as const

const linkClassName = 'hover:text-foreground underline underline-offset-4'

/** Passive legal notice: continuing means agreeing, no checkbox needed. */
export function TermsFooter(props: TermsFooterProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const keys = NOTICE_KEYS[props.variant ?? 'sign-in']
  const hasUserAgreement = Boolean(props.status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(props.status?.privacy_policy_enabled)

  let i18nKey: string
  if (hasUserAgreement && hasPrivacyPolicy) {
    i18nKey = keys.both
  } else if (hasUserAgreement) {
    i18nKey = keys.terms
  } else if (hasPrivacyPolicy) {
    i18nKey = keys.privacy
  } else {
    return null
  }

  return (
    <p
      className={cn(
        'text-muted-foreground text-center text-xs leading-5',
        props.className
      )}
    >
      <Trans
        t={t}
        i18nKey={i18nKey}
        values={{ systemName }}
        components={{
          terms: <a href='/user-agreement' className={linkClassName} />,
          privacy: <a href='/privacy-policy' className={linkClassName} />,
        }}
      />
    </p>
  )
}
