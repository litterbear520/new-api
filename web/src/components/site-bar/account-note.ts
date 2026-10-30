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
 * Who is signed in, as the docs' copy of the site bar shows it. The docs are
 * a separate site on the same domain: they cannot ask the server without
 * spending a session refresh (rate limited per IP) on every page, so the
 * console leaves this note in localStorage. It holds what the bar displays
 * and nothing that signs anyone in; the docs also check the server's
 * session-hint cookie before trusting it.
 */
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { ROLE } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'

export const ACCOUNT_NOTE_KEY = 'newapi:site-bar:v1:account'

export type AccountNote = {
  name: string
  /** The line under the name in the account menu: role, group. */
  detail: string
  avatar: { text: string; background: string }
  superAdmin: boolean
}

export function writeAccountNote(note: AccountNote | null) {
  try {
    if (note) localStorage.setItem(ACCOUNT_NOTE_KEY, JSON.stringify(note))
    else localStorage.removeItem(ACCOUNT_NOTE_KEY)
  } catch {
    // Storage blocked: the docs show 登录 instead of the avatar.
  }
}

/**
 * The account as the avatar menu shows it: the name, the line under it,
 * the avatar letter and colour. The console's AccountMenu and the note for
 * the docs both draw from this, so the two avatars always match.
 */
export function describeAccount(
  user: AuthUser,
  display: { displayName: string; roleLabel: string }
): AccountNote {
  const avatarName = user.username || display.displayName
  return {
    name: display.displayName,
    detail: [display.roleLabel, user.group && String(user.group)]
      .filter(Boolean)
      .join(' · '),
    avatar: {
      text: getUserAvatarFallback(avatarName),
      background: String(getUserAvatarStyle(avatarName).backgroundColor),
    },
    superAdmin: user.role === ROLE.SUPER_ADMIN,
  }
}
