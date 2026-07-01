# Landing pages componíveis (fatia vertical) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let non-dev marketing compose a landing page in the EmDash admin from reusable, editable blocks (Hero, Pricing, FAQ), rendered by the theme with the enem-quest-pro design system.

**Architecture:** A local native plugin (`packages/lp-blocks`) declares the block *types* with Block Kit editing forms; the theme (this Astro project) renders them via `.astro` components passed to `<PortableText components>`. Data lives in two collections — `landing_pages` (composed via a `content` Portable Text field) and `plans` (single source of pricing). Connected by the block `_type` string (e.g. `marketing.hero`).

**Tech Stack:** Astro 6 (SSR, `output: "server"`), `@astrojs/cloudflare` (D1 + R2), EmDash 0.25.1, pnpm workspace.

## Global Constraints

- `output: "server"`; NEVER use `getStaticPaths()` on CMS content routes.
- Call `Astro.cache.set(cacheHint)` on every page that queries EmDash content.
- Image fields are objects (`{ src, alt }`), not strings.
- Collection/taxonomy names in queries must match the seed exactly.
- Dev server command is `pnpm dev` (= `astro dev`). Do NOT use `npx emdash dev` — its local path needs `better-sqlite3` native bindings that are not built here; this project uses D1 via miniflare.
- Local dev D1 is empty, so `seed/seed.json` collections apply on first request. Production D1 is already populated, so new collections there are created later via admin/MCP — NOT by this plan.
- Do NOT modify `src/pages/lp/[slug].astro` or anything serving `enem-quest-pro`. This is a parallel system.
- Verification mechanism (no unit-test harness exists): `pnpm exec astro check` for types, `curl` against `http://localhost:4321` for rendering, and the admin at `http://localhost:4321/_emdash/admin` for editing UI.
- Reference design source: the `enem-quest-pro` HTML (collection `lp`, slug `enem-quest-pro`). Fetch via the EmDash MCP `content_get` when CSS/markup extraction is needed. Section markup lives in that document (hero, pricing, faq).

---

## Task 1: Local plugin spike — one block type with an editing form

De-risks the biggest unknown: can a local native plugin, registered in `astro.config`, make a custom block appear in the Portable Text editor with a Block Kit form — with no separate build step?

**Files:**
- Create: `packages/lp-blocks/package.json`
- Create: `packages/lp-blocks/index.mjs`
- Modify: `pnpm-workspace.yaml` (ensure `packages/*` is a workspace glob)
- Modify: `package.json` (add `"@passei/lp-blocks": "workspace:*"` to dependencies)
- Modify: `astro.config.mjs` (import + register the plugin)

**Interfaces:**
- Produces: `lpBlocksPlugin()` (default-imported descriptor factory) registered in `emdash({ plugins: [...] })`. Declares block types under `admin.portableTextBlocks`; later tasks add more types to the same array.
- Produces: block `_type` `marketing.hero` (editing side only in this task).

- [ ] **Step 1: Read the current workspace + config**

Run: `cat pnpm-workspace.yaml && grep -n "plugins:" astro.config.mjs`
Note whether `packages/*` is already a workspace glob and the exact `plugins: [...]` line.

- [ ] **Step 2: Create the plugin package manifest**

Create `packages/lp-blocks/package.json`:

```json
{
  "name": "@passei/lp-blocks",
  "version": "0.1.0",
  "type": "module",
  "main": "index.mjs",
  "exports": { ".": "./index.mjs" },
  "peerDependencies": { "emdash": "*" }
}
```

- [ ] **Step 3: Create the plugin with one block type**

Create `packages/lp-blocks/index.mjs`. The descriptor factory (build-time, imported by astro.config) and `createPlugin` (runtime) live in one file:

```js
import { definePlugin } from "emdash";

const portableTextBlocks = [
  {
    type: "marketing.hero",
    label: "LP · Hero",
    icon: "link",
    placeholder: "Hero",
    fields: [
      { type: "text_input", action_id: "headline", label: "Headline" },
    ],
  },
];

export function lpBlocksPlugin() {
  return {
    id: "lp-blocks",
    version: "0.1.0",
    format: "native",
    entrypoint: "@passei/lp-blocks",
  };
}

export function createPlugin() {
  return definePlugin({
    id: "lp-blocks",
    version: "0.1.0",
    admin: { portableTextBlocks },
  });
}

export default createPlugin;
```

- [ ] **Step 4: Add `packages/*` to the workspace (if missing) and install**

If Step 1 showed `packages/*` is absent from `pnpm-workspace.yaml`, add it under `packages:`. Then:

Run: `pnpm install`
Expected: completes; `@passei/lp-blocks` linked as a workspace package (no "not found" error).

- [ ] **Step 5: Register the plugin in astro.config.mjs**

Add the import near the other plugin imports:

```js
import lpBlocksPlugin from "@passei/lp-blocks";
```

Add it to the `plugins` array inside `emdash({...})`, after `featuredImageStudioPlugin()`:

```js
plugins: [formsPlugin(), embedsPlugin(), colorPlugin(), featuredImageStudioPlugin(), lpBlocksPlugin()],
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec astro check`
Expected: no new errors referencing `astro.config.mjs` or `@passei/lp-blocks`. (Pre-existing unrelated warnings are acceptable.)

- [ ] **Step 7: Boot dev and verify the plugin loads**

Run: `pnpm dev` (background) then `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/_emdash/admin`
Expected: server starts with no error mentioning `lp-blocks`; admin responds (200 or an auth redirect 3xx). Check the startup log for a line acknowledging the plugin or absence of a load error.

- [ ] **Step 8: Verify the block appears in the editor (manual admin check)**

In the browser, open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`, open any content item with a Portable Text field (e.g. a `pages` entry, or create one), and trigger the editor's insert/slash menu.
Expected: `LP · Hero` appears as an insertable block, and inserting it shows a form with a `Headline` text input.

If this fails (block absent, or no form), STOP and record what happened. Fallbacks to try in order, re-running Steps 6–8 after each: (a) confirm `format: "native"` and that `entrypoint` matches the package `name`; (b) add a build step with `tsdown` and point `main`/`exports` at `dist/index.js` (see EmDash "Distributing native plugins" doc); (c) if editing-side still won't register, fall back to a sandboxed plugin listed under `emdash({ sandboxed: [...] })` (a `sandboxRunner` is already configured). Do not proceed to Task 2 until a block form renders.

- [ ] **Step 9: Commit**

```bash
git add packages/lp-blocks package.json pnpm-workspace.yaml pnpm-lock.yaml astro.config.mjs
git commit -m "feat(lp): local plugin declaring marketing.hero block (spike)"
```

---

## Task 2: Collections `plans` and `landing_pages` via seed

**Files:**
- Modify: `seed/seed.json` (add two collections + sample content)

**Interfaces:**
- Produces: collection `plans` with fields `name, badge, tagline, price_installments, price_pix, price_old, features, cta_label, cta_url, featured`.
- Produces: collection `landing_pages` with fields `title, content` (Portable Text).
- Produces: seeded `plans` slugs `enem-quest-pro`, `passei-pro`; seeded `landing_pages` slug `exemplo` (content filled in later tasks).

- [ ] **Step 1: Read the current seed shape**

Run: `python3 -c "import json;d=json.load(open('seed/seed.json'));print([c['slug'] for c in d['collections']]);print(list(d.get('content',{}).keys()))"`
Expected: `['posts', 'pages']` and content keys `['pages', 'posts']`. Confirms where to add collections and content.

- [ ] **Step 2: Add the `plans` collection**

In `seed/seed.json`, append to the `collections` array:

```json
{
  "slug": "plans",
  "label": "Plans",
  "labelSingular": "Plan",
  "supports": ["drafts", "revisions"],
  "fields": [
    { "slug": "name", "label": "Name", "type": "string", "required": true },
    { "slug": "badge", "label": "Badge", "type": "string" },
    { "slug": "tagline", "label": "Tagline", "type": "string" },
    { "slug": "price_installments", "label": "Installments price", "type": "string" },
    { "slug": "price_pix", "label": "PIX price", "type": "string" },
    { "slug": "price_old", "label": "Old price", "type": "string" },
    { "slug": "features", "label": "Features", "type": "json" },
    { "slug": "cta_label", "label": "CTA label", "type": "string" },
    { "slug": "cta_url", "label": "CTA URL", "type": "string" },
    { "slug": "featured", "label": "Featured", "type": "boolean" }
  ]
}
```

- [ ] **Step 3: Add the `landing_pages` collection**

Append to the `collections` array:

```json
{
  "slug": "landing_pages",
  "label": "Landing Pages",
  "labelSingular": "Landing Page",
  "supports": ["drafts", "revisions", "seo"],
  "fields": [
    { "slug": "title", "label": "Title", "type": "string", "required": true },
    { "slug": "content", "label": "Content", "type": "portableText" }
  ]
}
```

- [ ] **Step 4: Add sample content**

In the `content` object, add two `plans` and one empty `landing_pages`:

```json
"plans": [
  {
    "id": "plan-enem-quest-pro",
    "slug": "enem-quest-pro",
    "status": "published",
    "data": {
      "name": "ENEM Quest+ PRO",
      "badge": "MAIS POPULAR",
      "tagline": "A experiência completa de aprovação.",
      "price_installments": "12x R$ 59,90",
      "price_pix": "ou R$ 599,00 no PIX",
      "price_old": "De R$ 1.437,60",
      "features": ["Tudo do MED! PRO", "12 meses de acesso", "Cadernão: Linguagens + Humanas", "Cadernão: Ciências + Matemática", "Frete grátis para todo o Brasil", "QR code em cada questão"],
      "cta_label": "Assinar Agora",
      "cta_url": "https://pay.passeicursos.com.br/pay/enem-quest-pro-2-cadernoes-enem-plataforma-passei",
      "featured": true
    }
  },
  {
    "id": "plan-passei-pro",
    "slug": "passei-pro",
    "status": "published",
    "data": {
      "name": "Passei! PRO",
      "tagline": "Acesso à plataforma e plano básico.",
      "price_installments": "12x R$ 29,90",
      "price_pix": "ou R$ 299,90 PIX",
      "price_old": "R$ 717,60",
      "features": ["12 meses de acesso + Aulas completas", "Banco de questões", "2 correções de redação/mês", "Aulas ao vivo semanais"],
      "cta_label": "Selecionar Plano",
      "cta_url": "https://passeicursos.com.br/passeipro/",
      "featured": false
    }
  }
],
"landing_pages": [
  {
    "id": "lp-exemplo",
    "slug": "exemplo",
    "status": "published",
    "data": { "title": "Exemplo", "content": [] }
  }
]
```

- [ ] **Step 5: Validate JSON**

Run: `python3 -c "import json; json.load(open('seed/seed.json')); print('valid')"`
Expected: `valid`.

- [ ] **Step 6: Reset local dev DB so the seed re-applies, then boot**

The seed only applies to an empty DB. Remove local miniflare D1 state so it re-seeds:

Run: `rm -rf .wrangler/state && pnpm dev` (background)
Expected: server boots; startup regenerates types.

- [ ] **Step 7: Verify types + collections**

Run: `grep -E "plans|landing_pages" emdash-env.d.ts`
Expected: interfaces/registrations for both `plans` and `landing_pages`.
Then: `curl -s "http://localhost:4321/_emdash/api/..."` is not needed — instead open the admin (dev-bypass URL from Task 1) and confirm `Plans` and `Landing Pages` appear under Content Types, and two plans exist.

- [ ] **Step 8: Commit**

```bash
git add seed/seed.json emdash-env.d.ts
git commit -m "feat(lp): plans + landing_pages collections with sample plans"
```

---

## Task 3: Design system CSS, LandingShell layout, and the route skeleton

**Files:**
- Create: `src/styles/lp-ds.css`
- Create: `src/layouts/LandingShell.astro`
- Create: `src/components/lp/MarketingBlocks.astro`
- Create: `src/pages/landing/[slug].astro`

**Interfaces:**
- Consumes: collection `landing_pages` (Task 2).
- Produces: `LandingShell.astro` (default slot renders inside nav+footer, loads `lp-ds.css`, includes the interaction JS: nav-scroll, FAQ accordion, reveal-on-scroll, lightbox).
- Produces: `MarketingBlocks.astro` — wraps `<PortableText components>` and holds the `_type → component` map (Tasks 4–6 extend the map).
- Produces: route `/landing/[slug]` rendering `landing_pages.content`.

- [ ] **Step 1: Extract the design system CSS**

Fetch the reference: via EmDash MCP `content_get` (collection `lp`, id `enem-quest-pro`), read `data.html`. Copy the contents of the two style blocks — `<style id="ds-tokens">` (the `:root{...}` tokens + base element rules) and `<style id="ds-components">` (the `.container`, `.hero`, `.stats`, `.pillar`, `.method`, `.plan-*`, `.tst-*`, `.faq*`, `.cta-final`, `.footer`, `.nav`, `.btn*`, `.reveal`, `.float`, `.shimmer`, `.lightbox` classes) — into `src/styles/lp-ds.css`, verbatim, without the `<style>` tags. This is the violet/orange system the blocks depend on.

- [ ] **Step 2: Create the shell layout**

Create `src/layouts/LandingShell.astro`. Copy the `<nav>` and `<footer>` markup and the functional `<script>` (nav scroll, FAQ toggle, reveal IntersectionObserver, lightbox) from the reference `enem-quest-pro` HTML (`<nav id="main-nav">…`, `<footer class="footer">…`, and the final `<script>`). Structure:

```astro
---
import "../styles/lp-ds.css";
interface Props { title: string; }
const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body>
  <nav id="main-nav" class="nav" style="background:transparent"><!-- nav markup from reference --></nav>
  <slot />
  <footer class="footer"><!-- footer markup from reference --></footer>
  <div id="lightbox" class="lightbox" style="display:none" onclick="closeLightbox()"><img id="lightbox-img" src="" alt="" /><button class="lightbox__close" onclick="closeLightbox()">×</button></div>
  <script is:inline><!-- nav/FAQ/reveal/lightbox JS from reference --></script>
</body>
</html>
```

Note: use `is:inline` on the script so Astro ships it verbatim.

- [ ] **Step 3: Create the block map wrapper**

Create `src/components/lp/MarketingBlocks.astro`:

```astro
---
import { PortableText } from "emdash/ui";
interface Props { value: unknown[]; }
const { value } = Astro.props;
const types = {};
---
<PortableText value={value} components={{ types }} />
```

- [ ] **Step 4: Create the route**

Create `src/pages/landing/[slug].astro`:

```astro
---
import { getEmDashEntry } from "emdash";
import LandingShell from "../../layouts/LandingShell.astro";
import MarketingBlocks from "../../components/lp/MarketingBlocks.astro";

const { slug } = Astro.params;
if (!slug) return Astro.redirect("/404");

const { entry, cacheHint } = await getEmDashEntry("landing_pages", slug);
if (!entry) return Astro.redirect("/404");
Astro.cache.set(cacheHint);
---
<LandingShell title={entry.data.title}>
  <MarketingBlocks value={entry.data.content ?? []} />
</LandingShell>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec astro check`
Expected: no new errors in the four new files.

- [ ] **Step 6: Verify the shell renders**

With `pnpm dev` running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/landing/exemplo`
Expected: `200`. The page shows nav + footer with the design system applied (body is empty content since `content: []`).

- [ ] **Step 7: Commit**

```bash
git add src/styles/lp-ds.css src/layouts/LandingShell.astro src/components/lp/MarketingBlocks.astro "src/pages/landing/[slug].astro"
git commit -m "feat(lp): design system css, LandingShell, /landing/[slug] route"
```

---

## Task 4: Hero block (rendering + wired into the page)

**Files:**
- Create: `src/components/lp/blocks/Hero.astro`
- Modify: `src/components/lp/MarketingBlocks.astro` (register `marketing.hero`)
- Modify: `packages/lp-blocks/index.mjs` (expand `marketing.hero` fields)
- Modify: `seed/seed.json` (add a hero block to `lp-exemplo` content)

**Interfaces:**
- Consumes: `marketing.hero` block value `{ eyebrow?, headline, lead?, cta_primary_label?, cta_primary_url?, cta_secondary_label?, cta_secondary_url?, media_url? }`.
- Produces: `types["marketing.hero"] = Hero` in the block map.

- [ ] **Step 1: Expand the hero fields in the plugin**

In `packages/lp-blocks/index.mjs`, replace the `marketing.hero` `fields` array with:

```js
fields: [
  { type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
  { type: "text_input", action_id: "headline", label: "Headline" },
  { type: "text_input", action_id: "lead", label: "Lead", multiline: true },
  { type: "text_input", action_id: "cta_primary_label", label: "CTA primary label" },
  { type: "text_input", action_id: "cta_primary_url", label: "CTA primary URL" },
  { type: "text_input", action_id: "cta_secondary_label", label: "CTA secondary label" },
  { type: "text_input", action_id: "cta_secondary_url", label: "CTA secondary URL" },
  { type: "text_input", action_id: "media_url", label: "Media URL (image/video)" },
],
```

- [ ] **Step 2: Create the Hero component**

Create `src/components/lp/blocks/Hero.astro`, adapting the reference hero markup (`<section class="hero">…`) to props. Use `.hero`, `.hero__grid`, `.hero__pill`, `.hero__title`, `.hero__lead`, `.hero__cta-row`, `.btn--primary`, `.btn--outline-light`, `.hero__media` classes from `lp-ds.css`:

```astro
---
interface Props {
  value: {
    eyebrow?: string; headline: string; lead?: string;
    cta_primary_label?: string; cta_primary_url?: string;
    cta_secondary_label?: string; cta_secondary_url?: string;
    media_url?: string;
  };
}
const { value } = Astro.props;
const isVideo = !!value.media_url && /\.(mp4|webm)$/i.test(value.media_url);
---
<section class="hero">
  <div class="hero__blobs"><div class="hero__blob-v"></div><div class="hero__blob-o"></div></div>
  <div class="hero__grid">
    <div class="reveal">
      {value.eyebrow && <div class="hero__pill">{value.eyebrow}</div>}
      <h1 class="hero__title" set:html={value.headline} />
      {value.lead && <p class="hero__lead">{value.lead}</p>}
      <div class="hero__cta-row">
        {value.cta_primary_url && <a href={value.cta_primary_url} class="btn btn--primary shimmer" style="border-radius:var(--radius-md)">{value.cta_primary_label}</a>}
        {value.cta_secondary_url && <a href={value.cta_secondary_url} class="btn btn--outline-light" style="border-radius:var(--radius-md)">{value.cta_secondary_label}</a>}
      </div>
    </div>
    {value.media_url && (
      <div class="reveal"><div class="hero__media float">
        {isVideo
          ? <video autoplay muted loop playsinline src={value.media_url}></video>
          : <img src={value.media_url} alt="" style="width:100%;display:block" />}
      </div></div>
    )}
  </div>
</section>
```

Note: `set:html` on the headline lets editors use `<br>`/`<em>` like the reference ("Tudo que<br>o <em>ENEM</em>…"). This is intentional and the content is trusted (admin-authored).

- [ ] **Step 3: Register the component**

In `src/components/lp/MarketingBlocks.astro`, import and map it:

```astro
import Hero from "./blocks/Hero.astro";
```
```js
const types = { "marketing.hero": Hero };
```

- [ ] **Step 4: Seed a hero block into the example page**

In `seed/seed.json`, set `lp-exemplo`'s `data.content` to:

```json
[
  {
    "_type": "marketing.hero",
    "_key": "hero",
    "eyebrow": "Método exclusivo para o 800+",
    "headline": "Tudo que<br>o <em>ENEM</em><br>exige, em<br>um só lugar.",
    "lead": "Plataforma com método, material físico e banco de questões. Uma decisão.",
    "cta_primary_label": "Quero Minha Aprovação",
    "cta_primary_url": "#planos",
    "cta_secondary_label": "Como funciona?",
    "cta_secondary_url": "#planos"
  }
]
```

- [ ] **Step 5: Re-seed and verify render**

Run: `rm -rf .wrangler/state && pnpm dev` (background), then
`curl -s http://localhost:4321/landing/exemplo | grep -c "hero__title"`
Expected: `1`. Also confirm the headline text is present:
`curl -s http://localhost:4321/landing/exemplo | grep -o "exige, em"`
Expected: `exige, em`.

- [ ] **Step 6: Verify the admin form (manual)**

In the admin, open the `Exemplo` landing page, confirm the Hero block shows a form with all fields, edit the headline, save, and reload `/landing/exemplo` to confirm the change renders.

- [ ] **Step 7: Commit**

```bash
git add src/components/lp/blocks/Hero.astro src/components/lp/MarketingBlocks.astro packages/lp-blocks/index.mjs seed/seed.json
git commit -m "feat(lp): hero block (render + editing form + sample)"
```

---

## Task 5: Pricing block (renders from the `plans` collection)

**Files:**
- Create: `src/components/lp/blocks/Pricing.astro`
- Modify: `src/components/lp/MarketingBlocks.astro` (register `marketing.pricing`)
- Modify: `packages/lp-blocks/index.mjs` (add `marketing.pricing` type)
- Modify: `seed/seed.json` (add a pricing block to `lp-exemplo`)

**Interfaces:**
- Consumes: `marketing.pricing` value `{ eyebrow?, heading?, lead?, plan_slugs: string[] }`.
- Consumes: `plans` collection entries (Task 2 fields).
- Produces: `types["marketing.pricing"] = Pricing`.

- [ ] **Step 1: Declare the pricing block type in the plugin**

In `packages/lp-blocks/index.mjs`, add to the `portableTextBlocks` array:

```js
{
  type: "marketing.pricing",
  label: "LP · Pricing",
  icon: "link",
  placeholder: "Pricing",
  fields: [
    { type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
    { type: "text_input", action_id: "heading", label: "Heading" },
    { type: "text_input", action_id: "lead", label: "Lead" },
    { type: "text_input", action_id: "plan_slugs", label: "Plan slugs (comma-separated)" },
  ],
},
```

Note: `plan_slugs` is entered as a comma-separated string in the editor; the component splits it. This avoids a repeater field in the spike.

- [ ] **Step 2: Create the Pricing component**

Create `src/components/lp/blocks/Pricing.astro`. It fetches the referenced plans and renders the featured plan + the rest, using `.plan-featured*`, `.plans-grid`, `.plan-card*`, `.btn--accent-block`, `.btn--brand-outline` classes:

```astro
---
import { getEmDashCollection } from "emdash";
interface Props {
  value: { eyebrow?: string; heading?: string; lead?: string; plan_slugs?: string };
}
const { value } = Astro.props;
const slugs = (value.plan_slugs ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const { entries } = await getEmDashCollection("plans", { where: { slug: slugs } });
const bySlug = new Map(entries.map((e) => [e.id, e]));
const plans = slugs.map((s) => bySlug.get(s)).filter(Boolean);
const featured = plans.find((p) => p.data.featured);
const rest = plans.filter((p) => !p.data.featured);
---
<section id="planos" class="sec" style="background:var(--surface-page)">
  <div class="sec__inner">
    <div class="reveal" style="text-align:center;margin-bottom:3.5rem">
      {value.eyebrow && <span class="eyebrow eyebrow--brand">{value.eyebrow}</span>}
      {value.heading && <h2 class="heading-lg" style="margin-top:var(--space-4)">{value.heading}</h2>}
      {value.lead && <p class="sec__lead" style="margin-left:auto;margin-right:auto">{value.lead}</p>}
    </div>
    {featured && (
      <div class="plan-featured reveal">
        <div class="plan-featured__blob"></div>
        {featured.data.badge && <div class="plan-featured__pop">{featured.data.badge}</div>}
        <div class="plan-featured__grid">
          <div>
            <h4>{featured.data.name}</h4>
            {featured.data.tagline && <p class="plan-featured__sub">{featured.data.tagline}</p>}
            <div class="plan-featured__feats">
              {(featured.data.features ?? []).map((f) => <div>{f}</div>)}
            </div>
          </div>
          <div class="plan-price">
            {featured.data.price_old && <p class="plan-price__old">{featured.data.price_old}</p>}
            <div class="plan-price__row"><span class="big">{featured.data.price_installments}</span></div>
            {featured.data.price_pix && <p class="plan-price__pix">{featured.data.price_pix}</p>}
            <a href={featured.data.cta_url} target="_blank" rel="noopener noreferrer"><button class="btn--accent-block shimmer">{featured.data.cta_label}</button></a>
          </div>
        </div>
      </div>
    )}
    <div class="plans-grid reveal">
      {rest.map((p) => (
        <div class="plan-card">
          <div class="plan-card__head">
            <div><h4>{p.data.name}</h4>{p.data.tagline && <p class="plan-card__tagline">{p.data.tagline}</p>}</div>
            <div class="plan-card__price">
              {p.data.price_old && <p class="plan-card__old">{p.data.price_old}</p>}
              <div class="plan-card__prow"><span class="big">{p.data.price_installments}</span></div>
              {p.data.price_pix && <p class="plan-card__pix">{p.data.price_pix}</p>}
            </div>
          </div>
          <ul class="plan-card__feats">{(p.data.features ?? []).map((f) => <li>{f}</li>)}</ul>
          <a href={p.data.cta_url} target="_blank" rel="noopener noreferrer"><button class="btn--brand-outline">{p.data.cta_label}</button></a>
        </div>
      ))}
    </div>
  </div>
</section>
```

Note: `getEmDashCollection` returns entries whose `.id` is the slug. `where: { slug: [...] }` filters to the referenced plans; the component preserves the editor's order.

- [ ] **Step 3: Register the component**

In `src/components/lp/MarketingBlocks.astro`:

```astro
import Pricing from "./blocks/Pricing.astro";
```
```js
const types = { "marketing.hero": Hero, "marketing.pricing": Pricing };
```

- [ ] **Step 4: Seed a pricing block**

Append to `lp-exemplo`'s `data.content` array:

```json
{
  "_type": "marketing.pricing",
  "_key": "planos",
  "eyebrow": "Planos",
  "heading": "Escolha seu Plano de Batalha",
  "lead": "Investimento que retorna em aprovação.",
  "plan_slugs": "enem-quest-pro, passei-pro"
}
```

- [ ] **Step 5: Re-seed and verify prices come from the collection**

Run: `rm -rf .wrangler/state && pnpm dev` (background), then
`curl -s http://localhost:4321/landing/exemplo | grep -o "Escolha seu Plano de Batalha"` → expect the heading.
`curl -s http://localhost:4321/landing/exemplo | grep -o "12x R\$ 59,90"` → expect the featured price (proves it came from the `plans` collection, not the block).

- [ ] **Step 6: Verify single-source-of-truth (manual)**

In the admin, edit the `enem-quest-pro` plan's `price_installments` to `12x R$ 61,90`, save, reload `/landing/exemplo`, and confirm the new price shows without touching the landing page.

- [ ] **Step 7: Commit**

```bash
git add src/components/lp/blocks/Pricing.astro src/components/lp/MarketingBlocks.astro packages/lp-blocks/index.mjs seed/seed.json
git commit -m "feat(lp): pricing block sourced from plans collection"
```

---

## Task 6: FAQ block (render + accordion)

**Files:**
- Create: `src/components/lp/blocks/Faq.astro`
- Modify: `src/components/lp/MarketingBlocks.astro` (register `marketing.faq`)
- Modify: `packages/lp-blocks/index.mjs` (add `marketing.faq` type)
- Modify: `seed/seed.json` (add a FAQ block to `lp-exemplo`)

**Interfaces:**
- Consumes: `marketing.faq` value `{ eyebrow?, heading?, items: string }` where `items` is newline-separated `Question | Answer` lines.
- Produces: `types["marketing.faq"] = Faq`.

- [ ] **Step 1: Declare the FAQ block type in the plugin**

In `packages/lp-blocks/index.mjs`, add to `portableTextBlocks`:

```js
{
  type: "marketing.faq",
  label: "LP · FAQ",
  icon: "link",
  placeholder: "FAQ",
  fields: [
    { type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
    { type: "text_input", action_id: "heading", label: "Heading" },
    { type: "text_input", action_id: "items", label: "Items (one per line: Question | Answer)", multiline: true },
  ],
},
```

- [ ] **Step 2: Create the FAQ component**

Create `src/components/lp/blocks/Faq.astro`. The accordion toggle JS already lives in `LandingShell` (from the reference `.faq-toggle` handler). Uses `.faq`, `.faq__item`, `.faq-toggle`, `.faq-body` classes:

```astro
---
interface Props { value: { eyebrow?: string; heading?: string; items?: string }; }
const { value } = Astro.props;
const items = (value.items ?? "")
  .split("\n").map((l) => l.trim()).filter(Boolean)
  .map((l) => { const [q, ...a] = l.split("|"); return { q: (q ?? "").trim(), a: a.join("|").trim() }; })
  .filter((it) => it.q);
---
<section id="faq" class="sec" style="background:var(--surface-page)">
  <div class="faq">
    <div class="reveal" style="text-align:center;margin-bottom:var(--space-12)">
      {value.eyebrow && <span class="eyebrow eyebrow--accent">{value.eyebrow}</span>}
      {value.heading && <h2 class="heading-lg" style="margin-top:var(--space-4);font-size:clamp(30px,4vw,48px)">{value.heading}</h2>}
    </div>
    <div class="reveal">
      {items.map((it) => (
        <div class="faq__item">
          <button class="faq-toggle"><span class="q">{it.q}</span><span class="faq-icon faq-plus">+</span><span class="faq-icon faq-minus">−</span></button>
          <div class="faq-body"><div>{it.a}</div></div>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Register the component**

In `src/components/lp/MarketingBlocks.astro`:

```astro
import Faq from "./blocks/Faq.astro";
```
```js
const types = { "marketing.hero": Hero, "marketing.pricing": Pricing, "marketing.faq": Faq };
```

- [ ] **Step 4: Seed a FAQ block**

Append to `lp-exemplo`'s `data.content`:

```json
{
  "_type": "marketing.faq",
  "_key": "faq",
  "eyebrow": "Dúvidas",
  "heading": "Perguntas Frequentes",
  "items": "O caderno físico tem custo de frete? | O frete é grátis para todo o Brasil.\nPor quanto tempo terei acesso? | 12 meses a partir da confirmação do pagamento.\nO banco de questões é só do ENEM? | Não — inclui FUVEST, UNICAMP, UNESP, UERJ e outros."
}
```

- [ ] **Step 5: Re-seed and verify**

Run: `rm -rf .wrangler/state && pnpm dev` (background), then
`curl -s http://localhost:4321/landing/exemplo | grep -c "faq-toggle"` → expect `3` (three questions).

- [ ] **Step 6: Verify the accordion (manual)**

Open `/landing/exemplo`, click a FAQ question, confirm it expands and others collapse (proves the shell JS binds the seeded markup).

- [ ] **Step 7: Commit**

```bash
git add src/components/lp/blocks/Faq.astro src/components/lp/MarketingBlocks.astro packages/lp-blocks/index.mjs seed/seed.json
git commit -m "feat(lp): faq block with accordion"
```

---

## Task 7: Acceptance verification against the spec

**Files:** none (verification only).

- [ ] **Step 1: Typecheck the whole project**

Run: `pnpm exec astro check`
Expected: no new errors introduced by the LP work.

- [ ] **Step 2: Full render check**

With `pnpm dev` running:
```
curl -s http://localhost:4321/landing/exemplo | grep -oE "hero__title|Escolha seu Plano de Batalha|faq-toggle" | sort | uniq -c
```
Expected: `hero__title` ×1, the pricing heading ×1, `faq-toggle` ×3.

- [ ] **Step 3: Confirm the legacy LP is untouched**

Run: `git status --short -- "src/pages/lp/[slug].astro"`
Expected: no output (unchanged). And `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/lp/enem-quest-pro` still resolves via the CMS path (200 if the `lp` entry exists locally; otherwise unchanged behavior).

- [ ] **Step 4: Acceptance criteria walkthrough (manual, from the spec)**

Confirm each: (1) dev boots, types include `landing_pages`+`plans`; (2) the example LP shows the 3 blocks as forms in the admin; (3) inserting any of the 3 block types works from the editor menu; (4) `/landing/exemplo` renders with the design system; (5) changing a plan price reflects on the LP; (6) `/lp/enem-quest-pro` unaffected.

- [ ] **Step 5: Stop the dev server**

Run: `pkill -f "astro dev"`

---

## Self-review notes

- Spec coverage: `landing_pages` + `plans` (Task 2); local plugin w/ Block Kit fields (Tasks 1,4,5,6); rendering components + DS CSS + shell + route (Task 3–6); sample content (Tasks 2,4,5,6); acceptance criteria (Task 7). `testimonials` and the remaining ~9 blocks are explicitly Phase 2 (out of this plan). ✅
- The plugin build-vs-no-build unknown is isolated to Task 1 with explicit fallbacks; nothing downstream hard-codes a build assumption. ✅
- Type names consistent: block map key `types`, `_type` values `marketing.hero|pricing|faq`, plan fields identical across Task 2 and Task 5. ✅
- Production seeding caveat carried from the spec: Task 2 targets local dev (empty D1); prod collection creation is out of scope. ✅
