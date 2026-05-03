# Folks Team Website

Official website for Folks Team, built with Astro, Tailwind CSS, Preline UI, and Starlight Docs.

The site presents Folks Team's C.H.E.S.S growth framework, projects, products, blog, case studies, documentation, contact flow, and lightweight CMS tools for managing blog and page content.

## Current Site Areas

- Home page with C.H.E.S.S positioning, video gallery, features, testimonials, FAQ, and contact paths.
- C.H.E.S.S model page.
- Projects area, currently including `Project: Compassio`.
- Products collection.
- Blog collection with categories, newsletter signup, and optional video embeds.
- Insights collection.
- Case studies, including Dancenter and The School of Life.
- About Us with company sections and team roles.
- Contact page with API-backed email submission.
- Member page placeholder.
- Starlight Docs in English, Vietnamese, and Chinese.
- Admin CMS hub for blog and page content workflows.

## Tech Stack

- Astro 6
- Tailwind CSS 4
- Preline UI
- Astro Content Collections
- Astro Starlight for docs
- Vercel deployment
- Vercel serverless function for contact email
- Resend for contact form delivery

## Local Setup

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Build the production site:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Environment Variables

The contact form posts to `api/contact.js`, which sends email through Resend.

Set these variables in Vercel:

```bash
RESEND_API_KEY=your_resend_api_key
CONTACT_TO_EMAIL=contact@folksteam.com
CONTACT_FROM_EMAIL=Folks Team <your_verified_sender@yourdomain.com>
```

Important: `CONTACT_FROM_EMAIL` must use a sender/domain verified in Resend.

## Project Structure

```text
api/
  contact.js                  Vercel function for contact form email

public/
  admin/
    index.html                CMS navigation hub
    blog.html                 Blog Manager
    content.html              Page/content CMS
    config.yml                Legacy Decap config reference

src/
  assets/
    scripts/                  Browser scripts
    styles/                   Global and Starlight styles
  components/                 Reusable Astro components
  content/
    blog/                     Blog posts by locale
    docs/                     Starlight docs by locale
    insights/                 Insight entries
    products/                 Product entries
  data_files/
    cmsContent.json           CMS-managed page content data
    constants.ts              Site metadata constants
  images/                     Local image assets
  layouts/
    MainLayout.astro          Main site wrapper
  pages/
    index.astro               English home
    vi/                       Vietnamese routes
    zh/                       Chinese routes
    projects/                 Project pages
    case-studies/             Case study pages
    blog/                     Blog routes
    products/                 Product routes
    insights/                 Insight routes
  utils/
    navigation.ts             English nav/footer links
    vi/navigation.ts          Vietnamese nav/footer links
    zh/navigation.ts          Chinese nav/footer links
```

## CMS Workflows

Open the admin hub:

```text
/admin/
```

Available modules:

- `/admin/blog.html`: create blog Markdown, save drafts locally, copy/download Markdown, or publish to GitHub with a fine-grained token.
- `/admin/content.html`: edit page/section content as JSON, save drafts locally, export/copy JSON, or publish to `src/data_files/cmsContent.json`.

The CMS runs as static HTML in `public/admin`. It does not require a separate backend, but GitHub publishing requires a fine-grained GitHub token with `Contents: Read and write` permission for this repo.

## Content Editing

Blog posts live in:

```text
src/content/blog/en/
src/content/blog/vi/
```

Each blog post supports:

- title
- description
- author
- author image
- publish date
- category
- tags
- contents
- optional videos

Example video field:

```yaml
videos:
  [
    {
      title: 'Derek Sivers: How to start a movement',
      embed: 'https://www.youtube-nocookie.com/embed/V74AxCqOTvg',
      caption: 'Useful context for community momentum.',
    },
  ]
```

Product and insight entries live in:

```text
src/content/products/
src/content/insights/
```

Docs live in:

```text
src/content/docs/
src/content/docs/vi/
src/content/docs/zh/
```

## Navigation And Footer

Update navigation and footer links in:

```text
src/utils/navigation.ts
src/utils/vi/navigation.ts
src/utils/zh/navigation.ts
```

The main navigation currently supports:

- Home
- C.H.E.S.S submenu
- Services
- Products
- Blog
- Help/Docs
- Contact
- Member
- Language picker

Footer links are grouped into Explore, Resources, and Company.

## Case Studies

Case study pages live in:

```text
src/pages/case-studies/
```

Current examples:

- `/case-studies/dancenter-chess`
- `/case-studies/the-school-of-life-chess`

Use the Dancenter page as the reference format when creating future case studies.

## Projects

Project pages live in:

```text
src/pages/projects/
```

Current project:

- `/projects/compassio`

Older `/compassio` routes redirect to the new project URL.

## Multilingual Routes

The site currently supports:

- English: `/`
- Vietnamese: `/vi`
- Chinese: `/zh`

Navigation labels, footer labels, core pages, and docs have localized versions. Some collection detail pages use fallback routing where full translated content is not yet available.

## Deployment

The project is deployed on Vercel from the `main` branch.

Typical deployment flow:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

Vercel should automatically build and deploy after push.

## Security Headers

Security headers are configured in:

```text
vercel.json
```

The Content Security Policy allows YouTube embeds through:

```text
frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com
```

If adding embeds from another video platform, update `frame-src` accordingly.

## Notes For Future Work

- Build a full `/projects` index page.
- Build a full `/case-studies` index page.
- Connect `src/data_files/cmsContent.json` into live page rendering if page content should become CMS-driven.
- Add a newsletter API route instead of relying on external form posts.
- Expand Chinese content beyond route-level coverage.
- Replace representative/team placeholder images with real Folks Team photos when available.

## License

This project started from the ScrewFast Astro template and has been customized for Folks Team. See `LICENSE` for license details.
