import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';

import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  // https://docs.astro.build/en/guides/images/#authorizing-remote-images
  site: 'https://folks-team.com',
  image: {
    domains: ['images.unsplash.com'],
  },
  // i18n: {
  //   defaultLocale: "en",
  //   locales: ["en", "fr"],
  //   fallback: {
  //     fr: "en",
  //   },
  //   routing: {
  //     prefixDefaultLocale: false,
  //   },
  // },
  prefetch: true,
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en', // All urls that don't contain language prefix will be treated as default locale
        locales: {
          en: 'en', // The `defaultLocale` value must present in `locales` keys
          vi: 'vi',
        },
      },
    }),
    starlight({
      title: 'Folks Team Docs',
      // https://github.com/withastro/starlight/blob/main/packages/starlight/CHANGELOG.md
      // If no Astro and Starlight i18n configurations are provided, the built-in default locale is used in Starlight and a matching Astro i18n configuration is generated/used.
      // If only a Starlight i18n configuration is provided, an equivalent Astro i18n configuration is generated/used.
      // If only an Astro i18n configuration is provided, the Starlight i18n configuration is updated to match it.
      // If both an Astro and Starlight i18n configurations are provided, an error is thrown.
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        de: { label: 'Deutsch', lang: 'de' },
        es: { label: 'EspaÃ±ol', lang: 'es' },
        fa: { label: 'Persian', lang: 'fa', dir: 'rtl' },
        vi: { label: 'Tiếng Việt', lang: 'vi' },
        ja: { label: 'æ—¥æœ¬èªž', lang: 'ja' },
        'zh-cn': { label: 'ç®€ä½“ä¸­æ–‡', lang: 'zh-CN' },
      },
      // https://starlight.astro.build/guides/sidebar/
      sidebar: [
        {
          label: 'Quick Start Guides',
          translations: {
            de: 'Schnellstartanleitungen',
            es: 'GuÃ­as de Inicio RÃ¡pido',
            fa: 'Ø±Ø§Ù‡Ù†Ù…Ø§ÛŒ Ø´Ø±ÙˆØ¹ Ø³Ø±ÛŒØ¹',
            vi: 'Hướng dẫn bắt đầu nhanh',
            ja: 'ã‚¯ã‚¤ãƒƒã‚¯ã‚¹ã‚¿ãƒ¼ãƒˆã‚¬ã‚¤ãƒ‰',
            'zh-cn': 'å¿«é€Ÿå…¥é—¨æŒ‡å—',
          },
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Tools & Equipment',
          items: [
            { label: 'Tool Guides', link: 'tools/tool-guides/' },
            { label: 'Equipment Care', link: 'tools/equipment-care/' },
          ],
        },
        {
          label: 'Construction Services',
          autogenerate: { directory: 'construction' },
        },
        {
          label: 'Advanced Topics',
          autogenerate: { directory: 'advanced' },
        },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/xuanpv89/folks-template-screwfast',
        },
      ],
      disable404Route: true,
      customCss: ['./src/assets/styles/starlight.css'],
      favicon: '/favicon.ico',
      components: {
        SiteTitle: './src/components/ui/starlight/SiteTitle.astro',
        Head: './src/components/ui/starlight/Head.astro',
        MobileMenuFooter:
          './src/components/ui/starlight/MobileMenuFooter.astro',
        ThemeSelect: './src/components/ui/starlight/ThemeSelect.astro',
      },
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://folks-team.com' + '/social.webp',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'twitter:image',
            content: 'https://folks-team.com' + '/social.webp',
          },
        },
      ],
    }),
    mdx(),
  ],
  experimental: {
    clientPrerender: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

