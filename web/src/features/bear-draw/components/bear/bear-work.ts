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

import type { BearAct } from '@/features/bear-chat/lib/bear/acts'

import type { AgentStatus, LiveState } from '../../types'

export type Phase = LiveState['phase']

/** What the bear does in each phase of the agent's work. */
export const PHASE_ACT: Record<Phase, BearAct> = {
  think: 'think',
  skill: 'book',
  look: 'read',
  write: 'write',
  plan: 'write',
  draw: 'wand',
  wait: 'bell',
}

/**
 * The words next to the bear. Thinking gets plainer the longer it lasts
 * (10 s, 45 s, 60 s, like the chat page); a picture just takes its time.
 */
export function statusLabel(t: TFunction, phase: Phase, secs: number): string {
  switch (phase) {
    case 'think':
      if (secs >= 60) return t('Seems stuck; you can stop and try again')
      if (secs >= 45) return t('Deep in thought')
      if (secs >= 10) return t('Still thinking')
      return t('Thinking')
    case 'skill':
      return t('Reading the skill')
    case 'look':
      return t('Looking at your pictures')
    case 'write':
      return t('Writing')
    case 'plan':
      return t('Writing the plan')
    case 'draw':
      return t('Drawing now')
    case 'wait':
      return t('Waiting for your reply')
  }
}

/** How a run ended, for the bear's last act; null when it is unclear. */
export function endOf(
  status: AgentStatus | undefined
): 'done' | 'stopped' | 'error' | null {
  if (status === 'done' || status === 'stopped') return status
  if (status === 'error' || status === 'lost') return 'error'
  return null
}
