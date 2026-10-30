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
import type { AgentStatus, Part } from '../../types'
import { ErrorPart } from './error-part'
import { PlanCard } from './plan-card'
import { ProgressGrid } from './progress-grid'
import { QuestionsCard } from './questions-card'
import { ResultPart } from './result-part'
import { StatusPart } from './status-part'
import { TextPart } from './text-part'

/** One part of an agent message, in the order the engine wrote them. */
export function PartView(props: {
  projectId: string
  messageId: string
  /** Status of the agent message: cards only take answers while it waits. */
  status: AgentStatus
  part: Part
}) {
  const part = props.part
  switch (part.type) {
    case 'status':
      return <StatusPart icon={part.icon} text={part.text} live={part.live} />
    case 'text':
      return <TextPart text={part.text} streaming={part.streaming} />
    case 'questions':
      return (
        <QuestionsCard
          projectId={props.projectId}
          part={part}
          status={props.status}
        />
      )
    case 'plan':
      return (
        <PlanCard
          projectId={props.projectId}
          part={part}
          status={props.status}
        />
      )
    case 'progress':
      return <ProgressGrid projectId={props.projectId} part={part} />
    case 'result':
      return <ResultPart part={part} />
    case 'error':
      return (
        <ErrorPart
          projectId={props.projectId}
          messageId={props.messageId}
          part={part}
        />
      )
    default:
      return null
  }
}
