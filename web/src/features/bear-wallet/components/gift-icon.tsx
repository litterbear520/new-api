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
/**
 * A wrapped present: red box, gold ribbon and bow. Drawn here (not an icon
 * font) so it reads as a gift at a glance in both themes.
 */
export function GiftIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox='0 0 40 40'
      aria-hidden='true'
      focusable='false'
    >
      <path
        d='M20 12.4C17.6 6.6 11.4 4.6 10.2 8.2c-.9 2.8 3.4 4.6 9.8 4.2Z'
        fill='#ffc53d'
        stroke='#d9961f'
        strokeWidth='1'
        strokeLinejoin='round'
      />
      <path
        d='M20 12.4c2.4-5.8 8.6-7.8 9.8-4.2.9 2.8-3.4 4.6-9.8 4.2Z'
        fill='#ffc53d'
        stroke='#d9961f'
        strokeWidth='1'
        strokeLinejoin='round'
      />
      <rect x='7.5' y='19' width='25' height='16' rx='2.5' fill='#dc3e42' />
      <rect x='7.5' y='19' width='25' height='2.2' fill='#000' opacity='.16' />
      <rect x='5.5' y='12.5' width='29' height='7.5' rx='2.2' fill='#ee5a5d' />
      <rect
        x='8'
        y='14.2'
        width='6'
        height='1.6'
        rx='.8'
        fill='#fff'
        opacity='.45'
      />
      <rect x='17.5' y='12.5' width='5' height='22.5' fill='#ffc53d' />
      <rect x='17.5' y='19' width='5' height='2.2' fill='#000' opacity='.12' />
      <circle
        cx='20'
        cy='12.4'
        r='2.4'
        fill='#f5b324'
        stroke='#d9961f'
        strokeWidth='1'
      />
    </svg>
  )
}
