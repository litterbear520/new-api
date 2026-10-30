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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { usd } from '@/features/bear-wallet/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { isDiscounted } from '@/lib/discount'

import {
  LoadingSkeleton,
  EmptyState,
  ModelCardGrid,
  PricingFilterBar,
} from './components'
import {
  EXCLUDED_GROUPS,
  FILTER_ALL,
  QUOTA_TYPES,
  SORT_OPTIONS,
} from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import type { PricingSearch } from './types'

export function Pricing() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const {
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    tagFilter,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setTagFilter,
    filteredModels,
    hasActiveFilters,
    clearFilters,
    clearSearch,
  } = useFilters(models || [])

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  // Carried to the details page, so its back link returns to the same view
  const linkSearch = useMemo<PricingSearch>(
    () => ({
      search: searchInput || undefined,
      sort: sortBy === SORT_OPTIONS.NAME ? undefined : sortBy,
      vendor: vendorFilter === FILTER_ALL ? undefined : vendorFilter,
      group: groupFilter === FILTER_ALL ? undefined : groupFilter,
      quotaType:
        quotaTypeFilter === QUOTA_TYPES.ALL ? undefined : quotaTypeFilter,
      tag: tagFilter === FILTER_ALL ? undefined : tagFilter,
    }),
    [searchInput, sortBy, vendorFilter, groupFilter, quotaTypeFilter, tagFilter]
  )

  // The site sells $1 of credit for `priceRate` yuan; say so when it is a deal
  const lead = isDiscounted(priceRate, usdExchangeRate)
    ? t('Charged at official USD prices. ¥1 buys {{credit}} of credit.', {
        credit: usd(1 / priceRate, locale),
      })
    : t(
        'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
      )

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-6xl px-4 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10'>
          <LoadingSkeleton viewMode='card' />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20 sm:pb-16'>
          <header className='mx-auto max-w-2xl pt-6 pb-8 text-center sm:pt-12 sm:pb-12'>
            <h1 className='text-[clamp(2rem,5vw,2.75rem)] leading-tight font-semibold tracking-tight'>
              {t('Model Square')}
            </h1>
            <p className='text-muted-foreground mt-3 text-sm sm:text-base'>
              {lead}
            </p>
          </header>

          <PricingFilterBar
            models={models || []}
            vendors={vendors || []}
            search={searchInput}
            onSearchChange={setSearchInput}
            onSearchClear={clearSearch}
            vendor={vendorFilter}
            onVendorChange={setVendorFilter}
            groups={availableGroups}
            groupRatios={groupRatio || {}}
            group={groupFilter}
            onGroupChange={setGroupFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            tag={tagFilter}
            onTagChange={setTagFilter}
            quotaType={quotaTypeFilter}
            onQuotaTypeChange={setQuotaTypeFilter}
          />

          <div className='mt-5'>
            {filteredModels.length === 0 ? (
              <EmptyState
                searchQuery={searchInput}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={() => {
                  clearFilters()
                  clearSearch()
                }}
              />
            ) : (
              <ModelCardGrid
                models={filteredModels}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
                selectedGroup={groupFilter}
                linkSearch={linkSearch}
              />
            )}
          </div>
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
