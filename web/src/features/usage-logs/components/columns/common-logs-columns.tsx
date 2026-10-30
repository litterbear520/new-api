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
import type { ColumnDef } from '@tanstack/react-table'
import { GitBranch, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StatusBadge,
  textColorMap,
  type StatusBadgeProps,
} from '@/components/status-badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import {
  normalizeTierLabel,
  parseTaskTiersFromExpr,
} from '@/features/pricing/lib/billing-expr'
import {
  formatTaskUsageUnitPrice,
  getTaskUsagePriceUnitLabelKey,
} from '@/features/pricing/lib/dynamic-price'
import { pluginUsageSchema } from '@/features/pricing/lib/plugin-pricing'
import { taskUsageUnitLabel } from '@/features/pricing/lib/task-price-display'
import type { BillingUsageSchema } from '@/features/pricing/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import {
  formatLogQuota,
  formatNumber,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { LOG_TYPE_ALL_VALUE, LOG_TYPE_ENUM } from '../../constants'
import type { UsageLog } from '../../data/schema'
import {
  formatModelName,
  decodeBillingExprB64,
  getFirstResponseTimeColor,
  getResponseTimeColor,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  parseLogOther,
  isViolationFeeLog,
  logTokenName,
  renderAuditContent,
  renderLogContent,
} from '../../lib/format'
import {
  isDisplayableLogType,
  isTimingLogType,
  getLogTypeConfig,
  isPerCallBilling,
} from '../../lib/utils'
import type { LogOtherData } from '../../types'
import { LogCostDisplay } from '../log-cost-display'
import { LogDetailsCell } from '../log-details-cell'
import { LogUserAvatar } from '../log-user-avatar'
import { ModelBadge } from '../model-badge'
import { StreamErrorAlert } from '../stream-error-alert'
import { useUsageLogsContext } from '../usage-logs-provider'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

function formatRatioCompact(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '-'
  return ratio % 1 === 0
    ? String(ratio)
    : ratio.toFixed(4).replace(/\.?0+$/, '')
}

function getGroupRatio(other: LogOtherData | null): number | null {
  const userGroupRatio = other?.user_group_ratio
  if (
    userGroupRatio != null &&
    userGroupRatio !== -1 &&
    Number.isFinite(userGroupRatio)
  ) {
    return userGroupRatio
  }

  const groupRatio = other?.group_ratio
  if (groupRatio != null && groupRatio !== 1 && Number.isFinite(groupRatio)) {
    return groupRatio
  }

  return null
}

function buildDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  isAdmin: boolean,
  language: string,
  usageSchema?: BillingUsageSchema
): DetailSegment[] {
  const segments = buildTypeDetailSegments(log, other, t, language, usageSchema)
  const adminSegments: DetailSegment[] = []
  // Quota saturation is a rare, admin-only anomaly marker; surface it first
  // and in danger styling so it stands out on the related billing log. The
  // backend already strips admin_info for non-admins; gate on isAdmin too as
  // defense in depth so the marker never leaks if that changes.
  if (isAdmin && other?.admin_info?.quota_saturation) {
    adminSegments.push({ text: t('Quota clamped'), danger: true })
  }
  return [...adminSegments, ...segments]
}

function buildTypeDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string,
  usageSchema?: BillingUsageSchema
): DetailSegment[] {
  // Top-up, audit, and login logs can carry a localized operation descriptor.
  if (log.type === 1 || log.type === 3 || log.type === 7) {
    const text = renderAuditContent(other, t) ?? renderLogContent(other, t)
    return text ? [{ text }] : []
  }

  if (log.type === 6) {
    return [{ text: t('Async task refund') }]
  }

  if (log.type !== 2) return []

  const isViolation = isViolationFeeLog(other)
  if (isViolation) {
    const segments: DetailSegment[] = []
    segments.push({ text: t('Violation Fee'), danger: true })
    if (other?.violation_fee_code) {
      segments.push({
        text: other.violation_fee_code,
        muted: true,
      })
    }
    segments.push({
      text: `${t('Fee')}: ${formatLogQuota(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const formatPrice = (price: number) =>
    `${formatBillingCurrencyFromUSD(price, priceOpts)}/M`
  const formatPriceCompact = (price: number) =>
    formatBillingCurrencyFromUSD(price, priceOpts)
  const formatPriceList = (prices: string[], showUnit: boolean) => {
    const text = prices.join(' / ')
    return showUnit ? `${text}/M` : text
  }
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(other)
  if (isTieredExpr && other.is_task) {
    const tiers = parseTaskTiersFromExpr(
      decodeBillingExprB64(other.expr_b64),
      usageSchema,
      true
    )
    const tier = tiers.find(
      (entry) =>
        Boolean(other.matched_tier) &&
        normalizeTierLabel(entry.label) ===
          normalizeTierLabel(other.matched_tier)
    )
    if (tier) {
      const prices = Object.entries(tier.unitPrices).map(([field, price]) => {
        const definition = usageSchema?.[field]
        const unitKey = getTaskUsagePriceUnitLabelKey(definition?.unit)
        const unitLabel = taskUsageUnitLabel(definition, language, t(unitKey))
        return `${field} ${formatTaskUsageUnitPrice(price, { tokenUnit: 'M' })}/${unitLabel}`
      })
      if (tier.constant > 0) {
        prices.push(
          `${t('Additional charge')} ${formatTaskUsageUnitPrice(tier.constant, { tokenUnit: 'M' })}/${t('request')}`
        )
      }
      segments.push({
        text: `${tier.label || t('Default')} · ${prices.join(' · ')}`,
      })
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${other.matched_tier || t('Special billing expression')}`,
        muted: true,
      })
    }
  } else if (isTieredExpr) {
    if (tieredSummary) {
      const baseEntries = tieredSummary.priceEntries
        .filter((entry) => ['inputPrice', 'outputPrice'].includes(entry.field))
        .map((entry) => formatPriceCompact(entry.price))
      if (baseEntries.length > 0) {
        const tierLabel = tieredSummary.tier.label || t('Default')
        segments.push({
          text: `${tierLabel} · ${formatPriceList(baseEntries, true)}`,
        })
      }

      const cacheEntries = tieredSummary.priceEntries
        .filter((entry) =>
          [
            'cacheReadPrice',
            'cacheCreatePrice',
            'cacheCreate1hPrice',
            'cacheCreate12hPrice',
          ].includes(entry.field)
        )
        .map((entry) => {
          return formatPriceCompact(entry.price)
        })
      if (cacheEntries.length > 0) {
        segments.push({
          text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
          muted: true,
        })
      }

      const otherEntries = tieredSummary.priceEntries
        .filter(
          (entry) =>
            ![
              'inputPrice',
              'outputPrice',
              'cacheReadPrice',
              'cacheCreatePrice',
              'cacheCreate1hPrice',
              'cacheCreate12hPrice',
            ].includes(entry.field)
        )
        .map((entry) =>
          entry.unit
            ? `${tieredSummary.tier.label || t('Default')} · ${t(entry.shortLabel)} ${formatPriceCompact(entry.price)}/${t(entry.unit)}`
            : `${t(entry.shortLabel)} ${formatPrice(entry.price)}`
        )
      if (otherEntries.length > 0) {
        segments.push({
          text: otherEntries.join(' · '),
          muted: true,
        })
      }
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${other.matched_tier || t('Special billing expression')}`,
        muted: true,
      })
    }
  } else {
    const modelPrice = other.model_price
    const isPerCall = isPerCallBilling(modelPrice)
    if (isPerCall && modelPrice != null) {
      segments.push({
        text: `${t('Per-call')} · ${formatBillingCurrencyFromUSD(modelPrice, priceOpts)}`,
      })
    } else if (other.model_ratio != null) {
      const inputPriceUSD = other.model_ratio * 2.0
      const baseEntries = [formatPriceCompact(inputPriceUSD)]
      if (other.completion_ratio != null) {
        baseEntries.push(
          formatPriceCompact(inputPriceUSD * other.completion_ratio)
        )
      }
      segments.push({
        text: `${t('Standard')} · ${formatPriceList(baseEntries, true)}`,
      })

      if (hasAnyCacheTokens(other)) {
        const cacheEntries = [
          other.cache_ratio != null && other.cache_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_ratio)
            : null,
          other.cache_creation_ratio != null && other.cache_creation_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio)
            : null,
          other.cache_creation_ratio_1h != null &&
          other.cache_creation_ratio_1h !== 0
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio_1h)
            : null,
          other.cache_creation_ratio_12h != null &&
          other.cache_creation_ratio_12h !== 0
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio_12h)
            : null,
        ].filter(Boolean) as string[]

        if (cacheEntries.length > 0) {
          segments.push({
            text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
            muted: true,
          })
        }
      }
    } else {
      const userGroupRatio = other.user_group_ratio
      const groupRatio = other.group_ratio
      const isUserGroup =
        userGroupRatio != null &&
        Number.isFinite(userGroupRatio) &&
        userGroupRatio !== -1
      const effectiveRatio = isUserGroup ? userGroupRatio : groupRatio
      const ratioLabel = isUserGroup
        ? t('User Exclusive Ratio')
        : t('Group Ratio')

      if (effectiveRatio != null && Number.isFinite(effectiveRatio)) {
        segments.push({
          text: `${ratioLabel} ${formatRatioCompact(effectiveRatio)}x`,
        })
      }
    }
  }

  if (other.is_system_prompt_overwritten) {
    segments.push({
      text: t('System Prompt Override'),
      danger: true,
    })
  }

  return segments
}

/**
 * The price summary of a log (or the text of a top-up, error and the like),
 * for the admin 详情 column and the bottom line of every mobile card.
 */
export function useLogDetailSegments(
  log: UsageLog,
  isAdmin: boolean
): DetailSegment[] {
  const { t, i18n } = useTranslation()
  const other = parseLogOther(log.other)
  const pricingData = usePricingData(
    log.type === 2 &&
      other?.is_task === true &&
      other.billing_mode === 'tiered_expr'
  )
  const usageSchema = pluginUsageSchema(
    pricingData.models.find((model) => model.model_name === log.model_name),
    other?.admin_info?.task_plugin?.key
  )
  return buildDetailSegments(log, other, t, isAdmin, i18n.language, usageSchema)
}

/** 10-27 14:05:09; older logs also show the year. */
function formatLogTime(timestamp: number): string {
  const time = dayjs.unix(timestamp)
  return time.format(
    time.year() === dayjs().year() ? 'MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss'
  )
}

const EMPTY_CELL = <span className='text-muted-foreground/50'>—</span>

export function useCommonLogsColumns(
  isAdmin: boolean,
  isRoot: boolean,
  showBillingSource = false
): ColumnDef<UsageLog>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const currency = useSystemConfigStore((state) => state.config.currency)
  return useMemo(() => {
    const columns: ColumnDef<UsageLog>[] = [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => {
          const log = row.original
          const timestamp = row.getValue('created_at') as number
          const config = getLogTypeConfig(log.type)

          return (
            <div className='flex min-w-0 items-center gap-1.5'>
              <span
                className='truncate tabular-nums'
                title={formatTimestampToDate(timestamp)}
              >
                {formatLogTime(timestamp)}
              </span>
              {log.type !== LOG_TYPE_ENUM.CONSUME && (
                <StatusBadge
                  label={t(config.label)}
                  variant={config.color as StatusBadgeProps['variant']}
                  size='sm'
                  copyable={false}
                  className='shrink-0 !text-xs [&_span]:!text-xs'
                />
              )}
            </div>
          )
        },
        filterFn: (row, _id, value) => {
          if (!Array.isArray(value) || value.length === 0) return true
          if (value.includes(LOG_TYPE_ALL_VALUE)) return true
          return value.includes(String(row.original.type))
        },
        enableHiding: false,
        size: 140,
      },
    ]

    if (isAdmin) {
      columns.push(
        {
          id: 'channel',
          header: t('Channel'),
          accessorFn: (row) => row.channel,
          cell: function ChannelCell({ row }) {
            const {
              sensitiveVisible,
              setAffinityTarget,
              setAffinityDialogOpen,
            } = useUsageLogsContext()
            const log = row.original

            if (!isDisplayableLogType(log.type)) return null

            const other = parseLogOther(log.other)
            const affinity = other?.admin_info?.channel_affinity
            const rawUseChannel = other?.admin_info?.use_channel ?? []
            const useChannel = Array.isArray(rawUseChannel)
              ? rawUseChannel.map(String).filter(Boolean)
              : []
            const hasRetryChain = useChannel.length > 1
            const channelChain = hasRetryChain
              ? useChannel.join(' → ')
              : undefined
            const channelDisplay = log.channel_name
              ? `${log.channel_name} #${log.channel}`
              : `#${log.channel}`
            const channelIdDisplay = `#${log.channel}`
            const channelName = sensitiveVisible ? log.channel_name : '••••'
            const multiKeyIndex = other?.admin_info?.multi_key_index
            const showMultiKeyIndex =
              other?.admin_info?.is_multi_key === true &&
              typeof multiKeyIndex === 'number' &&
              Number.isFinite(multiKeyIndex)

            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className='flex max-w-[160px] flex-col gap-0.5' />
                    }
                  >
                    <div className='relative inline-flex w-fit items-center gap-1'>
                      <StatusBadge
                        label={channelIdDisplay}
                        autoColor={String(log.channel)}
                        copyText={String(log.channel)}
                        size='sm'
                        showDot={false}
                        className='font-mono'
                      />
                      {showMultiKeyIndex && (
                        <StatusBadge
                          label={String(multiKeyIndex)}
                          size='sm'
                          showDot={false}
                          copyable={false}
                          variant='neutral'
                          className='h-5 min-w-5 justify-center rounded-full px-1 font-mono text-xs'
                          aria-label={`${t('Key')} ${multiKeyIndex}`}
                        />
                      )}
                      {hasRetryChain && (
                        <Popover>
                          <PopoverTrigger
                            render={
                              <button
                                type='button'
                                className='text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none'
                                aria-label={t('Retry Chain')}
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            <GitBranch
                              className='size-3.5 text-amber-500'
                              aria-hidden='true'
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            side='top'
                            align='start'
                            className='w-64 text-xs'
                          >
                            <div className='flex flex-col gap-1'>
                              <p className='font-medium'>{t('Retry Chain')}</p>
                              <p className='text-muted-foreground font-mono break-all'>
                                {channelChain}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      {affinity && (
                        <button
                          type='button'
                          className='absolute -top-1 -right-1 leading-none text-amber-500'
                          onClick={(e) => {
                            e.stopPropagation()
                            setAffinityTarget({
                              rule_name: affinity.rule_name || '',
                              using_group:
                                affinity.using_group ||
                                affinity.selected_group ||
                                '',
                              key_hint: affinity.key_hint || '',
                              key_fp: affinity.key_fp || '',
                            })
                            setAffinityDialogOpen(true)
                          }}
                        >
                          <Sparkles className='size-3 fill-current' />
                        </button>
                      )}
                    </div>
                    {log.channel_name && (
                      <span className='text-muted-foreground/70 truncate [font-family:var(--font-body)] !text-xs'>
                        {channelName}
                      </span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className='space-y-1'>
                      <p>
                        {sensitiveVisible ? channelDisplay : channelIdDisplay}
                      </p>
                      {channelChain && (
                        <p className='text-muted-foreground text-xs'>
                          {t('Chain')}: {channelChain}
                        </p>
                      )}
                      {showMultiKeyIndex && (
                        <p className='text-muted-foreground text-xs'>
                          {t('Key')}: {multiKeyIndex}
                        </p>
                      )}
                      {affinity && (
                        <div className='border-t pt-1 text-xs'>
                          <p className='font-medium'>{t('Channel Affinity')}</p>
                          <p>
                            {t('Rule')}: {affinity.rule_name || '-'}
                          </p>
                          <p>
                            {t('Group')}:{' '}
                            {sensitiveVisible
                              ? affinity.using_group ||
                                affinity.selected_group ||
                                '-'
                              : '••••'}
                          </p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          },
        },
        {
          id: 'user',
          header: t('User'),
          accessorFn: (row) => row.username,
          cell: function UserCell({ row }) {
            const {
              sensitiveVisible,
              setSelectedUserId,
              setUserInfoDialogOpen,
            } = useUsageLogsContext()
            const log = row.original

            if (!log.username) return null

            return (
              <button
                type='button'
                className='flex items-center gap-1.5 text-left'
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedUserId(log.user_id)
                  setUserInfoDialogOpen(true)
                }}
              >
                <LogUserAvatar
                  name={log.username}
                  visible={sensitiveVisible}
                  className='max-sm:hidden'
                />
                <TooltipProvider delay={300}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className='text-muted-foreground max-w-[100px] truncate text-sm hover:underline' />
                      }
                    >
                      {sensitiveVisible ? log.username : '••••'}
                    </TooltipTrigger>
                    {sensitiveVisible && log.username.length > 12 && (
                      <TooltipContent side='top'>{log.username}</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </button>
            )
          },
        }
      )
    }

    columns.push(
      {
        accessorKey: 'model_name',
        header: t('Model'),
        cell: function ModelCell({ row }) {
          const log = row.original
          if (!isDisplayableLogType(log.type)) {
            // Top-ups, quota changes and the like have no model or tokens;
            // what happened goes here so the row is not blank.
            const other = parseLogOther(log.other)
            const summary =
              renderAuditContent(other, t) ??
              renderLogContent(other, t) ??
              log.content
            return summary ? (
              <span
                className='text-muted-foreground block max-w-44 truncate'
                title={summary}
              >
                {summary}
              </span>
            ) : null
          }

          const modelInfo = formatModelName(log)

          return (
            <div className='flex w-fit flex-col gap-0.5'>
              <ModelBadge
                modelName={modelInfo.name}
                actualModel={modelInfo.actualModel}
                responseModel={modelInfo.responseModel}
              />
            </div>
          )
        },
        meta: { mobileTitle: true },
        size: 180,
      },
      {
        accessorKey: 'token_name',
        header: t('Key'),
        cell: function KeyCell({ row }) {
          const { sensitiveVisible } = useUsageLogsContext()
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null

          const tokenName = logTokenName(log, t)
          if (!tokenName) return null

          const other = parseLogOther(log.other)
          const group = log.group || other?.group || ''
          const groupRatio = getGroupRatio(other)
          // The default group at its usual price is the common case; only
          // anything else earns a second line.
          const note = [
            group && group !== 'default' ? group : '',
            groupRatio != null ? `${formatRatioCompact(groupRatio)}x` : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div className='flex min-w-0 flex-col'>
              <span
                className='truncate'
                title={sensitiveVisible ? tokenName : undefined}
              >
                {sensitiveVisible ? tokenName : '••••'}
              </span>
              {note && (
                <span className='text-muted-foreground truncate text-xs!'>
                  {sensitiveVisible ? note : '••••'}
                </span>
              )}
            </div>
          )
        },
        size: 140,
      },
      {
        accessorKey: 'prompt_tokens',
        header: t('Input'),
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          if (!log.prompt_tokens && !log.completion_tokens) return EMPTY_CELL
          return (
            <span className='tabular-nums'>
              {formatNumber(log.prompt_tokens || 0, locale)}
            </span>
          )
        },
        size: 90,
      },
      {
        accessorKey: 'completion_tokens',
        header: t('Output'),
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          if (!log.prompt_tokens && !log.completion_tokens) return EMPTY_CELL
          return (
            <span className='tabular-nums'>
              {formatNumber(log.completion_tokens || 0, locale)}
            </span>
          )
        },
        size: 80,
      },
      {
        id: 'cache_tokens',
        header: t('Cache'),
        accessorFn: (log) => parseLogOther(log.other)?.cache_tokens ?? 0,
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null

          const other = parseLogOther(log.other)
          const read = other?.cache_tokens || 0
          const split =
            (other?.cache_creation_tokens_5m || 0) +
            (other?.cache_creation_tokens_1h || 0)
          const write = split > 0 ? split : other?.cache_creation_tokens || 0
          if (read === 0 && write === 0) return EMPTY_CELL

          return (
            <span className='tabular-nums'>
              {read > 0 && (
                <span
                  title={`${t('Cache Read')} ${formatNumber(read, locale)}`}
                >
                  {formatNumber(read, locale)}
                </span>
              )}
              {write > 0 && (
                <span
                  className={cn(
                    'text-muted-foreground text-xs!',
                    read > 0 && 'ms-1'
                  )}
                  title={`${t('Cache write')} ${formatNumber(write, locale)}`}
                >
                  ↑{formatNumber(write, locale)}
                </span>
              )}
            </span>
          )
        },
        size: 100,
      },
      {
        accessorKey: 'quota',
        header: t('Cost'),
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null

          const quota = row.getValue('quota') as number
          const other = parseLogOther(log.other)
          return (
            <LogCostDisplay
              quota={quota}
              other={other}
              showBillingSource={showBillingSource}
              plain
            />
          )
        },
        size: 90,
      },
      {
        id: 'frt',
        header: t('First token'),
        accessorFn: (log) => parseLogOther(log.other)?.frt ?? null,
        cell: ({ row }) => {
          const log = row.original
          if (!isTimingLogType(log.type)) return null

          const frtMs = parseLogOther(log.other)?.frt
          if (!log.is_stream || frtMs == null || frtMs <= 0) return EMPTY_CELL
          const seconds = frtMs / 1000
          const variant = getFirstResponseTimeColor(seconds)
          return (
            <span
              className={cn(
                'tabular-nums',
                variant !== 'success' && textColorMap[variant]
              )}
            >
              {formatUseTime(seconds)}
            </span>
          )
        },
        size: 70,
      },
      {
        accessorKey: 'use_time',
        header: t('Duration'),
        cell: ({ row }) => {
          const log = row.original
          if (!isTimingLogType(log.type)) return null

          const useTime = log.use_time || 0
          const tokensPerSecond =
            useTime > 0 && log.completion_tokens > 0
              ? Math.round(log.completion_tokens / useTime)
              : null
          const variant = getResponseTimeColor(useTime, log.completion_tokens)
          const streamStatus = parseLogOther(log.other)?.stream_status
          const streamFailed =
            log.is_stream && streamStatus && streamStatus.status !== 'ok'

          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 tabular-nums',
                variant !== 'success' && textColorMap[variant]
              )}
              title={
                tokensPerSecond != null
                  ? `${tokensPerSecond} tokens/s`
                  : undefined
              }
            >
              {formatUseTime(useTime)}
              {streamFailed && streamStatus && (
                <StreamErrorAlert
                  streamStatus={streamStatus}
                  iconClassName='size-3.5'
                />
              )}
            </span>
          )
        },
        size: 70,
      }
    )

    // Users open a log by clicking its row; administrators keep the price
    // summary column as well.
    if (isAdmin) {
      columns.push({
        accessorKey: 'content',
        header: t('Details'),
        cell: function DetailsCell({ row }) {
          const segments = useLogDetailSegments(row.original, isAdmin)
          return (
            <LogDetailsCell
              log={row.original}
              segments={segments}
              isAdmin={isAdmin}
              isRoot={isRoot}
            />
          )
        },
        size: 180,
        maxSize: 200,
      })
    }

    return columns
    // Log formatters read currency settings from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, locale, isAdmin, isRoot, showBillingSource, currency])
}
