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
import { ArrowRight, ExternalLink, Info, Sparkles, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { IMAGE_MODEL_META } from '../../constants'
import type { GalleryItem } from '../../data/gallery'
import { estimatePicture } from '../../lib/engine'
import { ModelIcon } from '../model-icon'
import { foreignModel } from './gallery-item'
import { GalleryPrompt } from './gallery-prompt'

function Media(props: { item: GalleryItem }) {
  const { t } = useTranslation()
  const it = props.item
  const big = it.coverLarge || it.cover
  if (it.before) {
    return (
      <div className='bd-gd-ba'>
        <figure>
          <img src={it.beforeLarge || it.before} alt={t('Original')} />
          <figcaption>{t('Original')}</figcaption>
        </figure>
        <ArrowRight className='bd-gd-arrow' aria-hidden='true' />
        <figure>
          <img src={big} alt={t('The result')} />
          <figcaption>{t('The result')}</figcaption>
        </figure>
      </div>
    )
  }
  return (
    <div className='bd-gd-one'>
      <img src={big} alt={it.title} />
    </div>
  )
}

function Credit(props: { item: GalleryItem }) {
  const { t } = useTranslation()
  const it = props.item
  const author = it.author?.name || t('Unknown')
  return (
    <p className='bd-gd-credit'>
      {t('Author')}{' '}
      {it.author?.url ? (
        <a href={it.author.url} target='_blank' rel='noreferrer'>
          {author}
        </a>
      ) : (
        author
      )}
      {it.post && (
        <>
          {' · '}
          <a href={it.post} target='_blank' rel='noreferrer'>
            {t('Original post')}
            <ExternalLink aria-hidden='true' />
          </a>
        </>
      )}
      <br />
      {t('Collected in')}{' '}
      <a href={it.url || it.repoUrl} target='_blank' rel='noreferrer'>
        {it.repo}
      </a>
      {it.license ? ` (${it.license})` : ''}
    </p>
  )
}

function Body(props: {
  item: GalleryItem
  onUse: (item: GalleryItem) => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const model = useBearDrawStore((s) => s.prefs.image)
  const it = props.item
  const usd = estimatePicture(model, {
    edit: it.needsPhoto,
    refs: it.needsPhoto ? 1 : 0,
    transparent: false,
  })
  const foreign = foreignModel(it)

  return (
    <div className='bd-gd'>
      <div className='bd-gd-l'>
        <Media item={it} />
        {it.more.length > 0 && (
          <div className='bd-gd-more'>
            {it.more.map((src) => (
              <img key={src} src={src} alt='' loading='lazy' />
            ))}
          </div>
        )}
      </div>
      <div className='bd-gd-r'>
        <div className='bd-gd-tags'>
          <span className='bd-tag'>{it.category}</span>
          {it.needsPhoto && (
            <span className='bd-tag bd-tag-accent'>
              <Upload aria-hidden='true' />
              {t('Needs your photo')}
            </span>
          )}
        </div>
        <DialogTitle className='bd-gd-title'>{it.title}</DialogTitle>
        {it.why ? (
          <DialogDescription className='bd-gd-why'>{it.why}</DialogDescription>
        ) : null}
        <GalleryPrompt item={it} />
        <dl className='bd-gd-meta'>
          <dt>{t('Aspect ratio')}</dt>
          <dd>{it.ratio === 'auto' ? t('Follows the original') : it.ratio}</dd>
          <dt>{t('Model')}</dt>
          <dd>
            <ModelIcon model={model} size={14} />
            {IMAGE_MODEL_META[model]?.name ?? model}
          </dd>
          {usd != null && (
            <>
              <dt>{t('Roughly')}</dt>
              <dd>
                {t('{{price}} per picture; failed ones are free', {
                  price: money.cost(usd),
                })}
              </dd>
            </>
          )}
        </dl>
        {foreign && (
          <p className='bd-gd-note'>
            <Info aria-hidden='true' />
            {t(
              'This one was written for {{model}}; gpt-image draws it a little differently.',
              { model: foreign }
            )}
          </p>
        )}
        <Credit item={it} />
        <div className='bd-gd-go'>
          <Button
            type='button'
            className='bd-btn-ink bd-gd-use'
            onClick={() => props.onUse(it)}
          >
            <Sparkles aria-hidden='true' />
            {t('Use this prompt')}
          </Button>
          {it.needsPhoto && (
            <span className='bd-muted'>
              {t('Next, upload your photo first')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

type GalleryDetailProps = {
  /** Kept after closing, so the dialog fades out with its content. */
  item: GalleryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUse: (item: GalleryItem) => void
}

/** A 玩法 in full: the picture, its prompt, where it comes from. */
export function GalleryDetail(props: GalleryDetailProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='bd-pop bd-dlg bd-dlg-xl bd-dlg-gal'>
        {props.item && <Body item={props.item} onUse={props.onUse} />}
      </DialogContent>
    </Dialog>
  )
}
