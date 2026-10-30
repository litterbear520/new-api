import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv, type RsbuildPlugin } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

import { englishOverrides } from './scripts/en-overrides'
import { heroShellTags } from './src/features/home/night-sea/hero-shell-html'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Preloads the home page's title font on the home page only: first in the
// head, alongside the stylesheet, as the first screen in the HTML shows its
// words in it (src/features/home/night-sea/hero-shell-html.ts). HOME_FONT is
// filled in at build time.
const HOME_FONT_FIRST = `(function (homeFont) {
  try {
    if (location.pathname !== '/') return
    var font = document.createElement('link')
    font.rel = 'preload'
    font.as = 'font'
    font.type = 'font/woff2'
    font.crossOrigin = ''
    font.href = homeFont
    document.head.appendChild(font)
  } catch (e) {}
})(HOME_FONT)`

// Preloads the interface language's chunk, picked the way src/i18n/config.ts
// does (saved choice, then the browser's languages). After the stylesheet (a
// script waits for it), so it takes nothing from it. FILES is filled in at
// build time.
const EARLY_LOADS = `(function (files) {
  try {
    var pick = function (v) {
      var l = String(v || '').trim().replace(/_/g, '-').toLowerCase()
      if (l.indexOf('zh') === 0) {
        return /^(zhtw|zh-tw|zh-hk|zh-mo|zh-hant)/.test(l) ? 'zhTW' : 'zhCN'
      }
      return l.split('-')[0]
    }
    var saved = null
    try {
      saved = localStorage.getItem('i18nextLng')
    } catch (e) {}
    var list = saved ? [saved] : navigator.languages || [navigator.language]
    for (var i = 0; i < list.length; i++) {
      var code = pick(list[i])
      if (code === 'en') return
      if (files[code]) {
        var link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'script'
        link.href = files[code]
        document.head.appendChild(link)
        return
      }
    }
  } catch (e) {}
})(FILES)`

/**
 * The interface language's chunk (locale-<code>, see src/i18n/config.ts)
 * downloads together with the app's own scripts instead of after them; the
 * home page title font (an async chunk's asset) first of all, but only on the
 * home page.
 */
function pluginEarlyLoads(): RsbuildPlugin {
  return {
    name: 'xiaoxiong:early-loads',
    setup(api) {
      api.modifyHTMLTags((tags, { compilation, assetPrefix }) => {
        const files: Record<string, string> = {}
        let homeFont = ''
        const url = (name: string) =>
          `${assetPrefix.replace(/\/$/, '')}/${name}`
        for (const name of Object.keys(compilation.assets)) {
          if (/^static\/font\/night-sea-serif\.\w+\.woff2$/.test(name)) {
            homeFont = url(name)
          }
          const m = /^static\/js\/async\/locale-(\w+)\.\w+\.js$/.exec(name)
          if (m) files[m[1]] = url(name)
        }
        if (homeFont) {
          tags.headTags.unshift({
            tag: 'script',
            children: HOME_FONT_FIRST.replace(
              'HOME_FONT',
              JSON.stringify(homeFont)
            ),
          })
        }
        if (Object.keys(files).length) {
          tags.headTags.push({
            tag: 'script',
            children: EARLY_LOADS.replace('FILES', JSON.stringify(files)),
          })
        }
        return tags
      })
    },
  }
}

/**
 * The home page's first screen (its words and poster) in the HTML, so it shows
 * while the app's scripts load: the home chunk's built CSS inlined with it, in
 * a template that only the home page puts in (src/features/home/night-sea/
 * hero-shell-html.ts). Builds without split CSS (dev) leave it out.
 */
function pluginHeroShell(): RsbuildPlugin {
  return {
    name: 'xiaoxiong:hero-shell',
    setup(api) {
      api.modifyHTMLTags((tags, { compilation, assetPrefix }) => {
        const url = (name: string) =>
          `${assetPrefix.replace(/\/$/, '')}/${name}`
        let css = ''
        let poster = ''
        let phonePoster = ''
        for (const name of Object.keys(compilation.assets)) {
          if (/^static\/image\/hole-desktop\.\w+\.webp$/.test(name)) {
            poster = url(name)
          } else if (/^static\/image\/hole-phone\.\w+\.webp$/.test(name)) {
            phonePoster = url(name)
          } else if (/^static\/css\/async\/.+\.css$/.test(name)) {
            const source = compilation.assets[name].source().toString()
            if (source.includes('.ns-hero')) css += source
          }
        }
        if (css && poster && phonePoster) {
          tags.bodyTags.push(...heroShellTags({ css, poster, phonePoster }))
        }
        return tags
      })
    },
  }
}

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/v1', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [
      pluginReact(),
      pluginTailwindcss({ optimize: false }),
      pluginEarlyLoads(),
      pluginHeroShell(),
    ],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      // ui primitives and tanstack: only what the first page needs; what other
      // pages use alone (tables, rarely used widgets) loads with those pages
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'initial',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'initial',
          priority: 0,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
      define: {
        __EN_OVERRIDES__: JSON.stringify(englishOverrides()),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
      favicon: './public/favicon.ico',
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
