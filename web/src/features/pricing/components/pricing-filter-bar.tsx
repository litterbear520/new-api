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
import { ArrowUpDown, Check } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  FILTER_ALL,
  QUOTA_TYPES,
  QUOTA_TYPE_VALUES,
  SORT_OPTIONS,
  getQuotaTypeLabels,
  getSortLabels,
  type QuotaTypeOption,
  type SortOption,
} from '../constants'
import { getModelBillingType, parseTags } from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'
import { SearchBar } from './search-bar'

const REQUEST_SORTS = new Set<string>([
  SORT_OPTIONS.REQUEST_PRICE_LOW,
  SORT_OPTIONS.REQUEST_PRICE_HIGH,
])

export interface PricingFilterBarProps {
  models: PricingModel[]
  vendors: PricingVendor[]
  search: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  vendor: string
  onVendorChange: (value: string) => void
  /** Only shown when the viewer can use more than one group */
  groups: string[]
  groupRatios: Record<string, number>
  group: string
  onGroupChange: (value: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  /** Model tag, as the official sidebar filtered it; shown when models have tags */
  tag: string
  onTagChange: (value: string) => void
  /** Billing type (token / request / task); shown when models differ */
  quotaType: QuotaTypeOption
  onQuotaTypeChange: (value: QuotaTypeOption) => void
}

// Provider pills on a muted track: the picked one is raised, the rest are text
const SEGMENT =
  "text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground focus-visible:ring-ring h-8 gap-1.5 rounded-md px-3 font-normal transition-colors hover:bg-transparent focus-visible:ring-2 aria-pressed:font-medium aria-pressed:shadow-sm [&_svg:not([class*='size-'])]:size-3.5"

function SegmentLabel(props: {
  icon?: React.ReactNode
  label: string
  count: number
}) {
  return (
    <>
      {props.icon}
      {props.label}
      <span className='text-muted-foreground text-xs tabular-nums'>
        {props.count}
      </span>
    </>
  )
}

// Menu rows keep the check on the left, where the bar's menus always had it
const MENU_RADIO_ITEM =
  'group/item gap-2 pr-1.5 [&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden'

const BILLING_TYPES: QuotaTypeOption[] = [
  QUOTA_TYPES.TOKEN,
  QUOTA_TYPES.REQUEST,
  QUOTA_TYPES.TASK,
]

function MenuCheck() {
  return (
    <Check
      aria-hidden
      className='size-4 shrink-0 opacity-0 group-data-checked/item:opacity-100'
    />
  )
}

/**
 * One row above the cards: search, provider, then billing type, tag and
 * group (each when there is a choice) and sort
 */
export function PricingFilterBar(props: PricingFilterBarProps) {
  const { t } = useTranslation()
  const sortLabels = getSortLabels(t)
  const hasRequestModels = props.models.some(
    (model) => model.quota_type === QUOTA_TYPE_VALUES.REQUEST
  )
  const sortEntries = Object.entries(sortLabels).filter(
    ([value]) => hasRequestModels || !REQUEST_SORTS.has(value)
  )

  const vendorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      if (!model.vendor_name) continue
      counts.set(model.vendor_name, (counts.get(model.vendor_name) ?? 0) + 1)
    }
    return props.vendors
      .filter((vendor) => counts.has(vendor.name))
      .map((vendor) => ({ ...vendor, count: counts.get(vendor.name) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [props.models, props.vendors])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      for (const tag of new Set(
        parseTags(model.tags).map((tag) => tag.toLowerCase())
      )) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    // A tag picked from the URL stays listed so it can be cleared
    if (props.tag !== FILTER_ALL && !counts.has(props.tag.toLowerCase())) {
      counts.set(props.tag.toLowerCase(), 0)
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [props.models, props.tag])

  const quotaTypeLabels = getQuotaTypeLabels(t)
  const billingTypeCounts = useMemo(() => {
    const counts = new Map<QuotaTypeOption, number>()
    for (const model of props.models) {
      const type = getModelBillingType(model)
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return BILLING_TYPES.filter(
      (type) => counts.has(type) || type === props.quotaType
    ).map((type) => ({ type, count: counts.get(type) ?? 0 }))
  }, [props.models, props.quotaType])
  const showBillingTypes =
    billingTypeCounts.length > 1 || props.quotaType !== QUOTA_TYPES.ALL

  return (
    <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
      <SearchBar
        value={props.search}
        onChange={props.onSearchChange}
        onClear={props.onSearchClear}
        placeholder={t('Search models...')}
        className='lg:w-72 lg:shrink-0'
      />
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap'>
        {vendorCounts.length > 1 && (
          <ToggleGroup
            aria-label={t('Provider')}
            value={[props.vendor]}
            onValueChange={(values) => {
              // Pressing the picked provider again keeps it picked
              if (values[0]) props.onVendorChange(values[0])
            }}
            spacing={0.5}
            className='bg-muted/60 no-scrollbar min-w-0 basis-full overflow-x-auto p-0.5 sm:basis-auto'
          >
            <ToggleGroupItem value={FILTER_ALL} className={SEGMENT}>
              <SegmentLabel label={t('All')} count={props.models.length} />
            </ToggleGroupItem>
            {vendorCounts.map((vendor) => (
              <ToggleGroupItem
                key={vendor.id}
                value={vendor.name}
                className={SEGMENT}
              >
                <SegmentLabel
                  icon={vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined}
                  label={vendor.name}
                  count={vendor.count}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className='ms-auto flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:flex-nowrap'>
          {showBillingTypes && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9 gap-1.5 px-3'
                  />
                }
              >
                {props.quotaType === QUOTA_TYPES.ALL
                  ? t('All Types')
                  : quotaTypeLabels[props.quotaType]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuRadioGroup
                  value={props.quotaType}
                  onValueChange={(value: QuotaTypeOption) =>
                    props.onQuotaTypeChange(value)
                  }
                >
                  {[
                    { type: QUOTA_TYPES.ALL, count: props.models.length },
                    ...billingTypeCounts,
                  ].map((option) => (
                    <DropdownMenuRadioItem
                      key={option.type}
                      value={option.type}
                      closeOnClick
                      className={MENU_RADIO_ITEM}
                    >
                      <MenuCheck />
                      <span className='flex-1'>
                        {option.type === QUOTA_TYPES.ALL
                          ? t('All Types')
                          : quotaTypeLabels[option.type]}
                      </span>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        {option.count}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {tagCounts.length > 0 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9 max-w-40 gap-1.5 px-3'
                  />
                }
              >
                <span className='truncate'>
                  {props.tag === FILTER_ALL ? t('All Tags') : props.tag}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                className='max-h-80 w-48 overflow-y-auto'
              >
                <DropdownMenuRadioGroup
                  value={props.tag.toLowerCase()}
                  onValueChange={(value: string) => props.onTagChange(value)}
                >
                  {[
                    { tag: FILTER_ALL, count: props.models.length },
                    ...tagCounts,
                  ].map((option) => (
                    <DropdownMenuRadioItem
                      key={option.tag}
                      value={option.tag}
                      closeOnClick
                      className={MENU_RADIO_ITEM}
                    >
                      <MenuCheck />
                      <span className='min-w-0 flex-1 truncate'>
                        {option.tag === FILTER_ALL ? t('All Tags') : option.tag}
                      </span>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        {option.count}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {props.groups.length > 1 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9 gap-1.5 px-3'
                  />
                }
              >
                {props.group === FILTER_ALL
                  ? t('All Groups')
                  : `${props.group} ×${props.groupRatios[props.group] ?? 1}`}
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuRadioGroup
                  value={props.group}
                  onValueChange={(value: string) => props.onGroupChange(value)}
                >
                  {[FILTER_ALL, ...props.groups].map((group) => (
                    <DropdownMenuRadioItem
                      key={group}
                      value={group}
                      closeOnClick
                      className={MENU_RADIO_ITEM}
                    >
                      <MenuCheck />
                      <span className='flex-1'>
                        {group === FILTER_ALL ? t('All Groups') : group}
                      </span>
                      {group !== FILTER_ALL && (
                        <span className='text-muted-foreground text-xs tabular-nums'>
                          ×{props.groupRatios[group] ?? 1}
                        </span>
                      )}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-9 gap-1.5 px-3'
                />
              }
            >
              <ArrowUpDown className='size-3.5' />
              <span>{sortLabels[props.sortBy as SortOption] || t('Sort')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-48'>
              <DropdownMenuRadioGroup
                value={props.sortBy}
                onValueChange={(value: string) => props.onSortChange(value)}
              >
                {sortEntries.map(([value, label]) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    closeOnClick
                    className={MENU_RADIO_ITEM}
                  >
                    <MenuCheck />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
