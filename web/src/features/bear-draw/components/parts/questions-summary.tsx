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
import { MessageCircleQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AgentStatus, Part } from '../../types'

type QuestionsPart = Extract<Part, { type: 'questions' }>

/** The card once it is answered, skipped or no longer waiting. */
export function QuestionsSummary(props: {
  part: QuestionsPart
  status: AgentStatus
}) {
  const { t } = useTranslation()
  const given = (props.part.answers ?? [])
    .map((a) => a.answer.trim())
    .filter(Boolean)
  let text = t('Did not answer the questions')
  if (given.length) {
    text = t('Your answers: {{answers}}', { answers: given.join(' · ') })
  } else if (props.part.skipped && props.status !== 'stopped') {
    text = t('Skipped the questions; going with the usual choices')
  }
  return (
    <div className='bd-qa-done'>
      <MessageCircleQuestionMark className='bd-qa-done-i' aria-hidden='true' />
      <span>{text}</span>
    </div>
  )
}
