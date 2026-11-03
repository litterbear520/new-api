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
import { composite, type Layer, type Rgb } from './backdrop'

/** How wide the thumbnails are that pictures are read from. */
const THUMB = 64
/** New thumbnails per reading: the rest wait, so a reading stays cheap. */
const THUMBS_PER_READ = 2
/** What marked elements stand for: `data-bar-backdrop="dark"`. */
export const MARKED: Record<string, Rgb> = {
  dark: [20, 20, 24],
  light: [245, 245, 245],
}

/**
 * Decoding is what a thumbnail costs. A picture from this site can be decoded
 * off the main thread from the bytes in the browser's cache, with no download;
 * another site's can't be asked for that way.
 */
function canDecodeOffThread(src: string): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    new URL(src, location.href).origin === location.origin
  )
}

function newContext(size: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas.getContext('2d', { willReadFrequently: true })
}

type Thumb = {
  src: string
  data: Uint8ClampedArray | null
  /** Still being decoded: `data` follows. */
  decoding: boolean
}

/**
 * Pictures read so far, for every reader on the page: the bar and the strips
 * under it see the same pictures, and reading one back is the dear part.
 */
const thumbs = new WeakMap<HTMLImageElement, Thumb>()

const SOLID = /^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)$/

/**
 * Reads what the page shows at a point, top layer down. Pictures are read from
 * a small thumbnail, kept per picture, and CSS colours once each. What can't be
 * read (a canvas, a video, a gradient, another site's picture) says so with
 * `data-bar-backdrop`, or else counts as the theme's own background.
 */
export class PageReader {
  private readonly colors = new Map<string, Layer | null>()
  /** Turns any CSS colour into pixels. Never draws pictures, so stays readable. */
  private colorContext: CanvasRenderingContext2D | null | undefined
  /** Another site's picture spoils its canvas for good: a new one follows it. */
  private thumbContext: CanvasRenderingContext2D | null | undefined
  private bar: Element | null = null
  private fallback: Rgb = [255, 255, 255]
  /** Each element's own layer, for one reading: most points hit the same ones. */
  private seen = new Map<Element, Layer | null>()
  private newThumbs = 0
  private waiting = false

  /** Pictures were left out of this reading to keep it cheap: read again. */
  get behind(): boolean {
    return this.waiting
  }

  /** The next points are for this bar, over this theme's background. */
  startReading(bar: Element, fallback: Rgb): void {
    this.bar = bar
    this.fallback = fallback
    this.newThumbs = 0
    this.waiting = false
    this.seen = new Map()
  }

  at(x: number, y: number): Rgb {
    const layers: Layer[] = []
    for (const el of document.elementsFromPoint(x, y)) {
      if (this.bar?.contains(el)) continue
      const layer = this.layerOf(el, x, y)
      if (!layer) continue
      layers.push(layer)
      if (layer.alpha >= 0.99) break
    }
    return composite(layers, this.fallback)
  }

  private layerOf(el: Element, x: number, y: number): Layer | null {
    const marked = el.getAttribute('data-bar-backdrop')
    const said = marked ? MARKED[marked] : undefined
    if (el instanceof HTMLImageElement) {
      const color = this.pictureAt(el, x, y) ?? said ?? this.fallback
      return { color, alpha: 1 }
    }
    if (said) return { color: said, alpha: 1 }
    if (el instanceof HTMLCanvasElement || el instanceof HTMLVideoElement) {
      return { color: this.fallback, alpha: 1 }
    }
    return this.ownLayer(el)
  }

  private ownLayer(el: Element): Layer | null {
    let layer = this.seen.get(el)
    if (layer === undefined) {
      const style = getComputedStyle(el)
      layer =
        style.backgroundImage && style.backgroundImage !== 'none'
          ? { color: this.fallback, alpha: 1 }
          : this.cssColor(style.backgroundColor)
      this.seen.set(el, layer)
    }
    return layer
  }

  /** The CSS colour as RGB, or null if it shows nothing. */
  private cssColor(css: string): Layer | null {
    const known = this.colors.get(css)
    if (known !== undefined) return known
    const layer = this.parseColor(css)
    const shown = layer && layer.alpha > 0 ? layer : null
    this.colors.set(css, shown)
    return shown
  }

  private parseColor(css: string): Layer | null {
    const parts = SOLID.exec(css)
    if (parts) {
      return {
        color: [Number(parts[1]), Number(parts[2]), Number(parts[3])],
        alpha: parts[4] === undefined ? 1 : Number(parts[4]),
      }
    }
    // lab(), oklch(), color(): the browser turns them into pixels for us
    this.colorContext ??= newContext(1)
    const g = this.colorContext
    if (!g) return null
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = css
    g.fillRect(0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    return { color: [d[0], d[1], d[2]], alpha: d[3] / 255 }
  }

  /** The picture's colour at the point, or null if it can't be read (yet). */
  private pictureAt(img: HTMLImageElement, x: number, y: number): Rgb | null {
    if (!img.complete || !img.naturalWidth) return null
    const data = this.thumbnail(img)
    if (!data) return null
    const r = img.getBoundingClientRect()
    const cell = (at: number) =>
      Math.min(THUMB - 1, Math.max(0, Math.floor(at * THUMB)))
    const i =
      (cell((y - r.top) / r.height) * THUMB + cell((x - r.left) / r.width)) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }

  private thumbnail(img: HTMLImageElement): Uint8ClampedArray | null {
    const known = thumbs.get(img)
    if (known?.src === img.currentSrc) {
      if (known.decoding) this.waiting = true
      return known.data
    }
    if (this.newThumbs >= THUMBS_PER_READ) {
      this.waiting = true
      return null
    }
    this.newThumbs++
    const thumb: Thumb = { src: img.currentSrc, data: null, decoding: false }
    thumbs.set(img, thumb)
    if (canDecodeOffThread(thumb.src)) {
      thumb.decoding = true
      this.waiting = true
      void this.decodeOffThread(img, thumb)
    } else {
      thumb.data = this.drawThumb(img)
    }
    return thumb.data
  }

  private async decodeOffThread(
    img: HTMLImageElement,
    thumb: Thumb
  ): Promise<void> {
    try {
      const response = await fetch(thumb.src, {
        cache: 'only-if-cached',
        mode: 'same-origin',
      })
      if (!response.ok) throw new Error(String(response.status))
      const small = await createImageBitmap(await response.blob(), {
        resizeWidth: THUMB,
        resizeHeight: THUMB,
      })
      thumb.data = this.drawThumb(small)
      small.close()
    } catch {
      // not in the cache, or an SVG with no bitmap to decode into: the canvas
      // can still draw it
      thumb.data = this.drawThumb(img)
    }
    thumb.decoding = false
  }

  private drawThumb(img: CanvasImageSource): Uint8ClampedArray | null {
    this.thumbContext ??= newContext(THUMB)
    const g = this.thumbContext
    if (!g) return null
    try {
      g.drawImage(img, 0, 0, THUMB, THUMB)
      const data = g.getImageData(0, 0, THUMB, THUMB).data
      g.clearRect(0, 0, THUMB, THUMB)
      return data
    } catch {
      // another site's picture without CORS: this one stays unreadable
      this.thumbContext = undefined
      return null
    }
  }
}
