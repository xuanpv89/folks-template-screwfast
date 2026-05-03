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
        vi: { label: 'Tiếng Việt', lang: 'vi' },
      },
      // https://starlight.astro.build/guides/sidebar/
      sidebar: [
        {
          label: 'Compassio Quick Start',
          translations: {
            vi: 'Hướng dẫn bắt đầu nhanh',
          },
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Practice Tools',
          translations: {
            vi: 'Công cụ thực hành',
          },
          items: [
            {
              label: 'Compassio Guides',
              translations: { vi: 'Hướng dẫn Compassio' },
              link: 'tools/tool-guides/',
            },
            {
              label: 'Reflection Tool Care',
              translations: { vi: 'Chăm sóc công cụ phản tư' },
              link: 'tools/equipment-care/',
            },
          ],
        },
        {
          label: 'Compassio Programs',
          translations: {
            vi: 'Chương trình Compassio',
          },
          autogenerate: { directory: 'construction' },
        },
        {
          label: 'Advanced Facilitation',
          translations: {
            vi: 'Facilitation nâng cao',
          },
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
      favicon: '/docs-favicon.ico',
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

