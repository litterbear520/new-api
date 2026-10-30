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
import type { BearMood } from '../../types'
import { LOOP_FOR, ONCE, POKES, type BearAct } from './acts'
import { createBearController, type BearController } from './controller'

/*
 * Everything the bear does on its own or in reply to the user, apart from
 * the work acts the page sets while a reply streams:
 * - idle eggs: the first after 7–12 s, then every 20–32 s, from a pool that
 *   differs by theme (the night sea has stargazing and fishing) and hour
 *   (cocoa in the evening); 12 % of the time it hums instead;
 * - nobody around for 80 s: a yawn, then sleep (still after 30 s more);
 * - typing: ears up and a nod per key; focus on an empty box for 2.5 s: tap;
 * - clicks: a random reaction (ignored while a one-shot plays), 3 quick
 *   clicks sing, 7 bump a coin out of a ? block;
 * - eyes follow the pointer while idle, or a meteor the page shows.
 */

const EGG_FIRST = [7000, 12000] as const
const EGG_NEXT = [20000, 32000] as const
const SING_CHANCE = 0.12
const SLEEP_AFTER = 80_000
const TAP_AFTER = 2500
const WATCH_HOLD = 1700
const POKE_WINDOW = 1600
const LONG_WAIT = 45_000

/** Page event with a meteor's position ({ x, y }); every bear watches it. */
export const METEOR_AT = 'bear-chat:meteor-at'

const between = ([a, b]: readonly [number, number]) =>
  a + Math.random() * (b - a)

export type FinishKind = 'done' | 'stopped' | 'error'

export class BearDirector {
  private readonly ctl: BearController
  private readonly el: SVGSVGElement
  private dark: boolean
  private mood: BearMood
  private busy = false
  private busyAct: BearAct = 'think'
  private busySince = 0
  private eggs = 0
  private pokes = 0
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private disposers: Array<() => void> = []
  private composerFocused = false
  private raf = 0
  private box: DOMRect | null = null
  private boxAt = 0

  constructor(
    el: SVGSVGElement,
    opts: { dark: boolean; mood: BearMood; onAct?: (act: BearAct) => void }
  ) {
    this.el = el
    this.dark = opts.dark
    this.mood = opts.mood
    this.ctl = createBearController(el, { onAct: opts.onAct })
    this.listen()
    this.scheduleEgg(true)
    this.resetSleep()
  }

  get act(): BearAct {
    return this.ctl.act
  }

  private later(name: string, ms: number, fn: () => void) {
    clearTimeout(this.timers.get(name))
    this.timers.set(
      name,
      setTimeout(() => {
        this.timers.delete(name)
        fn()
      }, ms)
    )
  }

  private cancel(name: string) {
    clearTimeout(this.timers.get(name))
    this.timers.delete(name)
  }

  /** Plays an act, unless the bear is quiet or hidden (then only idle). */
  private play(act: BearAct, now = true) {
    if (this.mood !== 'live' && act !== 'idle') return
    this.ctl.set(act, { now })
  }

  /** A looping act that ends on its own, if nothing else replaced it. */
  private playFor(act: BearAct, ms = LOOP_FOR[act] ?? 4000) {
    this.play(act)
    this.later('loop', ms, () => {
      if (!this.busy && this.ctl.act === act) {
        this.ctl.set('idle', { now: true })
      }
    })
  }

  /**
   * The bear's box, read at most every 500 ms: while a meteor flies the eyes
   * follow it every frame, and a fresh read each time forces a layout.
   */
  private rect() {
    const t = performance.now()
    if (!this.box || t - this.boxAt > 500) {
      this.box = this.el.getBoundingClientRect()
      this.boxAt = t
    }
    return this.box
  }

  /** Turns the eyes towards a point on the page (not while out of view). */
  private aim(x: number, y: number) {
    const r = this.rect()
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return
    const k = (v: number) => Math.max(-1, Math.min(1, v / 160)) * 0.45
    this.el.style.setProperty(
      '--ex',
      `${k(x - (r.left + r.width / 2)).toFixed(2)}px`
    )
    this.el.style.setProperty(
      '--ey',
      `${k(y - (r.top + r.height * 0.45)).toFixed(2)}px`
    )
  }

  private listen() {
    const onPointer = (e: PointerEvent) => {
      if (this.raf || this.ctl.act !== 'idle') return
      this.raf = requestAnimationFrame(() => {
        this.raf = 0
        this.aim(e.clientX, e.clientY)
      })
    }
    const onActivity = () => this.resetSleep()
    const onMeteor = (e: Event) => {
      const at = (e as CustomEvent<{ x: number; y: number }>).detail
      if (at) this.gaze(at.x, at.y)
    }
    window.addEventListener(METEOR_AT, onMeteor)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity, { passive: true })
    this.disposers.push(() => {
      window.removeEventListener(METEOR_AT, onMeteor)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      cancelAnimationFrame(this.raf)
    })
  }

  private pool(): BearAct[] {
    const hour = new Date().getHours()
    const evening = hour >= 20 || hour < 6
    if (this.dark) {
      return [
        'stargaze',
        'fish',
        'look',
        'cocoa',
        'stretch',
        'fish',
        'stargaze',
      ]
    }
    return [
      'look',
      'stretch',
      'scratch',
      'waddle',
      ...(evening ? (['cocoa'] as BearAct[]) : []),
      'look',
    ]
  }

  private scheduleEgg(first = false) {
    this.later('egg', between(first ? EGG_FIRST : EGG_NEXT), () => this.egg())
  }

  private egg() {
    const ready =
      !this.busy &&
      this.ctl.act === 'idle' &&
      !this.composerFocused &&
      this.mood === 'live' &&
      !document.hidden
    if (ready) {
      if (Math.random() < SING_CHANCE) {
        this.playFor('sing')
      } else {
        const list = this.pool()
        const act = list[this.eggs++ % list.length]
        if (LOOP_FOR[act]) this.playFor(act)
        else this.play(act)
      }
    }
    this.scheduleEgg()
  }

  private resetSleep() {
    const act = this.ctl.act
    if (act === 'sleep' || act === 'yawn') this.play('tickle')
    this.later('sleep', SLEEP_AFTER, () => {
      const now = this.ctl.act
      if (!this.busy && (now === 'idle' || now === 'look')) this.play('yawn')
    })
  }

  setDark(dark: boolean) {
    if (dark === this.dark) return
    this.dark = dark
    if (!this.busy) this.ctl.set('idle', { now: true })
  }

  setMood(mood: BearMood) {
    this.mood = mood
    if (mood !== 'live') this.ctl.set('idle', { now: true })
  }

  /** The page's work act while a reply is on its way; null when done. */
  setWork(act: BearAct | null, since = Date.now()) {
    if (!act) {
      this.busy = false
      return
    }
    const starting = !this.busy
    if (starting) this.busySince = since
    this.busy = true
    this.cancel('watch')
    this.cancel('tap')
    this.cancel('loop')
    let next = act
    // thinking for a long time: headphones on
    if (act === 'think' && Date.now() - this.busySince >= LONG_WAIT) {
      next = 'phones'
    }
    this.busyAct = next
    // a reaction that just started (a heart for "thanks") plays out first
    if (this.ctl.act !== next) this.play(next, starting && !ONCE[this.ctl.act])
  }

  /** Re-checks the long-wait swap; the page calls it every half second. */
  tick() {
    if (this.busy && this.busyAct === 'think') this.setWork('think')
  }

  /** Before the work starts: a heart for thanks, a blush for praise, a turn for retry. */
  react(act: 'heart' | 'shy' | 'spin'): number {
    if (this.mood !== 'live') return 0
    this.play(act)
    return ONCE[act] ?? 0
  }

  finish(
    kind: FinishKind,
    opts: { waitedMs: number; sing?: boolean; feel?: boolean }
  ) {
    this.busy = false
    if (kind === 'stopped') {
      this.play('startled')
    } else if (kind === 'error') {
      this.playFor('error')
    } else if (opts.waitedMs >= 60_000) {
      this.playFor('flag')
    } else if (opts.waitedMs >= 3000 && !opts.feel) {
      this.play('done', false)
    } else {
      this.ctl.set('idle')
    }
    if (kind === 'done' && opts.sing) {
      this.later('sing', 1700, () => {
        if (!this.busy) this.playFor('sing', 4800)
      })
    }
    this.resetSleep()
    this.scheduleEgg()
  }

  /** The user copied something. */
  thumbs() {
    if (!this.busy) this.play('thumbs')
  }

  typing() {
    if (this.busy) return
    if (this.ctl.act !== 'watch') this.play('watch')
    this.ctl.nod()
    this.later('watch', WATCH_HOLD, () => {
      if (!this.busy && this.ctl.act === 'watch') {
        this.ctl.set('idle', { now: true })
      }
    })
  }

  focus(empty: () => boolean) {
    this.composerFocused = true
    this.later('tap', TAP_AFTER, () => {
      if (
        this.composerFocused &&
        empty() &&
        !this.busy &&
        this.ctl.act === 'idle'
      ) {
        this.play('tap')
      }
    })
  }

  blur() {
    this.composerFocused = false
    this.cancel('tap')
  }

  poke() {
    if (this.busy) return
    this.pokes += 1
    this.later('pokes', POKE_WINDOW, () => {
      this.pokes = 0
    })
    if (this.pokes === 7) {
      this.pokes = 0
      this.play('coin')
    } else if (this.pokes === 3) {
      this.playFor('sing', 4200)
    } else if (this.pokes < 3 && !ONCE[this.ctl.act]) {
      this.play(POKES[Math.floor(Math.random() * POKES.length)])
    }
    this.resetSleep()
  }

  /** Eyes on something passing by (a meteor), while idle. */
  gaze(x: number, y: number) {
    if (this.ctl.act === 'idle') this.aim(x, y)
  }

  /** Plays an act now, e.g. the entrance. */
  show(act: BearAct) {
    this.play(act)
  }

  dispose() {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    this.disposers.forEach((fn) => fn())
    this.ctl.dispose()
  }
}
