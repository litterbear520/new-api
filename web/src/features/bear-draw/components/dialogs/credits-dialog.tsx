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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber } from '@/lib/format'

import {
  GALLERY_CREDITS,
  GALLERY_CREDITS_NOTE,
  SKILL_CREDITS,
  SKILL_CREDITS_NOTE,
  type LicenseFile,
  type SkillCredit,
} from '../../data/credits'
import { loadLicenseText } from '../../lib/skill-text'

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

function LicenseText(props: { file: LicenseFile }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['bear-draw', 'license', props.file],
    queryFn: () => loadLicenseText(props.file),
    staleTime: Infinity,
  })
  if (query.isPending) return <p className='bd-muted'>{t('Loading...')}</p>
  return (
    <pre className='bd-cr-lic'>
      {query.data ?? t('This licence text could not be loaded.')}
    </pre>
  )
}

function LicenseLink(props: { file: LicenseFile }) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className='bd-cr-file'
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{props.file}</summary>
      {open && <LicenseText file={props.file} />}
    </details>
  )
}

function SkillProject(props: { credit: SkillCredit }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const c = props.credit
  return (
    <article className='bd-cr-card'>
      <div className='bd-cr-hd'>
        <a href={c.url} target='_blank' rel='noreferrer'>
          {c.repo}
        </a>
        <span className='bd-tag'>{c.license}</span>
        <span className='bd-muted'>
          {formatCompactNumber(c.stars, locale)}★
        </span>
        {c.via && (
          <span className='bd-muted'>
            {t('via')}{' '}
            <a href={c.via.url} target='_blank' rel='noreferrer'>
              {c.via.repo}
            </a>
          </span>
        )}
      </div>
      <dl className='bd-cr-dl'>
        <dt>{t('Copyright')}</dt>
        <dd>{c.copyright}</dd>
        <dt>{t('Files')}</dt>
        <dd>
          {c.files.map((f) => (
            <code key={f}>{f}</code>
          ))}
        </dd>
        <dt>{t('What we used')}</dt>
        <dd>{c.used}</dd>
        <dt>{t('What we changed')}</dt>
        <dd>{c.changed}</dd>
        <dt>{t('License')}</dt>
        <dd>
          {c.licenseFiles.map((f) => (
            <LicenseLink key={f} file={f} />
          ))}
        </dd>
      </dl>
    </article>
  )
}

/** 来源和许可证: what the skills and the 玩法 prompts quote, and under which licence. */
export function CreditsDialog(props: DialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Sources and licences')}
      description={t(
        'The built-in skills are adapted from these open-source projects and used under their licences.'
      )}
      contentClassName='bd-pop bd-dlg bd-dlg-lg'
      titleClassName='bd-dlg-t'
    >
      <div className='bd-cr'>
        <section>
          <h3>{t('Skills')}</h3>
          <p className='bd-cr-note'>{SKILL_CREDITS_NOTE}</p>
          {SKILL_CREDITS.map((c) => (
            <SkillProject key={c.repo} credit={c} />
          ))}
        </section>
        <section>
          <h3>{t('Ideas to try')}</h3>
          <p className='bd-cr-note'>{GALLERY_CREDITS_NOTE}</p>
          <table className='bd-cr-table'>
            <thead>
              <tr>
                <th scope='col'>{t('Collection')}</th>
                <th scope='col'>{t('License')}</th>
                <th scope='col'>{t('Prompts')}</th>
              </tr>
            </thead>
            <tbody>
              {GALLERY_CREDITS.map((g) => (
                <tr key={g.repo}>
                  <td>
                    <a href={g.url} target='_blank' rel='noreferrer'>
                      {g.repo}
                    </a>
                    {g.showcase && (
                      <>
                        {' · '}
                        <a href={g.showcase} target='_blank' rel='noreferrer'>
                          {t('Showcase')}
                        </a>
                      </>
                    )}
                    {g.note && <div className='bd-muted'>{g.note}</div>}
                  </td>
                  <td>{g.license}</td>
                  <td className='bd-num'>{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Dialog>
  )
}
