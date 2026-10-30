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
import { ChevronDown, Globe, Plus, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { useApiAddressProbes } from '../hooks/use-api-address-probes'
import type { ApiAddressGrade, ApiAddressProbe } from '../lib/api-address-probe'
import { useApiKeys } from './api-keys-provider'

type ProbeTone = ApiAddressGrade | 'checking' | 'unreachable'

const PROBE_TONE_STYLES: Record<
  ProbeTone,
  { dot: string; text: string; border: string }
> = {
  checking: {
    dot: 'bg-muted-foreground/40 animate-pulse',
    text: 'text-muted-foreground',
    border: '',
  },
  excellent: {
    dot: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500/40',
  },
  good: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/40',
  },
  slow: {
    dot: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/40',
  },
  unreachable: {
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/40',
  },
}

function getProbeTone(probe: ApiAddressProbe | undefined): ProbeTone | null {
  if (!probe) return null
  if (probe.state === 'reachable') return probe.grade
  return probe.state
}

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  const { status, loading } = useStatus()
  const { items } = useApiInfo()
  const listRef = useRef<HTMLDivElement>(null)
  const serverAddress =
    (typeof status?.server_address === 'string' &&
      status.server_address.trim()) ||
    ''
  const addresses = items.length
    ? items
    : [
        {
          url: serverAddress || window.location.origin,
          route: serverAddress ? t('Default API address') : t('Current domain'),
          description: '',
        },
      ]
  const { probes, start, stop } = useApiAddressProbes(
    addresses.map((address) => address.url)
  )
  const checking = Object.values(probes).some(
    (probe) => probe.state === 'checking'
  )

  const getProbeLabel = (probe: ApiAddressProbe) => {
    if (probe.state === 'checking') return t('Testing...')
    if (probe.state === 'unreachable') return t('Unreachable')
    const grade = {
      excellent: t('Excellent'),
      good: t('Good'),
      slow: t('Slow'),
    }[probe.grade]
    return `${grade} · ${probe.latency} ms`
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Popover
        onOpenChange={(open) => {
          if (open) start()
          else stop()
        }}
      >
        <PopoverTrigger render={<Button variant='outline' size='sm' />}>
          <Globe aria-hidden='true' />
          {t('API Addresses')}
          <ChevronDown aria-hidden='true' />
        </PopoverTrigger>
        <PopoverContent
          align='end'
          className='max-h-[min(28rem,var(--available-height))] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto'
          initialFocus={() =>
            listRef.current?.querySelector<HTMLElement>('button') ?? true
          }
        >
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 flex-col gap-0.5'>
              <PopoverTitle>{t('API Addresses')}</PopoverTitle>
              <PopoverDescription className='text-xs'>
                {t('Latency measured from your current network')}
              </PopoverDescription>
            </div>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={start}
              disabled={loading || checking}
              aria-label={t('Refresh')}
              title={t('Refresh')}
            >
              <RefreshCw
                aria-hidden='true'
                className={cn(checking && 'animate-spin')}
              />
            </Button>
          </div>
          {loading ? (
            <LoadingState inline size='sm' message={t('Loading...')} />
          ) : (
            <ItemGroup ref={listRef}>
              {addresses.map((address) => {
                const probe = probes[address.url]
                const tone = getProbeTone(probe)
                const toneStyles = tone ? PROBE_TONE_STYLES[tone] : null
                return (
                  <Item
                    key={address.url}
                    role='listitem'
                    variant='muted'
                    size='xs'
                    className={cn(
                      'flex-nowrap items-start',
                      toneStyles?.border
                    )}
                  >
                    <ItemContent className='min-w-0 gap-1'>
                      <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                        {toneStyles && (
                          <span
                            aria-hidden='true'
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              toneStyles.dot
                            )}
                          />
                        )}
                        <ItemTitle className='line-clamp-none break-all'>
                          {address.route}
                        </ItemTitle>
                        {probe && toneStyles && (
                          <span
                            className={cn(
                              'text-xs font-medium whitespace-nowrap tabular-nums',
                              toneStyles.text
                            )}
                          >
                            {getProbeLabel(probe)}
                          </span>
                        )}
                      </div>
                      <code className='text-xs break-all select-text'>
                        {address.url}
                      </code>
                      {address.description && (
                        <ItemDescription className='line-clamp-none break-words'>
                          {address.description}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    <ItemActions>
                      <CopyButton
                        value={address.url}
                        size='sm'
                        tooltip={t('Copy API URL')}
                        aria-label={`${t('Copy API URL')}: ${address.url}`}
                      />
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </PopoverContent>
      </Popover>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus className='h-4 w-4' />
        {t('Create API Key')}
      </Button>
    </div>
  )
}
