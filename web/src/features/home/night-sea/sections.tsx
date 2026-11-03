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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

import {
  LegalLinks,
  ProjectAttribution,
} from '@/components/layout/components/footer'
import type {
  InviteOffer,
  StarterOffer,
  TiersOffer,
} from '@/features/activity/lib/offers'
import { percent, yuan } from '@/features/bear-wallet/lib/rules'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { headlinePrice } from '@/features/pricing/lib/headline-price'
import { formatYuan, isImageModel } from '@/features/pricing/lib/tools'
import { useStatus } from '@/hooks/use-status'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import type { NightSeaAuthView } from './auth-dialog/use-night-sea-auth'
import {
  ENDPOINTS,
  FEATURED_MODELS,
  KEY_PLACEHOLDER,
  MODEL_LOGOS,
  SETUP_TOOLS,
  TOOL_LOGOS,
  faqs,
  highlight,
  pickLine,
  readDeal,
  readLines,
  setupSnippet,
  whyPoints,
  type Deal,
  type Logo,
  type SetupTool,
} from './sections-content'
import { useCopyLabel } from './use-copy-label'
import { offerOf, useHomeOffers } from './use-home-offers'

type AuthClick = (
  view: NightSeaAuthView
) => ((e: MouseEvent<HTMLElement>) => void) | undefined

type HomeSectionsProps = {
  name: string
  isAuthenticated: boolean
  /** Signed out, the calls to action open the sign-in dialog over the sky */
  authClick: AuthClick
  /** In place of the logo rows: the black hole's gateway, where it is drawn */
  gateway?: ReactNode
  /** The sky is the black hole's: credit the data it is drawn from */
  skyCredit?: boolean
}

const USD = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

/** Two phrases, spaced instead of punctuated, like the night-sea copy */
function Phrases(props: { text: [string, string] }) {
  return (
    <>
      <span className='ns-phrase'>{props.text[0]}</span>{' '}
      <span className='ns-phrase'>{props.text[1]}</span>
    </>
  )
}

function SectionHead(props: {
  id: string
  eyebrow: string
  title: [string, string]
  lead?: string
}) {
  return (
    <header className='ns-head'>
      <p className='ns-eyebrow'>{props.eyebrow}</p>
      <h2 id={props.id} className='ns-h2'>
        <Phrases text={props.title} />
      </h2>
      {props.lead && <p className='ns-lead'>{props.lead}</p>}
    </header>
  )
}

/** File paths, variable names and the key placeholder set as code */
const CODE_WORDS = new RegExp(
  `(~/[\\w./-]+|XIAOXIONG_API_KEY|${KEY_PLACEHOLDER})`
)

function WithCode(props: { text: string }) {
  let at = 0
  return props.text.split(CODE_WORDS).map((part, index) => {
    const start = at
    at += part.length
    return index % 2 === 1 ? (
      <code key={start} translate='no'>
        {part}
      </code>
    ) : (
      part
    )
  })
}

function LogoLink(props: { logo: Logo }) {
  const inner = (
    <>
      <span aria-hidden='true' className='ns-logo-icon'>
        {getLobeIcon(props.logo.icon, 22)}
      </span>
      {props.logo.name}
    </>
  )
  if (props.logo.vendor) {
    return (
      <Link
        to='/pricing'
        search={{ vendor: props.logo.vendor }}
        className='ns-logo'
      >
        {inner}
      </Link>
    )
  }
  // The docs are a separate site behind the same domain: full page load.
  return (
    <a href={props.logo.href} className='ns-logo'>
      {inner}
    </a>
  )
}

function Logos() {
  return (
    <section className='ns-band ns-logos' aria-labelledby='ns-logos-title'>
      <p id='ns-logos-title' className='ns-eyebrow'>
        支持的模型和工具
      </p>
      <ul className='ns-logo-row' aria-label='模型'>
        {MODEL_LOGOS.map((logo) => (
          <li key={logo.name}>
            <LogoLink logo={logo} />
          </li>
        ))}
      </ul>
      <ul className='ns-logo-row' aria-label='工具'>
        {TOOL_LOGOS.map((logo) => (
          <li key={logo.name}>
            <LogoLink logo={logo} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Why(props: { name: string; deal: Deal | null; url: string }) {
  return (
    <section className='ns-band' aria-labelledby='ns-why-title'>
      <SectionHead
        id='ns-why-title'
        eyebrow={`为什么用${props.name}`}
        title={['一个地址', '连上所有模型']}
        lead={`Claude、GPT、Gemini、DeepSeek 等 ${MODEL_LOGOS.length}\u00a0家模型用同一个密钥。你只管发请求。`}
      />
      <div className='ns-why'>
        <ol className='ns-why-list'>
          {whyPoints(props.deal).map((point, index) => (
            <li key={point.title}>
              <span className='ns-num' aria-hidden='true'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className='ns-card ns-endpoints'>
          <h3>接口一览</h3>
          <p className='ns-base'>
            <span>Base URL</span>
            <code translate='no'>{props.url}</code>
          </p>
          <dl>
            {ENDPOINTS.map((endpoint) => (
              <div key={endpoint.name + endpoint.format}>
                <dt>
                  {endpoint.name}
                  <span>{endpoint.format} 格式</span>
                </dt>
                <dd>
                  {endpoint.routes.map((route) => (
                    <code key={route} translate='no'>
                      {route}
                    </code>
                  ))}
                  <span>{endpoint.usedBy}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/** 新人礼包 as it is charged: ¥6 得 $60 余额，再送 $40 */
function starterText(offer: StarterOffer): string {
  return `新人礼包：${yuan(offer.pay, 'zh-CN')} 得 $${USD.format(offer.credit)} 余额，再送 $${USD.format(offer.bonus)} 限时额度`
}

/** The settings for one tool, coloured, with the key to fill in picked out */
function Snippet(props: { tool: SetupTool; code: string }) {
  // each run keyed by where it starts in the snippet
  const runs = useMemo(() => {
    let at = 0
    return highlight(props.code, props.tool.lang).map((token) => {
      const run = { ...token, at }
      at += token.text.length
      return run
    })
  }, [props.code, props.tool.lang])
  return (
    <pre translate='no'>
      <code>
        {runs.map((run) =>
          run.kind === 'plain' ? (
            run.text
          ) : (
            <span key={run.at} className={`ns-tok-${run.kind}`}>
              {run.text}
            </span>
          )
        )}
      </code>
    </pre>
  )
}

type RowOverflow = 'start' | 'end' | 'both'

/** Which ends of a sideways-scrolling row have more out of view */
function rowOverflow(row: HTMLElement): RowOverflow | undefined {
  const start = row.scrollLeft > 1
  const end = row.scrollWidth - row.clientWidth - row.scrollLeft > 1
  if (start && end) return 'both'
  if (start) return 'start'
  if (end) return 'end'
  return undefined
}

function Setup(props: {
  isAuthenticated: boolean
  authClick: AuthClick
  starter: StarterOffer | null
}) {
  const { status } = useStatus()
  const origin = window.location.origin
  const lines = useMemo(
    () =>
      readLines(
        status?.api_info_enabled === false ? [] : status?.api_info,
        origin
      ),
    [status?.api_info, status?.api_info_enabled, origin]
  )
  const [lineUrl, setLineUrl] = useState<string | null>(null)
  const line =
    lines.find((item) => item.url === lineUrl) ?? pickLine(lines, origin)
  const [toolId, setToolId] = useState<SetupTool['id']>('claude-code')
  const toolIndex = Math.max(
    0,
    SETUP_TOOLS.findIndex((item) => item.id === toolId)
  )
  const tool = SETUP_TOOLS[toolIndex]
  const snippet = setupSnippet(tool.id, line.url)
  const copySnippet = useCopyLabel(snippet)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const tabList = useRef<HTMLDivElement>(null)
  const [tabOverflow, setTabOverflow] = useState<RowOverflow>()

  // The scrollbar is hidden, so a faded end shows there are more tabs that way
  useEffect(() => {
    const list = tabList.current
    if (!list) return
    const measure = () => setTabOverflow(rowOverflow(list))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    for (const tab of tabs.current) if (tab) observer.observe(tab)
    list.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      list.removeEventListener('scroll', measure)
    }
  }, [])

  // On a phone the tab row is wider than the card and scrolls sideways: keep
  // the chosen tab in view (moving only the row, never the page)
  useEffect(() => {
    const list = tabList.current
    const tab = tabs.current[toolIndex]
    if (!list || !tab) return
    const row = list.getBoundingClientRect()
    const box = tab.getBoundingClientRect()
    if (box.right > row.right) list.scrollLeft += box.right - row.right + 12
    else if (box.left < row.left) list.scrollLeft -= row.left - box.left + 12
  }, [toolIndex])

  // Arrow keys move along the tabs, as in any tab list
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const count = SETUP_TOOLS.length
    const moves: Record<string, number> = {
      ArrowRight: (toolIndex + 1) % count,
      ArrowLeft: (toolIndex + count - 1) % count,
      Home: 0,
      End: count - 1,
    }
    const next = moves[e.key]
    if (next === undefined) return
    e.preventDefault()
    setToolId(SETUP_TOOLS[next].id)
    tabs.current[next]?.focus()
  }

  return (
    <section className='ns-band' aria-labelledby='ns-setup-title'>
      <SectionHead
        id='ns-setup-title'
        eyebrow='接入流程'
        title={['三步接入', '现有工具直接用']}
        lead='不用去各家注册账号、保管密钥，一个密钥就够。'
      />
      <div className='ns-setup'>
        <ol className='ns-steps'>
          <li>
            <span className='ns-num' aria-hidden='true'>
              1
            </span>
            <div>
              <h3>注册账号</h3>
              <p>
                邮箱、GitHub 或 Google 都能注册。
                {props.starter && `${starterText(props.starter)}。`}
              </p>
              {props.isAuthenticated ? (
                <Link
                  to='/wallet'
                  search={{ tab: 'topup' }}
                  className='ns-text-link'
                >
                  去充值 →
                </Link>
              ) : (
                <Link
                  to='/sign-up'
                  onClick={props.authClick('sign-up')}
                  className='ns-text-link'
                >
                  注册 →
                </Link>
              )}
            </div>
          </li>
          <li>
            <span className='ns-num' aria-hidden='true'>
              2
            </span>
            <div>
              <h3>创建 API 密钥</h3>
              <p>在控制台的 API 密钥页新建一个，复制 sk- 开头的密钥。</p>
              <Link
                to='/keys'
                onClick={props.authClick('sign-in')}
                className='ns-text-link'
              >
                去创建 →
              </Link>
            </div>
          </li>
          <li>
            <span className='ns-num' aria-hidden='true'>
              3
            </span>
            <div>
              <h3>填进 {tool.label}</h3>
              <p>
                <WithCode text={tool.how} />
                发出第一条请求后，用量会出现在使用日志里。
              </p>
              <a href={tool.guide} className='ns-text-link'>
                {tool.label} 完整教程 →
              </a>
            </div>
          </li>
        </ol>

        <div className='ns-card ns-code-card'>
          <div className='ns-code-bar'>
            <div
              ref={tabList}
              role='tablist'
              aria-label='工具'
              data-overflow={tabOverflow}
              className={cn(
                'ns-tabs',
                'data-[overflow=start]:[mask-image:linear-gradient(to_right,transparent,#000_28px)]',
                'data-[overflow=end]:[mask-image:linear-gradient(to_left,transparent,#000_28px)]',
                'data-[overflow=both]:[mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%-28px),transparent)]'
              )}
              onKeyDown={onTabKey}
            >
              {SETUP_TOOLS.map((item, index) => (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabs.current[index] = el
                  }}
                  type='button'
                  role='tab'
                  id={`ns-tab-${item.id}`}
                  aria-selected={item.id === tool.id}
                  aria-controls='ns-code-panel'
                  tabIndex={item.id === tool.id ? 0 : -1}
                  onClick={() => setToolId(item.id)}
                >
                  <span aria-hidden='true'>{getLobeIcon(item.icon, 16)}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {lines.length > 1 && (
            <div className='ns-lines' role='group' aria-label='线路'>
              <span>线路</span>
              {lines.map((item) => (
                <button
                  key={item.url}
                  type='button'
                  aria-pressed={item.url === line.url}
                  title={item.note || item.url}
                  onClick={() => setLineUrl(item.url)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          <div
            id='ns-code-panel'
            role='tabpanel'
            aria-labelledby={`ns-tab-${tool.id}`}
            className='ns-code'
          >
            <div className='ns-code-file'>
              <code translate='no'>{tool.file}</code>
              <button
                type='button'
                onClick={copySnippet.copy}
                aria-live='polite'
              >
                {copySnippet.label}
              </button>
            </div>
            <Snippet tool={tool} code={snippet} />
          </div>
          <p className='ns-code-note'>{tool.note}</p>
        </div>
      </div>
    </section>
  )
}

function Prices(props: {
  isAuthenticated: boolean
  authClick: AuthClick
  deal: Deal | null
  priceRate: number
  starter: StarterOffer | null
  tiers: TiersOffer | null
  invite: InviteOffer | null
}) {
  const { models } = usePricingData()
  const rows = useMemo(() => {
    const priced = (models ?? []).flatMap((model) => {
      if (isImageModel(model)) return []
      const price = headlinePrice(model)
      return price ? [{ model, price }] : []
    })
    const featured = FEATURED_MODELS.flatMap((name) =>
      priced.filter((row) => row.model.model_name === name)
    )
    return (featured.length >= 4 ? featured : priced).slice(0, 6)
  }, [models])

  // the tiers a payment really reaches, as on the 活动 page
  const tiers = props.tiers?.rows ?? []
  const bonusDays = props.tiers?.days ?? 0
  const perks: string[] = []
  if (props.starter) {
    perks.push(`${starterText(props.starter)}（${props.starter.days} 天）。`)
  }
  // one tier fits in a sentence; more get a row of tags of their own
  if (tiers.length === 1) {
    perks.push(
      `单笔满 ${yuan(tiers[0].pay, 'zh-CN')} 送 ${percent(tiers[0].rate)}% 额度。`
    )
  }
  if (props.invite) {
    perks.push(
      `邀请朋友注册，你得 $${USD.format(props.invite.inviter)}，朋友得 $${USD.format(props.invite.invitee)}。`
    )
  }
  perks.push('支付宝、微信扫码付款，通常十几秒到账。')

  return (
    <section className='ns-band' aria-labelledby='ns-price-title'>
      <SectionHead
        id='ns-price-title'
        eyebrow='价格'
        title={['用多少', '付多少']}
        lead={`没有订阅，没有月费。${props.deal ? `按官方美元价扣费，充值 ¥1 得 $${props.deal.credit} 额度。` : '按官方美元价扣费。'}`}
      />
      <div className='ns-prices'>
        <div className='ns-card ns-offer'>
          <h3>充值</h3>
          {props.deal ? (
            <>
              <p className='ns-offer-big'>¥1 = ${props.deal.credit}</p>
              <p className='ns-offer-sub'>
                实付约是官方价的 {props.deal.share}（按 $1 = ¥{props.deal.rate}{' '}
                计）
              </p>
            </>
          ) : (
            <p className='ns-offer-sub'>余额按美元计，用多少扣多少。</p>
          )}
          {tiers.length > 1 && (
            <div className='ns-tiers'>
              <p className='ns-tiers-head'>
                <span id='ns-tiers-title'>单笔充值满额加送</span>
                {bonusDays > 0 && <span>加送的额度 {bonusDays} 天内有效</span>}
              </p>
              <ul aria-labelledby='ns-tiers-title'>
                {tiers.map((tier) => (
                  <li key={tier.pay}>
                    <b>{yuan(tier.pay, 'zh-CN')}</b>
                    <span>送 {percent(tier.rate)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className='ns-perks'>
            {perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
          <div className='ns-card-foot'>
            {props.isAuthenticated ? (
              <Link
                to='/wallet'
                search={{ tab: 'topup' }}
                className='ns-pill ns-pill-solid ns-pill-sm'
              >
                去充值
              </Link>
            ) : (
              <Link
                to='/sign-up'
                onClick={props.authClick('sign-up')}
                className='ns-pill ns-pill-solid ns-pill-sm'
              >
                注册后充值
              </Link>
            )}
            <Link to='/activity' className='ns-text-link'>
              全部活动 →
            </Link>
          </div>
        </div>
        <div className='ns-card ns-price-table'>
          <h3>模型价格</h3>
          <p className='ns-card-sub'>
            单位：美元 / 百万 Token{props.deal ? '，下面一行是折合人民币' : ''}
          </p>
          {rows.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th scope='col'>模型</th>
                  <th scope='col'>输入</th>
                  <th scope='col'>输出</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ model, price }) => (
                  <tr key={model.model_name}>
                    <th scope='row'>
                      <span className='ns-model'>
                        <span aria-hidden='true' className='ns-logo-icon'>
                          {getLobeIcon(
                            model.icon || model.vendor_icon || '',
                            16
                          )}
                        </span>
                        <code translate='no'>{model.model_name}</code>
                      </span>
                    </th>
                    {[price.input, price.output].map((usd, index) => (
                      <td key={index === 0 ? 'in' : 'out'}>
                        ${USD.format(usd)}
                        {props.deal && (
                          <span>≈ {formatYuan(usd, props.priceRate)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className='ns-card-sub'>价格加载中…</p>
          )}
          <div className='ns-card-foot'>
            <Link to='/pricing' className='ns-text-link'>
              查看全部模型 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Questions(props: { deal: Deal | null }) {
  return (
    <section className='ns-band ns-faq' aria-labelledby='ns-faq-title'>
      <SectionHead
        id='ns-faq-title'
        eyebrow='常见问题'
        title={['接入之前', '常被问到的']}
      />
      <div className='ns-faq-list'>
        {faqs(props.deal).map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>
              {item.a}
              {item.href && (
                <>
                  {' '}
                  <a href={item.href}>{item.link} →</a>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
      <p className='ns-faq-more'>
        <a href='/docs/faq/'>更多问题见文档 →</a>
      </p>
    </section>
  )
}

/**
 * Under the first screen, over the same night sea held still behind the
 * page: the models and tools, why, how to connect, prices and questions.
 */
export function HomeSections(props: HomeSectionsProps) {
  const { status } = useStatus()
  const deal = readDeal(status?.price, status?.usd_exchange_rate)
  const priceRate = Number(status?.price) || 0
  // the same offers as the 活动 page
  const offers = useHomeOffers()
  const starter = offerOf(offers, 'starter')

  return (
    <div className='ns-sections' id='ns-more'>
      {props.gateway ?? <Logos />}
      <Why name={props.name} deal={deal} url={window.location.origin} />
      <Setup
        isAuthenticated={props.isAuthenticated}
        authClick={props.authClick}
        starter={starter}
      />
      <Prices
        isAuthenticated={props.isAuthenticated}
        authClick={props.authClick}
        deal={deal}
        priceRate={priceRate}
        starter={starter}
        tiers={offerOf(offers, 'tiers')}
        invite={offerOf(offers, 'invite')}
      />
      <Questions deal={deal} />
    </div>
  )
}

/**
 * The last screen, like the first: the way in, in the sky above the boat,
 * and the footer on the sea.
 */
export function HomeEnd(props: HomeSectionsProps) {
  return (
    <div className='ns-end'>
      <section className='ns-band ns-closing' aria-labelledby='ns-end-title'>
        <h2 id='ns-end-title' className='ns-h2'>
          <Phrases text={['小船已经备好', '星海等你出发']} />
        </h2>
        <p className='ns-lead'>
          注册账号，创建密钥，几分钟就能跑通第一条请求。
        </p>
        <div className='ns-actions-end'>
          <Link
            to={props.isAuthenticated ? '/dashboard' : '/sign-up'}
            onClick={props.authClick('sign-up')}
            className='ns-pill ns-pill-solid'
          >
            开始使用
          </Link>
          <a href='/docs/' className='ns-pill ns-pill-quiet'>
            阅读文档
          </a>
        </div>
      </section>
      <footer className='ns-foot'>
        <nav aria-label='页脚' className='ns-foot-links'>
          <Link to='/pricing'>模型广场</Link>
          <Link to='/activity'>活动</Link>
          <a href='/docs/'>文档</a>
          <a href='/docs/changelog/'>更新日志</a>
        </nav>
        <p className='ns-legal'>
          <span>
            © {new Date().getFullYear()} {props.name}
          </span>
          <LegalLinks leadingSeparator />
          <span aria-hidden='true' className='ns-legal-sep'>
            ·
          </span>
          <ProjectAttribution />
        </p>
        {props.skyCredit && (
          <p className='ns-credit'>
            星图：NASA/Goddard SVS，ESA Gaia、Hipparcos · 地球夜景：NASA Earth
            Observatory
          </p>
        )}
      </footer>
    </div>
  )
}
