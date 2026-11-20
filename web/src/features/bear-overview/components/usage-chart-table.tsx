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
import { useTranslation } from 'react-i18next'

import { FAMILY_LABELS, type FamilyKey } from '../constants'
import type { ChartDay } from './usage-chart'

/**
 * The numbers of a usage chart as a table for screen readers: the chart
 * itself is hidden from them. One row per bar, the total first, then one
 * column per model family.
 */
export function UsageChartTable(props: {
  caption: string
  days: ChartDay[]
  families: FamilyKey[]
  format: (value: number) => string
  /** Header of the first column; 「日期」 unless given */
  labelHeader?: string
}) {
  const { t } = useTranslation()
  return (
    <table className='sr-only'>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope='col'>{props.labelHeader ?? t('Date')}</th>
          <th scope='col'>{t('Total')}</th>
          {props.families.map((key) => (
            <th key={key} scope='col'>
              {t(FAMILY_LABELS[key])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.days.map((day) => (
          <tr key={day.label}>
            <th scope='row'>{day.label}</th>
            <td>
              {props.format(
                props.families.reduce(
                  (sum, key) => sum + (day.values[key] ?? 0),
                  0
                )
              )}
            </td>
            {props.families.map((key) => (
              <td key={key}>{props.format(day.values[key] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
