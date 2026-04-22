import type { Config } from "@react-router/dev/config";

/**
 * ===========================================================================
 * React Router framework-mode build configuration
 * ===========================================================================
 *
 * ssr: true  (default)
 *   Server-render HTML on every request, then hydrate on the client. This is
 *   what a production sportsbook wants for:
 *     - SEO (home/sport/event pages are discoverable)
 *     - Fast first paint (odds visible before JS boots)
 *     - Loader/action semantics that match a traditional SSR framework
 *
 * ssr: false
 *   SPA mode. Only `index.html` is generated; everything runs in the browser.
 *   `loader` still works but runs via `clientLoader` in effect. Use this for
 *   app-like experiences behind auth (e.g. an admin console) or when you
 *   can't run Node at the edge.
 *
 * prerender: ["/","/sports",...] | true | async (args) => string[]
 *   Static prerendering — React Router renders these routes at BUILD time,
 *   emitting `.html` files that a CDN can serve. Great for:
 *     - Marketing / landing pages
 *     - Rarely-changing pages (terms, responsible gambling, static guides)
 *   In a sportsbook you'd typically prerender the marketing shell and keep
 *   live odds fully SSR'd.
 *
 * basename: "/"
 *   Useful when the app is mounted under a subpath (e.g. "/app").
 *
 * Phase 1 sticks with SSR on, no prerendering. In Phase 8 we'll experiment
 * with `prerender` for a few static pages.
 * ===========================================================================
 */
export default {
  ssr: true,
} satisfies Config;
