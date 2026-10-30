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
import { Bell } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import {
  chime,
  ensureAudio,
  notificationsSupported,
  readAlertPrefs,
  saveAlertPrefs,
} from '../lib/alerts'
import type { DrawAlertPrefs } from '../types'
import { Tip } from './tip'

/* 「画好了提醒我」: shared by every bell on the page. */
let prefs: DrawAlertPrefs | null = null
const listeners = new Set<() => void>()
const getPrefs = () => (prefs ??= readAlertPrefs())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
function setPrefs(next: DrawAlertPrefs) {
  prefs = next
  saveAlertPrefs(next)
  listeners.forEach((fn) => fn())
}

function useAlertPrefs() {
  return useSyncExternalStore(subscribe, getPrefs)
}

function BellPanel() {
  const { t } = useTranslation()
  const current = useAlertPrefs()

  const toggleNotify = async () => {
    if (current.notify) {
      setPrefs({ ...current, notify: false })
      return
    }
    if (!notificationsSupported()) {
      toast.error(t('This browser does not support system notifications'))
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission()
      } catch {
        perm = 'denied'
      }
    }
    if (perm === 'granted') setPrefs({ ...getPrefs(), notify: true })
    else {
      toast.error(
        t(
          'The browser did not allow notifications. You can turn them on in the site settings next to the address bar.'
        )
      )
    }
  }

  return (
    <div className='dw-bell-panel'>
      <div className='dw-bell-title'>{t('Remind me when ready')}</div>
      <p className='dw-bell-note'>
        {t(
          'Nothing interrupts you while this page is in front. When you are in another tab, the tab title and icon change to “ready” too.'
        )}
      </p>
      <label className='dw-swr'>
        <span className='dw-swr-tx'>
          <span>{t('System notification')}</span>
          <small>{t('The browser asks once when you turn it on')}</small>
        </span>
        <Switch
          checked={current.notify}
          onCheckedChange={() => void toggleNotify()}
        />
      </label>
      <div className='dw-swr'>
        <span className='dw-swr-tx'>
          <span>
            {t('Sound')}
            <button
              type='button'
              className='dw-try'
              onClick={() => {
                ensureAudio()
                chime(true)
              }}
            >
              {t('Play')}
            </button>
          </span>
          <small>{t('A very soft “ding”')}</small>
        </span>
        <Switch
          checked={current.sound}
          aria-label={t('Sound')}
          onCheckedChange={(on) => setPrefs({ ...getPrefs(), sound: on })}
        />
      </div>
    </div>
  )
}

/** The reminder bell: an icon next to the chat status, or a link on the canvas pill. */
export function BellPopover(props: { variant: 'icon' | 'link' }) {
  const { t } = useTranslation()
  const current = useAlertPrefs()
  const label = current.notify
    ? t('You will be notified when it is ready')
    : t('Remind me when ready')
  const trigger =
    props.variant === 'icon' ? (
      <Button
        variant='ghost'
        size='icon'
        className={cn('dw-bell', current.notify && 'dw-on')}
        aria-label={t('Remind me when ready')}
      >
        <Bell />
      </Button>
    ) : (
      <button type='button' className={cn('dw-bl', current.notify && 'dw-on')}>
        <Bell aria-hidden='true' />
        {label}
      </button>
    )

  return (
    <Popover onOpenChange={(open) => open && ensureAudio()}>
      {props.variant === 'icon' ? (
        <Tip label={label}>
          <PopoverTrigger render={trigger} />
        </Tip>
      ) : (
        <PopoverTrigger render={trigger} />
      )}
      <PopoverContent side='top' align='start' className='w-[300px] p-1.5'>
        <BellPanel />
      </PopoverContent>
    </Popover>
  )
}
