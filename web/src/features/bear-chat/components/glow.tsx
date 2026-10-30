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
 * The composer's light (F3): while you type, a sweet pink-lavender-blue rim
 * drifts left and right (Gemini); while the model works, Google's
 * four-colour light turns with an eased speed. One layer sits behind the
 * glass (blurred), one on top (a crisp ring).
 */

function Spinners() {
  return (
    <>
      <i className='bc-spin bc-v05-c b' />
      <i className='bc-spin bc-v05-c g' />
      <i className='bc-spin bc-v05-c y' />
      <i className='bc-spin bc-v05-c r' />
    </>
  )
}

export function GlowBack() {
  return (
    <div className='bc-glow bc-g-back' aria-hidden='true'>
      <div className='bc-g-focus bc-v01'>
        <div className='bc-v01-g'>
          <div className='bc-rm bc-v01-gi'>
            <i className='bc-v01-strip' />
          </div>
        </div>
      </div>
      <div className='bc-g-work bc-v05'>
        <div className='bc-v05-gw'>
          <div className='bc-rm bc-v05-gr'>
            <Spinners />
          </div>
        </div>
      </div>
    </div>
  )
}

export function GlowFront() {
  return (
    <div className='bc-glow bc-g-front' aria-hidden='true'>
      <div className='bc-g-focus bc-v01'>
        <div className='bc-rm bc-v01-r'>
          <i className='bc-v01-strip' />
        </div>
      </div>
      <div className='bc-g-work bc-v05'>
        <div className='bc-rm bc-v05-rr'>
          <Spinners />
        </div>
      </div>
    </div>
  )
}
