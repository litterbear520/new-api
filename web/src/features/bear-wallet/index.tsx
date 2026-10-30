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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Ticket, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { RunwayLine } from '@/features/bear-overview/components/runway'
import { LOW_BALANCE_DAYS } from '@/features/bear-overview/constants'
import { overviewKeys } from '@/features/bear-overview/hooks/use-overview-data'
import {
  estimateRunOut,
  summarizeUsage,
} from '@/features/bear-overview/lib/usage'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { CodeDialog } from './components/code-dialog'
import { DealStrip } from './components/deal-strip'
import { HistoryPanel } from './components/history-panel'
import { PaidBanner } from './components/paid-banner'
import { TopupDialog } from './components/topup-dialog'
import { WalletStats } from './components/wallet-stats'
import { EPAY_TYPES, walletKeys, type WalletTab } from './constants'
import { useWalletData } from './hooks/use-wallet-data'
import { loginMethod } from './lib/format'
import { starterOffer, type TopupOffer } from './lib/offer'
import { activePacks, giftOffer, packsLeft, starterOpen } from './lib/packs'
import { NO_RULES } from './lib/rules'

import './bear-wallet.css'

export interface BearWalletProps {
  initialTab?: WalletTab
  /** Dollars picked on the overview */
  initialAmount?: number
  /** Order number pay-bridge sends the payer back with */
  paid?: string
}

/**
 * 钱包, after OpenModel's top-up records page: the balance in three figures,
 * one line with the deals, and the top-up history. 充值 and 兑换码 open
 * dialogs. Bonus credit from pay-bridge sits in subscription packs, which
 * New API spends first; the balance shown includes what is left in them.
 * `?tab=` (older links) and `?amount=` (the overview) open the matching part.
 */
export function BearWallet(props: BearWalletProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authUser = useAuthStore((state) => state.auth.user)
  const { status } = useStatus()
  const data = useWalletData(authUser)
  const [codeOpen, setCodeOpen] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [awaitingReturn, setAwaitingReturn] = useState(false)

  const user = data.self.data ?? authUser
  const rules = data.rules.data ?? NO_RULES
  const nowSeconds = Math.floor(Date.now() / 1000)
  const subscriptions = useMemo(
    () => data.subscriptions.data ?? [],
    [data.subscriptions.data]
  )
  const packs = useMemo(
    () => activePacks(subscriptions, rules, nowSeconds),
    // Recomputed when the data changes; expiry is checked on each fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscriptions, rules]
  )
  const gift = giftOffer(data.plans.data ?? [], subscriptions, rules.giftPlanId)
  const wallet = Number(user?.quota ?? 0)
  const held = packsLeft(packs)
  const total = wallet + held

  const now = new Date()
  const summary = data.usage.data ? summarizeUsage(data.usage.data, now) : null
  const perDay = summary?.perDayQuota ?? 0
  const runwayDays = perDay > 0 ? total / perDay : null
  const isNew = Number(user?.request_count ?? 0) === 0
  const canGetStarter = starterOpen(rules.first, data.subscriptions.data)
  const low =
    !isNew &&
    (total <= 0 || (runwayDays !== null && runwayDays < LOW_BALANCE_DAYS))

  const price = Number(status?.price) > 0 ? Number(status?.price) : 1
  const info = data.topupInfo.data
  const methods = useMemo(
    () =>
      info?.enable_online_topup
        ? (info.pay_methods ?? []).filter((item) =>
            EPAY_TYPES.includes(item.type)
          )
        : [],
    [info]
  )
  const method = loginMethod(user, {
    oidc:
      typeof status?.oidc_display_name === 'string'
        ? status.oidc_display_name
        : undefined,
    wechat: t('WeChat'),
    email: t('Email'),
  })
  const name = user?.display_name || user?.username || ''
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: overviewKeys.self })
    void queryClient.invalidateQueries({ queryKey: walletKeys.subscriptions })
    void queryClient.invalidateQueries({ queryKey: walletKeys.history })
  }, [queryClient])

  // After the cashier opens in another tab, refresh whenever the user returns.
  useEffect(() => {
    if (!awaitingReturn) return
    const onReturn = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [awaitingReturn, refresh])

  useEffect(() => {
    if (props.paid) refresh()
  }, [props.paid, refresh])

  const closePaid = () => {
    void navigate({ to: '/wallet', search: {}, replace: true })
  }

  // Older links point at the tabs this page used to have; the overview's
  // quick amounts send ?amount=.
  const wantsTopup =
    props.initialTab === 'topup' || Boolean(props.initialAmount)
  useEffect(() => {
    if (props.initialTab === 'code') setCodeOpen(true)
    // 邀请奖励 has its own page now
    if (props.initialTab === 'invite') {
      void navigate({ to: '/invite', replace: true })
    }
  }, [props.initialTab, navigate])
  useEffect(() => {
    if (wantsTopup) setTopupOpen(true)
  }, [wantsTopup, props.initialAmount])

  const clearSearch = () => {
    void navigate({ to: '/wallet', search: {}, replace: true })
  }
  const onCodeOpenChange = (open: boolean) => {
    setCodeOpen(open)
    if (!open && props.initialTab === 'code') clearSearch()
  }
  const onTopupOpenChange = (open: boolean) => {
    setTopupOpen(open)
    if (!open && wantsTopup) clearSearch()
  }

  const runway =
    low && summary ? (
      <RunwayLine
        balance={total}
        perDay={perDay}
        runOut={estimateRunOut(total, perDay, summary.hourShape, now)}
        now={now}
      />
    ) : null

  const ready =
    Boolean(user) &&
    !data.topupInfo.isPending &&
    !data.rules.isPending &&
    !data.plans.isPending &&
    !data.subscriptions.isPending

  const offer: TopupOffer = {
    price,
    rules,
    gift,
    methods,
    minTopup: Number(info?.min_topup ?? 1),
    isNew,
    canGetStarter,
    account: name ? { name, method } : null,
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Top up, redeem a code and see your top-ups.')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <Button variant='outline' onClick={() => setCodeOpen(true)}>
            <Ticket aria-hidden='true' />
            {t('Redemption code')}
          </Button>
          <Button onClick={() => setTopupOpen(true)}>
            <Wallet aria-hidden='true' />
            {t('Top up')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='bw-page'>
            <div className='bw'>
              {props.paid && (
                <PaidBanner
                  trade={props.paid}
                  rules={rules}
                  packs={packs}
                  onClose={closePaid}
                />
              )}
              <WalletStats
                total={user ? total : null}
                low={low}
                runway={runway}
                held={held}
                packs={packs}
              />
              {ready && methods.length > 0 && (
                <DealStrip
                  starter={starterOffer(offer)}
                  tiers={rules.tiers}
                  onOpen={() => setTopupOpen(true)}
                />
              )}
              <HistoryPanel
                methods={methods}
                isAdmin={isAdmin}
                packs={packs}
                nowSeconds={nowSeconds}
                focus={props.initialTab === 'history'}
              />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <TopupDialog
        {...offer}
        open={topupOpen}
        onOpenChange={onTopupOpenChange}
        ready={ready}
        initialAmount={props.initialAmount}
        onOpened={() => setAwaitingReturn(true)}
      />
      <CodeDialog
        open={codeOpen}
        onOpenChange={onCodeOpenChange}
        onRedeemed={refresh}
        topupLink={info?.topup_link || undefined}
      />
    </>
  )
}
