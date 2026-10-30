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

/*
 * The drawing page's own dialogs: 品牌套件, 导入技能, 新建技能, 来源和许可证.
 * Call openDialog() from anywhere; the page renders <DialogHost /> once.
 */
export {
  closeDialog,
  openDialog,
  type DialogKind,
  type NewSkillSeed,
} from './dialog-store'
export { DialogHost } from './dialog-host'
