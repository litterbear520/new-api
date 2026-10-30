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

/** The block bear from the site logo, drawn on a 24 × 24 grid. */
export function BearMark() {
  return (
    <>
      <path
        fill='#D97757'
        d='M3 6h18v12.08H3zM4.5 18h3v3h-3zM16.5 18h3v3h-3zM0 11.95h3v3.1H0zM21 11.95h3v3.1h-3zM3 4.5h6V6H3zM4.5 3h3v1.5h-3zM15 4.5h6V6h-6zM16.5 3h3v1.5h-3z'
      />
      <path fill='#EFA585' d='M4.5 4.5h3V6h-3zM16.5 4.5h3V6h-3z' />
      <path fill='#FBE9DA' d='M9.75 11.95h4.5v3.1h-4.5z' />
      <path
        fill='#1F1A17'
        d='M6 9.1h1.488v2.85H6zM16.51 9.1h1.49v2.85h-1.49zM10.875 11.95h2.25v1.35h-2.25z'
      />
    </>
  )
}
