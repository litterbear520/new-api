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
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { getApiKeys, searchApiKeys } from '@/features/keys/api'
import { useDebounce } from '@/hooks/use-debounce'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { isImeKeyEvent } from '../lib/ime'

const SEARCH_DELAY = 300
// The server only matches part of a name with a wildcard of 2+ characters.
const MIN_SERVER_SEARCH = 2

/** A list entry; `value` is the key name, '' for all keys. */
type KeyOption = { value: string; label: string }

function keyNames(items: ReadonlyArray<{ name?: string | null }> = []) {
  return items
    .map((key) => key.name)
    .filter((name): name is string => Boolean(name))
}

/**
 * Own key names that contain the term. Names are exact by default; `%term%`
 * matches part of a name unless the user has more keys than the server
 * allows fuzzy search for, then only the exact name is looked up.
 */
async function searchKeyNames(term: string): Promise<string[]> {
  const fuzzy = await searchApiKeys({ keyword: `%${term}%`, p: 1, size: 100 })
  if (fuzzy.success) return keyNames(fuzzy.data?.items)
  const exact = await searchApiKeys({ keyword: term, p: 1, size: 100 })
  return exact.success ? keyNames(exact.data?.items) : []
}

interface LogsKeyFilterProps {
  /** The applied key name, from the URL. */
  value: string
  onChange: (value: string | undefined) => void
  /** Masks the names while sensitive data is hidden. */
  maskedClassName?: string
}

/**
 * The key filter of the logs toolbar: a list of the user's keys that also
 * takes any typed name, so administrators can filter by other users' keys
 * and users with many keys can search for theirs. The trigger looks like the
 * toolbar's selects; the search field sits in the popup.
 */
export function LogsKeyFilter(props: LogsKeyFilterProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const term = search.trim()
  const serverTerm = useDebounce(term.replaceAll('%', ''), SEARCH_DELAY)

  const { data: firstPage } = useQuery({
    queryKey: ['usage-logs-key-options'],
    queryFn: async () =>
      requireServerSuccess(await getApiKeys({ p: 1, size: 100 })),
  })
  const { data: found } = useQuery({
    queryKey: ['usage-logs-key-search', serverTerm],
    queryFn: () => searchKeyNames(serverTerm),
    enabled: open && serverTerm.length >= MIN_SERVER_SEARCH,
    meta: { errorToast: false },
  })

  // Filtered here rather than by the combobox, which cannot add the typed
  // name as an entry of its own.
  const options = useMemo<KeyOption[]>(() => {
    const all = new Set([
      ...keyNames(firstPage?.data?.items),
      ...(serverTerm.length >= MIN_SERVER_SEARCH ? (found ?? []) : []),
    ])
    if (props.value) all.add(props.value)
    const needle = term.toLowerCase()
    const names = [...all]
      .filter((name) => name.toLowerCase().includes(needle))
      // An exact match goes first, so Enter picks it.
      .sort((a, b) => Number(b === term) - Number(a === term))
      .map((name) => ({ value: name, label: name }))
    if (!term) return [{ value: '', label: t('All keys') }, ...names]
    if (names.some((option) => option.value === term)) return names
    return [
      { value: term, label: t('Filter by "{{name}}"', { name: term }) },
      ...names,
    ]
  }, [firstPage, found, serverTerm, props.value, term, t])
  const selected =
    options.find((option) => option.value === props.value) ??
    ({ value: props.value, label: props.value } satisfies KeyOption)
  const valueLabel = props.value || t('All keys')

  return (
    <Combobox
      items={options}
      filter={null}
      autoHighlight
      value={selected}
      isItemEqualToValue={(item: KeyOption, value: KeyOption) =>
        item.value === value.value
      }
      onValueChange={(option: KeyOption | null) => {
        if (option) props.onChange(option.value || undefined)
        setOpen(false)
      }}
      inputValue={search}
      onInputValueChange={(value, details) => {
        if (details.reason === 'input-change') setSearch(value)
      }}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <ComboboxTrigger
        aria-label={`${t('API Key')}: ${valueLabel}`}
        // Drawn like the toolbar's SelectTrigger. ComboboxTrigger always
        // appends its own down arrow and takes no icon, so that arrow is
        // hidden and the select's up-down icon drawn instead.
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-fit max-w-44 min-w-0 items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:last-child]:hidden",
          props.maskedClassName
        )}
      >
        <KeyRound className='text-muted-foreground' />
        <span className='min-w-0 truncate'>{valueLabel}</span>
        <HugeiconsIcon
          icon={UnfoldMoreIcon}
          strokeWidth={2}
          className='text-muted-foreground size-4'
        />
      </ComboboxTrigger>
      <ComboboxContent
        className={cn('w-64 max-w-[calc(100vw-2rem)]', props.maskedClassName)}
      >
        <ComboboxInput
          showTrigger={false}
          aria-label={t('API Key')}
          placeholder={t('Search or type a key name')}
          onKeyDown={(e) => {
            // Base UI only skips keyCode 229; Chrome flags the Enter that
            // picks an IME candidate with isComposing instead.
            if (e.key === 'Enter' && isImeKeyEvent(e)) e.preventBaseUIHandler()
          }}
        />
        <ComboboxList>
          {(option: KeyOption) => (
            <ComboboxItem key={option.value || 'all-keys'} value={option}>
              <span className='min-w-0 [overflow-wrap:anywhere]'>
                {option.label}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
