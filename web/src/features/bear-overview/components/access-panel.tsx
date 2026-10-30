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
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useApiAddressProbes } from '@/features/keys/hooks/use-api-address-probes'
import type { ApiAddressProbe } from '@/features/keys/lib/api-address-probe'
import { cn } from '@/lib/utils'

import { API_FORMATS, type ApiFormat } from '../constants'
import { useKeyCopy } from '../hooks/use-key-copy'
import { apiBaseUrl } from '../lib/access'
import { Segmented } from './segmented'

export interface ApiLine {
  url: string
  route: string
  description: string
}

function probeGrade(probe: ApiAddressProbe | undefined): string | undefined {
  if (!probe || probe.state === 'checking') return undefined
  return probe.state === 'reachable' ? probe.grade : 'unreachable'
}

/** API address by format, the key to paste and the line to use. */
export function AccessPanel(props: {
  lines: ApiLine[]
  line: string
  onLine: (url: string) => void
  format: ApiFormat
  onFormat: (format: ApiFormat) => void
  apiKey: { id: number; name: string; masked: string } | null
  folded: boolean
}) {
  const { t } = useTranslation()
  const linesLabel = useId()
  const [open, setOpen] = useState(false)
  const urls = useMemo(() => props.lines.map((line) => line.url), [props.lines])
  const { probes, start } = useApiAddressProbes(urls)
  const { copy, copiedId, busyId } = useKeyCopy()
  const checking = Object.values(probes).some(
    (probe) => probe.state === 'checking'
  )

  useEffect(() => {
    start()
  }, [start])

  const selected =
    props.lines.find((line) => line.url === props.line) ?? props.lines[0]
  const address = apiBaseUrl(selected?.url ?? '', props.format)
  const formatInfo =
    API_FORMATS.find((item) => item.id === props.format) ?? API_FORMATS[0]
  const probeLabel = (probe: ApiAddressProbe | undefined) => {
    if (!probe || probe.state === 'checking') return t('Testing...')
    if (probe.state === 'unreachable') return t('Unreachable')
    return `${probe.latency} ms`
  }
  const keyCopied = copiedId === 'key'

  const body: ReactNode = (
    <>
      <div className='bo-kv'>
        <div className='bo-lab'>
          {t('API address')}
          <Segmented
            className='bo-fmt'
            label={t('API format')}
            value={props.format}
            onChange={props.onFormat}
            options={API_FORMATS.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
          />
        </div>
        <div className='bo-field'>
          <span>{address}</span>
          <CopyButton
            value={address}
            size='icon'
            className='size-7'
            iconClassName='size-3.5'
            aria-label={t('Copy API URL')}
          />
        </div>
        <div className='bo-hint'>{t(formatInfo.hintKey)}</div>
      </div>

      <div className='bo-kv'>
        <div className='bo-lab'>
          {props.apiKey
            ? t('Key · {{name}} (last used)', { name: props.apiKey.name })
            : t('Key')}
        </div>
        {props.apiKey ? (
          <div className='bo-field'>
            <span>{props.apiKey.masked}</span>
            <Button
              variant='ghost'
              size='icon'
              className='size-7'
              disabled={busyId === 'key'}
              onClick={() =>
                void copy('key', props.apiKey?.id ?? null, (key) => key)
              }
              aria-label={keyCopied ? t('Copied') : t('Copy key')}
            >
              {keyCopied ? (
                <Check className='text-success size-3.5' />
              ) : (
                <Copy className='size-3.5' />
              )}
            </Button>
          </div>
        ) : (
          <div className='bo-field bo-field-empty'>
            <span>
              {t('No key yet.')} <Link to='/keys'>{t('Create API Key')}</Link>
            </span>
          </div>
        )}
      </div>

      <div className='bo-kv'>
        <div className='bo-lab' id={linesLabel}>
          {t('Line')}
          <span className='bo-lab-r'>
            {t('Latency from your network')}
            <Button
              variant='ghost'
              size='icon-xs'
              onClick={start}
              disabled={checking}
              aria-label={t('Refresh')}
              title={t('Refresh')}
            >
              <RefreshCw
                aria-hidden='true'
                className={cn(checking && 'animate-spin')}
              />
            </Button>
          </span>
        </div>
        <RadioGroup
          value={selected?.url ?? ''}
          onValueChange={(value) => props.onLine(String(value))}
          aria-labelledby={linesLabel}
          className='bo-lines'
        >
          {props.lines.map((line) => {
            const probe = probes[line.url]
            return (
              <label key={line.url} className='bo-ln'>
                <RadioGroupItem value={line.url} />
                <span className='bo-ln-nm'>{line.route}</span>
                <span className='bo-ms'>
                  <i data-grade={probeGrade(probe)} />
                  {probeLabel(probe)}
                </span>
              </label>
            )
          })}
        </RadioGroup>
        {selected?.description && (
          <div className='bo-hint'>{selected.description}</div>
        )}
      </div>
    </>
  )

  if (!props.folded) {
    return (
      <section className='bo-card bo-acc' aria-labelledby='bo-acc-title'>
        <h2 id='bo-acc-title'>{t('Connection details')}</h2>
        {body}
      </section>
    )
  }

  // Running low: paying comes first, so the details fold into one line.
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className='bo-card bo-acc bo-fold'
      data-open={open ? '' : undefined}
      render={<section />}
    >
      <h2 className='m-0'>
        <CollapsibleTrigger className='bo-fold-t'>
          <span>{t('Connection details')}</span>
          <span className='bo-fold-sum'>{address}</span>
          <ChevronDown aria-hidden='true' />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className='bo-fold-b'>{body}</CollapsibleContent>
    </Collapsible>
  )
}
