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
import { Box, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import {
  CURRENT_IMAGE_MODELS,
  DEFAULT_BRAIN,
  IMAGE_MODEL_META,
} from '../../constants'
import {
  useBearDrawEnv,
  type BrainModelOption,
  type ImageModelOption,
} from '../../hooks/use-env'
import { estimatePicture } from '../../lib/engine'
import { ModelIcon } from '../model-icon'
import { OPEN_EVENT, type ModelMenuAsk } from './model-menu-bus'

const shortName = (id: string, models: ImageModelOption[]) =>
  models.find((m) => m.id === id)?.short ?? IMAGE_MODEL_META[id]?.short ?? id

/** The menu's open state, also opened by `openModelMenu`. */
function useMenuOpen(onAsk?: (ask: ModelMenuAsk) => void) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const ask = (e: Event) => {
      onAsk?.((e as CustomEvent<ModelMenuAsk>).detail ?? {})
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, ask)
    return () => window.removeEventListener(OPEN_EVENT, ask)
  }, [onAsk])
  return [open, setOpen] as const
}

/** A row that unfolds more rows under it (the menu stays open). */
function FoldRow(props: {
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <DropdownMenuItem
      closeOnClick={false}
      className='bd-mi bd-mi-fold'
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <ChevronRight
        className='bd-fold-ar'
        data-open={props.open ? '' : undefined}
        aria-hidden='true'
      />
      {props.children}
    </DropdownMenuItem>
  )
}

function ImageRow(props: { model: ImageModelOption }) {
  const { t } = useTranslation()
  const money = useMoney()
  const transparent = useBearDrawStore((s) => s.prefs.transparent)
  const m = props.model
  const usd = estimatePicture(m.id, { edit: false, refs: 0, transparent })
  return (
    <DropdownMenuRadioItem
      value={m.id}
      closeOnClick={false}
      className='bd-mi bd-mi-radio'
    >
      <ModelIcon model={m.id} size={18} />
      <span className='bd-mi-main'>
        <span className='bd-mi-name'>
          {m.name}
          {m.tag === 'recommended' && (
            <em className='bd-tag'>{t('Recommended')}</em>
          )}
        </span>
        {m.note && <span className='bd-mi-desc'>{t(m.note)}</span>}
      </span>
      {usd != null && (
        <span className='bd-mi-right'>
          {t('≈{{cost}} each', { cost: money.cost(usd) })}
        </span>
      )}
    </DropdownMenuRadioItem>
  )
}

/**
 * The image models as radio items: the current generation, then the older
 * ones folded under 「旧版模型」 (unfolded while one of them is in use).
 */
function ImageModelItems(props: { models: ImageModelOption[] }) {
  const { t } = useTranslation()
  const image = useBearDrawStore((s) => s.prefs.image)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const current = props.models.filter((m) =>
    CURRENT_IMAGE_MODELS.includes(m.id)
  )
  // an account without the current generation sees all it has
  const main = current.length ? current : props.models
  const older = props.models.filter((m) => !main.includes(m))
  const [more, setMore] = useState(() => older.some((m) => m.id === image))
  if (!props.models.length) {
    return <div className='bd-menu-empty'>{t('No image models available')}</div>
  }
  return (
    <DropdownMenuRadioGroup
      value={image}
      onValueChange={(v) => setPrefs({ image: String(v) })}
    >
      {main.map((m) => (
        <ImageRow key={m.id} model={m} />
      ))}
      {older.length > 0 && (
        <FoldRow open={more} onToggle={() => setMore(!more)}>
          {t('Older models')}
        </FoldRow>
      )}
      {more && older.map((m) => <ImageRow key={m.id} model={m} />)}
    </DropdownMenuRadioGroup>
  )
}

/** Image mode: the image model chip 「Sunburst ▾」. */
export function ImageModelMenu() {
  const { t } = useTranslation()
  const env = useBearDrawEnv()
  const image = useBearDrawStore((s) => s.prefs.image)
  const short = shortName(image, env.imageModels)
  const [open, setOpen] = useMenuOpen()
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tip label={t('Image model')}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='bd-chip bd-model-chip'
              aria-label={t('Image model: {{name}}', { name: short })}
            >
              <ModelIcon model={image} size={16} />
              <span>{short}</span>
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='end'
        sideOffset={8}
        className='bd-pop bd-menu w-[min(360px,calc(100vw-24px))]'
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className='bd-menu-h'>
            {t('Image model')}
          </DropdownMenuLabel>
          <ImageModelItems models={env.imageModels} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BrainRow(props: { model: BrainModelOption }) {
  const { t } = useTranslation()
  const m = props.model
  return (
    <DropdownMenuRadioItem
      value={m.id}
      closeOnClick={false}
      className='bd-mi bd-mi-radio'
    >
      <ModelIcon model={m.id} size={18} />
      <span className='bd-mi-main'>
        <span className='bd-mi-name'>
          {m.id}
          {m.tag === 'default' && <em className='bd-tag'>{t('Default')}</em>}
        </span>
        {m.note && <span className='bd-mi-desc'>{t(m.note)}</span>}
      </span>
    </DropdownMenuRadioItem>
  )
}

/**
 * The planner, folded into one row 「思考模型 gpt-6-luna」: the picked ones
 * first, every other chat model under 「更多模型」.
 */
function BrainModels(props: {
  models: BrainModelOption[]
  open: boolean
  onToggle: () => void
  /** A planner was picked (after the store has it). */
  onPicked: () => void
}) {
  const { t } = useTranslation()
  const brain = useBearDrawStore((s) => s.prefs.brain)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const featured = props.models.filter((m) => m.featured)
  const main = featured.length ? featured : props.models
  const rest = props.models.filter((m) => !main.includes(m))
  const [more, setMore] = useState(() => rest.some((m) => m.id === brain))
  if (!props.models.length) {
    return <div className='bd-menu-empty'>{t('No chat models available')}</div>
  }
  return (
    <>
      <FoldRow open={props.open} onToggle={props.onToggle}>
        <span className='bd-mi-main'>{t('Planning model')}</span>
        <span className='bd-mi-right'>{brain}</span>
      </FoldRow>
      {props.open && (
        <DropdownMenuRadioGroup
          value={brain}
          onValueChange={(v) => {
            setPrefs({ brain: String(v) })
            props.onPicked()
          }}
          className='bd-prefs-list'
        >
          {main.map((m) => (
            <BrainRow key={m.id} model={m} />
          ))}
          {rest.length > 0 && (
            <FoldRow open={more} onToggle={() => setMore(!more)}>
              {t('More models')}
            </FoldRow>
          )}
          {more && rest.map((m) => <BrainRow key={m.id} model={m} />)}
        </DropdownMenuRadioGroup>
      )}
    </>
  )
}

/**
 * Agent mode: 模型偏好 (box icon). 「自动」 is on until a model is picked by
 * hand: the page then draws with the recommended image model and plans with
 * the default planner. Below it the image models, and the planner folded
 * into one row.
 */
export function ModelPrefs() {
  const { t } = useTranslation()
  const env = useBearDrawEnv()
  const auto = useBearDrawStore((s) => s.prefs.auto)
  const image = useBearDrawStore((s) => s.prefs.image)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const brain = useBearDrawStore((s) => s.prefs.brain)
  const [brainOpen, setBrainOpen] = useState(false)
  // 「换模型」 on an error card: the pick closes the menu and runs its step
  const [afterPick, setAfterPick] = useState<(() => void) | null>(null)
  const [open, setOpenState] = useMenuOpen((ask) => {
    if (ask.section === 'brain') setBrainOpen(true)
    setAfterPick(() => ask.onPicked ?? null)
  })
  const setOpen = (next: boolean) => {
    setOpenState(next)
    if (!next && afterPick) {
      setAfterPick(null)
      setBrainOpen(false)
    }
  }
  const short = shortName(image, env.imageModels)
  const names = brain === DEFAULT_BRAIN ? short : `${short} · ${brain}`
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tip
        label={
          auto
            ? t('Model preferences: auto')
            : t('Model preferences: {{image}}', { image: names })
        }
      >
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='bd-ib'
              aria-label={t('Model preferences')}
            >
              <Box aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='end'
        sideOffset={8}
        className='bd-pop bd-menu w-[min(380px,calc(100vw-24px))]'
      >
        <DropdownMenuCheckboxItem
          checked={auto}
          closeOnClick={false}
          className='bd-mi bd-prefs-auto'
          onCheckedChange={(on) => setPrefs({ auto: on })}
        >
          <span className='bd-mi-main'>
            <span className='bd-prefs-t'>{t('Model preferences')}</span>
          </span>
          <span className='bd-prefs-auto-l'>{t('Auto')}</span>
          <i className='bd-sw' data-on={auto ? '' : undefined} />
        </DropdownMenuCheckboxItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='bd-menu-h'>
            {t('Image model')}
          </DropdownMenuLabel>
          <ImageModelItems models={env.imageModels} />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <BrainModels
          models={env.brainModels}
          open={brainOpen}
          onToggle={() => setBrainOpen(!brainOpen)}
          onPicked={() => {
            if (!afterPick) return
            const run = afterPick
            setOpen(false)
            run()
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
