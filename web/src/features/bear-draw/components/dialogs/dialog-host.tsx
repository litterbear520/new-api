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
import { BrandKitDialog } from './brand-kit-dialog'
import { CreditsDialog } from './credits-dialog'
import { closeDialog, useDialogStore } from './dialog-store'
import { ImportSkillDialog } from './import-skill-dialog'
import { NewSkillDialog } from './new-skill-dialog'

const onOpenChange = (open: boolean) => {
  if (!open) closeDialog()
}

/** Renders whichever page dialog openDialog() asked for. Mount once. */
export function DialogHost() {
  const kind = useDialogStore((s) => s.kind)
  const seed = useDialogStore((s) => s.seed)
  const serial = useDialogStore((s) => s.serial)
  return (
    <>
      <BrandKitDialog open={kind === 'brand'} onOpenChange={onOpenChange} />
      <ImportSkillDialog
        open={kind === 'import-skill'}
        onOpenChange={onOpenChange}
      />
      <NewSkillDialog
        key={serial}
        open={kind === 'new-skill'}
        seed={seed}
        onOpenChange={onOpenChange}
      />
      <CreditsDialog open={kind === 'credits'} onOpenChange={onOpenChange} />
    </>
  )
}
