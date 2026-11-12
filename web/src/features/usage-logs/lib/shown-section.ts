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
import type { UsageLogsSectionId } from '../section-registry'

/**
 * The tab to show: the one in the URL while it is switched on, else the first
 * that is. With every tab off the URL's one stays (the sidebar hides the entry).
 */
export function shownUsageLogsSection(
  requested: UsageLogsSectionId,
  visible: readonly UsageLogsSectionId[]
): UsageLogsSectionId {
  if (visible.length === 0 || visible.includes(requested)) return requested
  return visible[0]
}
