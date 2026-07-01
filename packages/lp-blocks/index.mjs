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
		fields: [{ type: "text_input", action_id: "headline", label: "Headline" }],
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
