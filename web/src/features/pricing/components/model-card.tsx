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
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'
import { isDiscounted } from '@/lib/discount'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getCardExamplePrice,
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isDynamicPricingModel,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { getDisplayGroupRatio, isTokenBasedModel } from '../lib/model-helpers'
import {
  calculateTokenPrice,
  formatPrice,
  formatRequestPrice,
} from '../lib/price'
import { taskPriceLabel, taskUsageUnitLabel } from '../lib/task-price-display'
import { formatYuan } from '../lib/tools'
import type {
  ModelPerfData,
  PricingModel,
  PricingSearch,
  PriceType,
} from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelStatusBar } from './model-status-bar'
import { ModelTools } from './model-tools'

export interface ModelCardProps {
  model: PricingModel
  priceRate?: number
  usdExchangeRate?: number
  selectedGroup?: string
  perf?: ModelPerfData
  /** List filters, carried to the details page so 「返回」 keeps them */
  linkSearch?: PricingSearch
}

/** One price: list price in USD, and what it costs in yuan after top-up */
function PriceCell(props: {
  label: ReactNode
  value: ReactNode
  unit: string
  yuan?: string | null
  wide?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', props.wide && 'col-span-full')}>
      {props.label && (
        <span className='text-muted-foreground text-xs break-words'>
          {props.label}
        </span>
      )}
      <span className='mt-1 flex flex-wrap items-baseline gap-x-1 font-mono text-[15px] font-semibold tabular-nums'>
        <span>{props.value}</span>
        <span className='text-muted-foreground text-[11px] font-normal whitespace-nowrap'>
          /{props.unit}
        </span>
      </span>
      {props.yuan && (
        <span className='text-success mt-0.5 font-mono text-xs tabular-nums'>
          ≈ {props.yuan}
        </span>
      )}
    </div>
  )
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const tokenUnit = DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  // ≈¥ only where top-up beats the exchange rate, i.e. there is a deal to show
  const yuan = (usd: number) =>
    isDiscounted(priceRate, usdExchangeRate)
      ? formatYuan(usd, priceRate, locale)
      : null
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = '1M'
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 24) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const groupRatioMultiplier = getDynamicDisplayGroupRatio(
    props.model,
    props.selectedGroup
  )
  const dynamicPriceOptions = useMemo(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice: false,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier,
    }),
    [billingTime, tokenUnit, priceRate, usdExchangeRate, groupRatioMultiplier]
  )
  const dynamicSummary = useMemo(
    () => getDynamicPricingSummary(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  const cardExamplePrice = useMemo(
    () => getCardExamplePrice(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )

  let priceSummary: ReactNode
  if (dynamicSummary) {
    const cacheReadEntries = dynamicSummary.secondaryEntries.filter(
      (entry) => entry.field === 'cacheReadPrice' && entry.unit === 'token'
    )
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <div className='col-span-full min-w-0'>
          <span className='text-warning'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </div>
      )
    } else if (
      dynamicSummary.primaryEntries.length > 0 ||
      cacheReadEntries.length > 0
    ) {
      priceSummary = (
        <>
          {[
            dynamicSummary.primaryEntries.slice(
              0,
              dynamicSummary.providerCount ? 2 : undefined
            ),
            cacheReadEntries,
          ]
            .flat()
            .map((entry) => {
              const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
              const unitLabel = taskUsageUnitLabel(
                entry,
                i18n.language,
                unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
              )
              const label =
                entry.labelKind !== 'schema'
                  ? t(entry.shortLabel)
                  : taskPriceLabel(
                      entry.description,
                      entry.shortLabel,
                      i18n.language
                    )
              return (
                <PriceCell
                  key={entry.key}
                  label={label}
                  value={entry.formattedRange ?? entry.formatted}
                  unit={unitLabel}
                  yuan={
                    entry.formattedRange
                      ? null
                      : yuan(entry.value * groupRatioMultiplier)
                  }
                  wide={dynamicSummary.isTaskUsage}
                />
              )
            })}
          {dynamicSummary.isTimePricing && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Current period price')}
            </span>
          )}
          {dynamicSummary.isMixedBilling && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Token or per-call pricing')}
            </span>
          )}
          {cardExamplePrice && (
            <span className='text-muted-foreground col-span-full text-xs break-words'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tierCount > 1 &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground col-span-full text-xs break-words'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground col-span-full'>
          {dynamicSummary.hasUnconfiguredProviders
            ? t('Usage-based billing · price not configured')
            : t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground col-span-full'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    const groupRatio = getDisplayGroupRatio(props.model, props.selectedGroup)
    const prices: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
      ...(props.model.cache_ratio != null
        ? [{ type: 'cache' as const, label: t('Cache Read') }]
        : []),
    ]
    priceSummary = prices.map((price) => (
      <PriceCell
        key={price.type}
        label={price.label}
        value={formatPrice(
          props.model,
          price.type,
          tokenUnit,
          false,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        )}
        unit={tokenUnitLabel}
        yuan={yuan(calculateTokenPrice(props.model, price.type, groupRatio))}
      />
    ))
  } else {
    priceSummary = (
      <PriceCell
        label={null}
        value={formatRequestPrice(
          props.model,
          false,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        )}
        unit={t('request')}
        yuan={yuan(
          (props.model.model_price || 0) *
            getDisplayGroupRatio(props.model, props.selectedGroup)
        )}
        wide
      />
    )
  }

  return (
    <Card className='hover:ring-foreground/25 has-[a[data-card-link]:focus-visible]:ring-ring relative h-full min-w-0 gap-4 transition-shadow has-[a[data-card-link]:focus-visible]:ring-2'>
      <CardHeader className='flex flex-row items-center gap-3'>
        <div
          aria-hidden
          className='bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg'
        >
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='truncate font-mono text-[15px] leading-snug font-semibold'
            title={props.model.model_name}
          >
            <Link
              to='/pricing/$modelId'
              params={{ modelId: props.model.model_name }}
              search={props.linkSearch ?? {}}
              data-card-link
              className='outline-none after:absolute after:inset-0 after:rounded-xl'
            >
              {props.model.model_name}
            </Link>
          </h3>
          {props.model.vendor_name && (
            <p className='text-muted-foreground truncate text-xs'>
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <CopyButton
          value={props.model.model_name}
          tooltip={t('Copy model name')}
          className='relative z-10 size-7'
          iconClassName='size-3.5'
        />
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-4'>
        {props.model.description && (
          <p className='text-muted-foreground -mt-1 line-clamp-2 text-[13px] leading-5 break-words'>
            {props.model.description}
          </p>
        )}
        <div
          role='group'
          aria-label={t('Pricing')}
          className='flex min-w-0 flex-col gap-2'
        >
          {(isDynamicPricingModel(props.model) || !isTokenBased) && (
            <ModelBillingModeBadge model={props.model} appearance='caption' />
          )}
          {dynamicSummary?.providerCount && (
            <span className='text-muted-foreground text-xs break-words'>
              {t('{{count}} providers', {
                count: dynamicSummary.providerCount,
              })}
              {dynamicSummary.hasUnconfiguredProviders &&
                ` · ${t('Not configured for some providers')}`}
            </span>
          )}
          <div className='grid grid-cols-3 gap-x-3 gap-y-3'>{priceSummary}</div>
        </div>
        <div className='mt-auto flex flex-col gap-3'>
          <ModelTools model={props.model} />
          <ModelStatusBar
            series={props.perf?.recent_success_series}
            windowEnd={props.perf?.window_end}
          />
        </div>
      </CardContent>
    </Card>
  )
})
