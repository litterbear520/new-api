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
import { Link } from '@tanstack/react-router'

type AuthPromptLinkProps = {
  /** Lead-in copy, e.g. "Don't have an account?" */
  prompt: string
  to: '/sign-in' | '/sign-up'
  label: string
}

/** The "Don't have an account? Sign up" line under an auth form. */
export function AuthPromptLink(props: AuthPromptLinkProps) {
  return (
    <p className='text-muted-foreground mt-6 text-sm'>
      {props.prompt}{' '}
      <Link
        to={props.to}
        className='text-foreground underline underline-offset-4 hover:opacity-80'
      >
        {props.label}
      </Link>
    </p>
  )
}
