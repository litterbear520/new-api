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
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SignOutDialog } from '@/components/sign-out-dialog'
import { describeAccount } from '@/components/site-bar/account-note'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog'
import { useUserDisplay } from '@/hooks/use-user-display'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/** The avatar at the right end of the top bar: account pages and sign-out. */
export function AccountMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, roleLabel } = useUserDisplay(user)
  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN

  const account = useMemo(
    () => (user ? describeAccount(user, { displayName, roleLabel }) : null),
    [user, displayName, roleLabel]
  )

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('Account menu')}
              title={displayName}
              data-bar-skip=''
              className='size-9 rounded-full'
            />
          }
        >
          <Avatar className='size-7'>
            <AvatarFallback
              className='text-[11px] font-semibold text-white'
              style={{ backgroundColor: account?.avatar.background }}
            >
              {account?.avatar.text ?? '?'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' sideOffset={8} className='w-60'>
          <div className='flex flex-col gap-0.5 px-2 py-1.5'>
            <p className='truncate text-sm font-medium'>{displayName}</p>
            <p className='text-muted-foreground truncate text-xs'>
              {account?.detail}
            </p>
          </div>
          <DropdownMenuSeparator />
          {/* always listed, like official 个人资料: the switch that hides
              the personal module lives on this page */}
          <DropdownMenuItem onClick={() => void navigate({ to: '/profile' })}>
            <UserRound />
            {t('Account settings')}
          </DropdownMenuItem>
          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() =>
                void navigate({
                  to: '/system-settings/site/$section',
                  params: { section: 'system-info' },
                })
              }
            >
              <Settings />
              {t('System Settings')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut />
            {t('Sign out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}
