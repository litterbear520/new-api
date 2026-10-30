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

export type MainLine = {
  /** Sign-in page on the main line, carrying the post-login redirect */
  signInUrl: string
  /** Host shown to the user, e.g. `api.example.com` */
  host: string
}

/**
 * OAuth callbacks are registered for the site's `server_address` only, so a
 * provider started from any other origin fails at the callback. Returns the
 * main line to send the user to, or `null` when the current origin is the main
 * line or no usable server address is configured.
 */
export function getMainLine(
  serverAddress: unknown,
  currentOrigin: string,
  redirectTo?: string
): MainLine | null {
  if (typeof serverAddress !== 'string' || !serverAddress.trim()) return null

  let main: URL
  try {
    main = new URL(serverAddress.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(main.protocol) || main.origin === currentOrigin) {
    return null
  }

  const signIn = new URL('/sign-in', main.origin)
  if (redirectTo) signIn.searchParams.set('redirect', redirectTo)
  return { signInUrl: signIn.toString(), host: main.host }
}
