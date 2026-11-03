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
import i18n, { type BackendModule } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage, toIntlLocale } from './languages'
import type en from './locales/en.json'

// The keys are the English text, so English is the keys themselves plus the
// few entries that differ from their key (picked from en.json at build time,
// see rsbuild.config.ts); every other language is its own chunk, fetched only
// when it is the one in use (index.html starts it early, see the locale
// preload in rsbuild.config.ts).
declare const __EN_OVERRIDES__: Record<string, string>

const lazyLocales: Record<string, () => Promise<{ default: typeof en }>> = {
  zhCN: () => import(/* webpackChunkName: "locale-zhCN" */ './locales/zh.json'),
  fr: () => import(/* webpackChunkName: "locale-fr" */ './locales/fr.json'),
  ru: () => import(/* webpackChunkName: "locale-ru" */ './locales/ru.json'),
  ja: () => import(/* webpackChunkName: "locale-ja" */ './locales/ja.json'),
  vi: () => import(/* webpackChunkName: "locale-vi" */ './locales/vi.json'),
  zhTW: () =>
    import(/* webpackChunkName: "locale-zhTW" */ './locales/zh-TW.json'),
}

// i18next waits on a promise from a two-argument `read`.
const localeBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language: string, namespace: string) {
    const load = lazyLocales[language]
    if (!load) return Promise.resolve({})
    return load().then((module) => module.default[namespace as keyof typeof en])
  },
}

// Screen readers, the browser's translation offer and its choice of Han glyphs read this
i18n.on('languageChanged', (code) => {
  const tag = toIntlLocale(code)
  if (tag) document.documentElement.lang = tag
})

/** Resolves once the detected language is loaded (or failed to load). */
export const i18nReady = i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: __EN_OVERRIDES__ } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
      // codes (non-Chinese codes pass through for normal supportedLngs matching).
      convertDetectedLanguage,
    },
  })
  .then(
    () => undefined,
    () => undefined
  )

export default i18n
