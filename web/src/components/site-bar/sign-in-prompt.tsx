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
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

const SECONDS = 5

type Target = { title: string; href: string }

/**
 * For a site link the admin keeps for signed-in readers (模型广场 can be):
 * a short notice, then the sign-in page, which comes back to the link.
 */
export function useSignInPrompt() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [target, setTarget] = useState<Target | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(SECONDS)

  useEffect(() => {
    if (!target) return
    const tick = window.setInterval(
      () => setSecondsLeft((s) => Math.max(s - 1, 0)),
      1000
    )
    const leave = window.setTimeout(() => {
      setTarget(null)
      void navigate({ to: '/sign-in', search: { redirect: target.href } })
    }, SECONDS * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(leave)
    }
  }, [target, navigate])

  const ask = (next: Target) => {
    setSecondsLeft(SECONDS)
    setTarget(next)
  }

  const dialog = (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) setTarget(null)
      }}
      title={t('Sign in required')}
      description={t('Please sign in to view {{module}}.', {
        module: target?.title || '',
      })}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      footer={
        <>
          <Button variant='outline' onClick={() => setTarget(null)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => {
              const redirect = target?.href || '/'
              setTarget(null)
              void navigate({ to: '/sign-in', search: { redirect } })
            }}
          >
            {t('Sign in now')}
          </Button>
        </>
      }
    >
      <div className='bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
        {t('Redirecting to sign in in {{seconds}} seconds.', {
          seconds: secondsLeft,
        })}
      </div>
    </Dialog>
  )

  return { ask, dialog }
}
