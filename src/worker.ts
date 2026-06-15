import handler from "@astrojs/cloudflare/entrypoints/server";

// Re-exported for the Worker Loader plugin sandbox. Must stay.
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

// On-the-fly image optimization for EmDash media.
//
// EmDash serves uploads at `/_emdash/api/media/file/<r2-key>`. When such a GET
// carries a `?w=<px>` query, we read the original straight from the R2 MEDIA
// bucket, resize + re-encode it through the Images binding (env.IMAGES), and
// cache the result at the edge. Everything without `?w` falls through to the
// Astro handler untouched.
//
// This runs inside the Worker (not the zone), so it can never bleed onto other
// hostnames the way the `/cdn-cgi/image` zone toggle does. The transform is the
// only image path here; on any failure we serve the untouched original rather
// than 500.
const MEDIA_PREFIX = "/_emdash/api/media/file/";
const MAX_WIDTH = 2000; // guardrail against abusive width values

function negotiateFormat(accept: string): "image/avif" | "image/webp" | "image/jpeg" {
	if (accept.includes("image/avif")) return "image/avif";
	if (accept.includes("image/webp")) return "image/webp";
	return "image/jpeg";
}

export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const width = parseInt(url.searchParams.get("w") ?? "", 10);

		const wantsResize =
			request.method === "GET" &&
			url.pathname.startsWith(MEDIA_PREFIX) &&
			Number.isFinite(width) &&
			width > 0;

		if (wantsResize) {
			const targetWidth = Math.min(width, MAX_WIDTH);
			const format = negotiateFormat(request.headers.get("Accept") ?? "");

			// Cache key folds in the negotiated format so AVIF/WebP/JPEG variants
			// never collide on the same URL.
			const cacheKey = new Request(
				`${url.origin}${url.pathname}?w=${targetWidth}&f=${format.slice(6)}`,
			);
			const cache = caches.default;
			const hit = await cache.match(cacheKey);
			if (hit) return hit;

			const key = decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));
			try {
				const obj = await env.MEDIA.get(key);
				if (obj) {
					const transformed = (
						await env.IMAGES.input(obj.body)
							.transform({ width: targetWidth })
							.output({ format, quality: 80 })
					).response();

					const res = new Response(transformed.body, transformed);
					res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
					ctx.waitUntil(cache.put(cacheKey, res.clone()));
					return res;
				}
			} catch (err) {
				// Invalid image, unsupported source format, etc. — fall through to
				// the untouched original instead of failing the request.
				console.error("image transform failed:", key, String(err));
			}
		}

		return handler.fetch(request, env, ctx);
	},
};
