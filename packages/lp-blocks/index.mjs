import { definePlugin } from "emdash";

// Portable Text block types this plugin contributes to the editor. Each entry
// registers a slash-menu item plus its Block Kit editing form (`fields`). The
// theme renders these `_type`s via <PortableText components>; this plugin only
// owns the *editing* side. Marketing composes an LP by inserting these blocks.
const portableTextBlocks = [
	{
		type: "marketing.hero",
		label: "LP · Hero",
		category: "Marketing",
		icon: "link",
		fields: [
			{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
			{ type: "text_input", action_id: "headline", label: "Headline (aceita <br>, <em>)" },
			{ type: "text_input", action_id: "lead", label: "Lead", multiline: true },
			{ type: "text_input", action_id: "cta_primary_label", label: "CTA primary label" },
			{ type: "text_input", action_id: "cta_primary_url", label: "CTA primary URL" },
			{ type: "text_input", action_id: "cta_secondary_label", label: "CTA secondary label" },
			{ type: "text_input", action_id: "cta_secondary_url", label: "CTA secondary URL" },
			{ type: "text_input", action_id: "media_url", label: "Media URL (imagem/vídeo)" },
		],
	},
	{
		type: "marketing.pricing",
		label: "LP · Pricing",
		category: "Marketing",
		icon: "link",
		fields: [
			{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
			{ type: "text_input", action_id: "heading", label: "Heading" },
			{ type: "text_input", action_id: "lead", label: "Lead" },
			{ type: "text_input", action_id: "plan_slugs", label: "Plan slugs (separados por vírgula)" },
		],
	},
	{
		type: "marketing.faq",
		label: "LP · FAQ",
		category: "Marketing",
		icon: "link",
		fields: [
			{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
			{ type: "text_input", action_id: "heading", label: "Heading" },
			{ type: "text_input", action_id: "items", label: "Itens (uma linha: Pergunta | Resposta)", multiline: true },
		],
	},
];

// Descriptor factory — imported by astro.config at build time and placed in
// emdash({ plugins: [...] }). `entrypoint` points at this package so EmDash can
// load the runtime (default export) in-process.
export function lpBlocksPlugin() {
	return {
		id: "lp-blocks",
		version: "0.1.0",
		format: "native",
		entrypoint: "@passei/lp-blocks",
	};
}

// Runtime factory — EmDash imports this package's default export and calls it.
export function createPlugin() {
	return definePlugin({
		id: "lp-blocks",
		version: "0.1.0",
		admin: { portableTextBlocks },
	});
}

export default createPlugin;
