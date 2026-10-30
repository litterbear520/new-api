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
import { ExternalLink } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRedemption } from '@/features/wallet/hooks/use-redemption'

/** 兑换码: one field in a dialog; the credit goes straight to the balance */
export function CodeDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRedeemed: () => void
  /** Where the site sells codes (New API's TopUpLink), when it sets one */
  topupLink?: string
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const { redeeming, redeemCode } = useRedemption()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const key = code.trim()
    if (!key || redeeming) return
    if (await redeemCode(key)) {
      setCode('')
      props.onRedeemed()
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Redemption code')}
      description={t('Redeemed credit goes straight to your balance.')}
      // The body's 4px focus-ring padding plus gap-4 keeps the 20px rhythm.
      contentClassName='gap-4 sm:max-w-md sm:p-4'
      footerClassName='sm:-mx-4 sm:-mb-4 sm:p-4'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='bw-code-form'
            disabled={!code.trim() || redeeming}
          >
            {t('Redeem')}
          </Button>
        </>
      }
    >
      <form id='bw-code-form' onSubmit={submit}>
        <Input
          aria-label={t('Redemption code')}
          value={code}
          autoComplete='off'
          spellCheck={false}
          placeholder={t('Enter a redemption code')}
          onChange={(event) => setCode(event.target.value)}
        />
        {props.topupLink && (
          <p className='text-muted-foreground mt-2 text-xs'>
            {t('Need a redemption code?')}{' '}
            <a
              href={props.topupLink}
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline'
            >
              {t('Get one here')}
              <ExternalLink aria-hidden='true' className='size-3' />
            </a>
          </p>
        )}
      </form>
    </Dialog>
  )
}
