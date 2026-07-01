# Landing pages componíveis — desenho (fatia vertical)

Data: 2026-07-01
Status: aprovado (desenho); pendente spec review do usuário

## Contexto e objetivo

Hoje as landing pages da Passei são um blob de HTML colado no tipo de conteúdo `lp`
(servido por `src/pages/lp/[slug].astro`). Isso não usa o CMS de verdade: não dá pra
o marketing montar/editar sem código, e não há reuso entre LPs.

Objetivo: permitir que **o marketing (não-dev) monte uma landing page selecionando e
reordenando blocos reutilizáveis no admin do EmDash**, com os blocos e dados
(preços, depoimentos) mantidos em um só lugar. Claude cria os blocos; o marketing os
compõe.

A referência visual/estrutural é a `enem-quest-pro` (11+ seções: hero, stats, dores,
3 pilares, método M.A.P., pricing, depoimentos, garantia, FAQ, CTA final, footer).

## Abordagem escolhida

"Opção C": blocos de Portable Text componíveis, usando as features nativas do EmDash.

- **Tema (este projeto Astro):** renderização. Componentes `.astro` de cada bloco,
  coleções (via seed), design system CSS, JS de interação, rota e layout. Não há
  camada de tema separada — o tema É o projeto Astro.
- **Plugin nativo local `packages/lp-blocks`:** edição no admin. Declara os *tipos*
  de bloco com formulários (Block Kit `fields`), aparecendo no menu de inserção do
  editor. Mínimo: só declarações de edição, sem componentes de renderização (o tema
  renderiza).
- **Conexão:** a string `_type` (ex.: `marketing.hero`). O plugin declara o tipo
  (edição); o tema renderiza o tipo (componente Astro via `<PortableText components>`).

Formato "nativo local" é o certo: plugins nativos são registrados direto no
`astro.config` `plugins: [...]` (como já são `formsPlugin()`, `embedsPlugin()`, etc.),
ficam versionados no repo, e nem podem ir pra marketplace (que é só sandboxed).

## Fora de escopo / não muda

- A `enem-quest-pro` no ar (raw HTML, servida repo-first por `src/lp-content/` +
  `src/pages/lp/[slug].astro`) permanece intacta. O novo sistema é paralelo.
- Nenhuma migração da LP atual nesta fase.
- Sem A/B testing nesta fase (fica pra depois, provavelmente via PostHog flags).

## Fatia vertical (o que esta entrega inclui)

### 1. Dados (coleções via seed)

- `landing_pages`
  - `title` (string, obrigatório)
  - `content` (portableText) — onde o marketing compõe os blocos
  - system: `slug`, `status` (drafts), `seo`
- `plans` (fonte única de preço, referenciada pelo bloco de pricing)
  - `name` (string), `badge` (string, opcional), `tagline` (string, opcional)
  - `price_installments` (string, ex. "12x R$ 59,90")
  - `price_pix` (string, ex. "ou R$ 599,00 no PIX")
  - `price_old` (string, opcional, ex. "De R$ 1.437,60")
  - `features` (json — lista de strings)
  - `cta_label` (string), `cta_url` (string)
  - `featured` (boolean — estilo destaque)

`testimonials` fica para a fase 2 (junto do bloco de depoimentos).

### 2. Plugin local `packages/lp-blocks` (declarações de edição)

Declara três tipos de bloco com Block Kit `fields`:

- `marketing.hero` — `eyebrow`, `headline`, `lead`, `cta_primary_label`,
  `cta_primary_url`, `cta_secondary_label`, `cta_secondary_url`, `media_url`.
- `marketing.pricing` — `eyebrow`, `heading`, `lead`, `plan_slugs` (quais `plans`
  mostrar; o marketing escolhe, o preço vem da coleção).
- `marketing.faq` — `eyebrow`, `heading`, `items` (lista de pergunta/resposta).

Registrado em `astro.config.mjs` no array `plugins`.

### 3. Renderização (no tema)

- `src/components/lp/blocks/Hero.astro`, `Pricing.astro`, `Faq.astro`.
  - `Pricing.astro` consulta `getEmDashCollection("plans", ...)` pelos `plan_slugs`.
- `src/styles/lp-ds.css` — design system violet/orange extraído da `enem-quest-pro`
  (tokens + classes de componente).
- `src/layouts/LandingShell.astro` — nav + footer + JS (nav-scroll, FAQ accordion,
  reveal-on-scroll, lightbox). Carrega `lp-ds.css`.
- `src/pages/landing/[slug].astro` — SSR: busca a `landing_pages` por slug, chama
  `Astro.cache.set(cacheHint)`, renderiza `content` com `<PortableText components>`
  (mapeando `marketing.*` → componentes) dentro do `LandingShell`. Rota nova; não
  conflita com `/lp/[slug]`.

### 4. Conteúdo de exemplo (seed)

Uma entrada `landing_pages` (slug `exemplo`) composta de: `marketing.hero` +
`marketing.pricing` (referenciando 2 `plans` semeados) + `marketing.faq`.

## Critério de aceite (como validar)

1. `pnpm dev` sobe sem erro; tipos gerados incluem `landing_pages` e `plans`.
2. No admin, editar a `landing_pages` de exemplo mostra os 3 blocos com formulário
   (Block Kit), reordenáveis e editáveis sem tocar em JSON.
3. Inserir um bloco novo via menu do editor funciona (os 3 tipos aparecem).
4. `/landing/exemplo` renderiza os 3 blocos com o design system, pixel-coerente com
   as seções equivalentes da `enem-quest-pro`.
5. Mudar um preço na coleção `plans` reflete em `/landing/exemplo` sem editar a LP.
6. `/lp/enem-quest-pro` continua idêntica (sem regressão).

## Fase 2 (depois do ok da fatia)

Portar os blocos restantes da `enem-quest-pro` (stats, dores, pilares, método,
depoimentos, garantia, CTA final) + coleção `testimonials` + bloco
`marketing.testimonials`. Opcional: migrar a `enem-quest-pro` para o formato
componível.

## Riscos / pontos a confirmar na implementação

- **Empacotamento do plugin local:** confirmar se o descritor nativo pode ser um
  módulo `.mjs`/workspace simples importado pelo `astro.config` sem passo de build,
  ou se precisa de um build (tsdown). Prototipar cedo; é o maior risco técnico.
- **Formulário do bloco no editor:** confirmar que os Block Kit `fields` declarados
  por um plugin nativo aparecem como formulário no editor de Portable Text (a doc diz
  que sim; validar na prática no admin).
- **Seed em D1:** coleções novas no seed só aplicam em DB vazio. Em produção (D1 já
  populado) as coleções `landing_pages`/`plans` precisarão ser criadas via admin/MCP,
  não pelo seed. Local dev (D1 vazio) aplica pelo seed normalmente.
