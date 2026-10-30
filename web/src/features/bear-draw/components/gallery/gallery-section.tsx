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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { GalleryItem } from '../../data/gallery'
import { GalleryDetail } from './gallery-detail'
import { GalleryWall, WallPlaceholder } from './gallery-wall'
import { useGallery } from './use-gallery'

const ALL = 'all'

/** The 创意 tab of the home feed: one-click prompts from open-source collections, as a wall. */
export function GalleryPanel(props: { onUse: (item: GalleryItem) => void }) {
  const { t } = useTranslation()
  const gallery = useGallery()
  const [cat, setCat] = useState(ALL)
  const [detail, setDetail] = useState<GalleryItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const items = gallery.status === 'ready' ? gallery.data.GALLERY : null
  const cats = gallery.status === 'ready' ? gallery.data.GALLERY_CATEGORIES : []
  const shown = useMemo(
    () => (items ?? []).filter((it) => cat === ALL || it.category === cat),
    [items, cat]
  )

  const onOpen = useCallback((item: GalleryItem) => {
    setDetail(item)
    setDetailOpen(true)
  }, [])
  const onUse = props.onUse
  const apply = useCallback(
    (item: GalleryItem) => {
      setDetailOpen(false)
      onUse(item)
    },
    [onUse]
  )

  return (
    <>
      <p className='bd-muted bd-feed-note'>
        {t(
          'Click one to see its prompt and use it in one go. Collected from open-source prompt collections on GitHub; authors are in the details.'
        )}
      </p>
      {gallery.status === 'loading' && <WallPlaceholder />}
      {gallery.status === 'failed' && (
        <div className='bd-gal-failed' role='alert'>
          <span>{t('The ideas did not load.')}</span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={gallery.retry}
          >
            {t('Try again')}
          </Button>
        </div>
      )}
      {gallery.status === 'ready' && (
        <Tabs
          value={cat}
          onValueChange={(v) => setCat(String(v))}
          className='bd-tabs-root'
        >
          <TabsList
            variant='line'
            className='bd-tabs bd-cats'
            aria-label={t('Idea categories')}
          >
            <TabsTrigger value={ALL} className='bd-tab'>
              {t('All')}
            </TabsTrigger>
            {cats.map((c) => (
              <TabsTrigger key={c} value={c} className='bd-tab'>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={cat} className='bd-tabpanel'>
            <GalleryWall
              key={cat}
              items={shown}
              onOpen={onOpen}
              onUse={apply}
            />
          </TabsContent>
        </Tabs>
      )}
      <GalleryDetail
        item={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUse={apply}
      />
    </>
  )
}
