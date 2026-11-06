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
import type { TFunction } from 'i18next'

import type { DrawRatio } from './types'

/** Name of the API token the page creates for itself; the docs quote it. */
export const DRAW_TOKEN_NAME = '网页画图'
/** The docs page for this page. */
export const DRAW_GUIDE_URL = '/docs/draw/'

/** Pictures drawing at once; more wait in a queue. */
export const MAX_PENDING = 3
export const MAX_IMAGES = 4
/** One message is split into at most this many pictures. */
export const MAX_SPLIT = 4
/** From this many pictures the plan waits for 开始画. */
export const CONFIRM_FROM = 3
/**
 * The planner gets this long; then the request is drawn as one picture.
 * From China a plan with a picture took 4.7 s (2026-10-25).
 */
export const PLAN_TIMEOUT_MS = 8000
export const MARK_NUMBERS = '①②③④⑤⑥⑦⑧'
/** How long the finished picture takes to ripple in. */
export const REVEAL_MS = 1450
export const CHAT_MIN_WIDTH = 320
export const CHAT_MAX_WIDTH = 560
export const NARROW_WIDTH = 820

export const DEFAULT_MODEL = 'gpt-image-2.6-sunburst'

/** Names for the image models we know; other image models show their id. */
export const MODEL_META: Record<
  string,
  { name: string; tag?: 'recommended'; desc: string }
> = {
  'gpt-image-2.6-sunburst': {
    name: 'Sunburst 2.6',
    tag: 'recommended',
    desc: 'Positioned by OpenAI for quality and consistent edits',
  },
  'gpt-image-2.6-flare': {
    name: 'Flare 2.6',
    desc: 'Positioned by OpenAI for speed',
  },
  'gpt-image-2.5-sunburst': {
    name: 'Sunburst 2.5',
    desc: 'Previous generation',
  },
  'gpt-image-2.5-flare': {
    name: 'Flare 2.5',
    desc: 'Positioned by OpenAI for speed',
  },
  'gpt-image-2': { name: 'Image 2', desc: 'Previous generation' },
}

/**
 * Cheap chat models that write the "↳" suggestions (first available wins)
 * and plan how many pictures a message asks for (tried in this order).
 */
export const SUGGEST_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3-flash',
  'gpt-6-luna',
]

/**
 * Typical token counts measured on 小熊API, used only for the estimate before
 * sending. The real cost comes from the usage in the reply. The outputs are
 * the 2026-10-19 low-quality counts × 1.75, the medium/low ratio measured on
 * 2026-10-31 (601 / 343 at 1536x1024); clear is the 10-19 count under
 * quality auto. edit is the median output of the 61 live pictures drawn
 * from an input picture between 2026-10-31 and 11-06 (mean 1573).
 */
/**
 * Sent with every picture request. Through CLIProxyAPI the Codex image tool
 * gives at most medium (asking for high returned medium, 2026-10-31), and
 * auto chose low for simple prompts. moderation low is 小熊's choice: fewer
 * false refusals; OpenAI's usage policies still apply.
 */
export const IMAGE_QUALITY = 'medium'
export const IMAGE_MODERATION = 'low'

export const TYPICAL_TOKENS = {
  text: 80,
  inputImage: 1521,
  output: { auto: 601, square: 901, land: 527, port: 527 } as Record<
    DrawRatio,
    number
  >,
  clear: 2058,
  edit: 1372,
}

export const RATIO_HINT: Record<DrawRatio, string> = {
  auto: '',
  square: 'Aspect ratio 1:1 (square).',
  land: 'Aspect ratio 16:9 (landscape).',
  port: 'Aspect ratio 9:16 (portrait).',
}

/** Width and height of the little shape icon for each ratio. */
export const RATIO_SHAPE: Record<DrawRatio, [number, number, boolean?]> = {
  auto: [14, 14, true],
  square: [13, 13],
  land: [16, 9],
  port: [9, 16],
}

/** Aspect ratio of the waiting frame before the size is known. */
export function ratioAspect(
  ratio: DrawRatio,
  clear: boolean
): [number, number] {
  if (clear || ratio === 'square') return [1, 1]
  if (ratio === 'port') return [9, 16]
  if (ratio === 'land') return [16, 9]
  return [3, 2]
}

export const STORAGE_KEYS = {
  canvas: 'draw.canvas',
  chatWidth: 'draw.chatW',
  alert: 'draw.alert',
  key: 'draw.key',
} as const

export function getRatioOptions(t: TFunction) {
  return [
    {
      id: 'auto',
      label: t('Auto'),
      name: t('Auto'),
      hint: t('The model decides'),
    },
    {
      id: 'square',
      label: t('Square'),
      name: t('Square 1:1'),
      hint: t('Avatars, product shots'),
    },
    {
      id: 'land',
      label: t('Landscape'),
      name: t('Landscape 16:9'),
      hint: t('Covers, desktop wallpapers'),
    },
    {
      id: 'port',
      label: t('Portrait'),
      name: t('Portrait 9:16'),
      hint: t('Phone wallpapers, posters'),
    },
  ] satisfies Array<{
    id: DrawRatio
    label: string
    name: string
    hint: string
  }>
}

export type DrawIdea = { text: string; ratio: DrawRatio; clear?: boolean }

export function getIdeas(
  t: TFunction
): Array<{ id: string; label: string; items: DrawIdea[] }> {
  return [
    {
      id: 'avatar',
      label: t('Avatar'),
      items: [
        {
          text: t(
            'A flat-illustration orange cat avatar, warm yellow background, clean lines'
          ),
          ratio: 'square',
        },
        {
          text: t(
            'A shiba inu wearing headphones, 3D cartoon style, light blue background'
          ),
          ratio: 'square',
        },
        {
          text: t(
            'A watercolour side portrait of a girl in soft morning light'
          ),
          ratio: 'square',
        },
      ],
    },
    {
      id: 'phone',
      label: t('Phone wallpaper'),
      items: [
        {
          text: t(
            'A cyberpunk street on a rainy night, neon signs reflected in puddles, cinematic'
          ),
          ratio: 'port',
        },
        {
          text: t(
            'A little bear rowing a boat seen from behind, blue scarf, harbour lights far away'
          ),
          ratio: 'port',
        },
        {
          text: t(
            'Minimalist mountain silhouettes under a gradient sunset sky'
          ),
          ratio: 'port',
        },
      ],
    },
    {
      id: 'sticker',
      label: t('Transparent sticker'),
      items: [
        {
          text: t(
            'A happy waving bear sticker, thick white outline, cute cartoon style'
          ),
          ratio: 'square',
          clear: true,
        },
        {
          text: t('A thumbs-up orange cat emoji, white outline'),
          ratio: 'square',
          clear: true,
        },
        {
          text: t('A round red stamp sticker that says "Got it"'),
          ratio: 'square',
          clear: true,
        },
      ],
    },
    {
      id: 'poster',
      label: t('Poster'),
      items: [
        {
          text: t(
            'A retro movie poster: a little bear under a lighthouse looking up at the stars, title "The sea is so big"'
          ),
          ratio: 'port',
        },
        {
          text: t(
            'A coffee shop opening poster, warm colours, title "Open today", space for text at the bottom'
          ),
          ratio: 'port',
        },
        {
          text: t(
            'A music festival poster, neon gradient, big title "Summer Night"'
          ),
          ratio: 'port',
        },
      ],
    },
    {
      id: 'product',
      label: t('Product shot'),
      items: [
        {
          text: t(
            'A pair of white sneakers floating on a soft pink-blue gradient, commercial product photo'
          ),
          ratio: 'square',
        },
        {
          text: t(
            'A steaming latte on a wooden table, early window light, film look'
          ),
          ratio: 'square',
        },
        {
          text: t(
            'A perfume bottle on white marble, soft side light, minimal composition'
          ),
          ratio: 'square',
        },
      ],
    },
  ]
}

/** Rotating examples in the empty box on the new-conversation page. */
export function getPhrases(t: TFunction): string[] {
  return [
    t('A little bear in a blue scarf building a snowman'),
    t('A cosy café menu poster in handwritten type'),
    t('Turn my cat into a watercolour (paste the photo first)'),
    t('A minimalist mountain phone wallpaper, sunset gradient'),
    t('A waving bear sticker with a transparent background'),
    t('A neon street on a rainy night, signs reflected in puddles'),
  ]
}

/** Playful lines while a new picture draws; zh and en only, other languages show the English. */
export function getNewLines(t: TFunction): string[] {
  return [
    t('The little boat is heading out…'),
    t('The moon is rising, just a moment'),
    t('The stars are coming out one by one…'),
    t('Mixing the paints…'),
    t('The waves are big, but the boat holds steady'),
    t('Sprinkling a little moonlight on the sea'),
    t("The bear is concentrating, don't rush it"),
    t('The sea is big, the boat rows slowly'),
  ]
}

export function getEditLines(t: TFunction): string[] {
  return [
    t('Carefully editing from the original…'),
    t('The bear is lining up the eraser…'),
    t('The circled areas come first'),
    t('Good work takes a little time'),
    t('Matching the colours…'),
    t('Everything else stays as it was'),
  ]
}

export function getTips(t: TFunction): string[] {
  return [
    t('Use “Circle” to mark an area and change only that'),
    t('Say “keep everything else the same” for smaller changes'),
    t('Paste or drop a picture to use it as a reference'),
    t('You can keep sending while drawing, up to {{count}} at once', {
      count: MAX_PENDING,
    }),
    t('After it is done, use “Compare” and drag the line to see what changed'),
    t('Right-click a picture to download it, copy it or use it as a reference'),
    t('Press ← → to move between the pictures in this conversation'),
    t(
      'Landscape and portrait cost the least, transparent backgrounds the most'
    ),
  ]
}
