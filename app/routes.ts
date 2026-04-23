/**
 * ===========================================================================
 * app/routes.ts  —  ROUTE CONFIGURATION
 * ===========================================================================
 * React Router v7 "framework mode" supports TWO ways to declare routes:
 *
 *   1. FILE-BASED (@react-router/fs-routes):
 *        You install a plugin and drop files in `app/routes/`; their names
 *        encode the URL (e.g. `sports.$sport.tsx` → `/sports/:sport`).
 *        Pros: zero boilerplate, feels like Remix.
 *        Cons: the URL ↔ file naming convention is hard to grok, refactors
 *              are noisy, and nesting layouts via naming gets ugly fast.
 *
 *   2. CONFIG-BASED (this file):
 *        You export an array of route objects built with the helpers below.
 *        Pros: explicit, refactor-friendly, easy to read at a glance, and
 *              supports arbitrary file locations.
 *        Cons: one more file to touch when adding routes.
 *
 *   Senior-level opinion: config-based scales better in large teams because
 *   the route tree is visible in ONE place. This is what you'll likely see
 *   in the sportsbook codebase you're interviewing for.
 *
 *
 * ---------------------------------------------------------------------------
 * The four helpers:
 * ---------------------------------------------------------------------------
 *   index("file.tsx")               → the default child route (no path segment)
 *   route("path", "file.tsx", [...])→ a normal route segment, optional children
 *   layout("file.tsx", [...])       → a "pathless" route that renders a
 *                                      shared UI (<Outlet/>) for its children
 *                                      but adds NOTHING to the URL.
 *   prefix("segment", [...])        → groups children under a URL prefix
 *                                      without a wrapping component.
 *
 * Dynamic segments: use `:param` in the path string. `:param?` makes it
 * optional. `*` is a splat (catch-all) segment.
 *
 * ---------------------------------------------------------------------------
 * The tree below models a real sportsbook information architecture:
 *
 *   /                             ← home (featured events)
 *   /live                         ← live/in-play page (Phase 4)
 *   /sports                       ← all sports
 *   /sports/:sport                ← league list for one sport
 *   /sports/:sport/:league        ← events for one league
 *   /events/:eventId              ← market detail (Phase 2+)
 *   /login   /register            ← pathless "auth" layout (Phase 5)
 *   /account /account/bets ...    ← protected area       (Phase 5)
 *   *                             ← 404 catch-all
 *
 * The outermost `layout(...)` is our "shell" — the sticky header, sidebar,
 * and bet slip column. It wraps everything EXCEPT the auth pages, which use
 * their own minimal layout.
 * ===========================================================================
 */
import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // -------------------------------------------------------------------------
  // Main app shell (header + sidebar + bet slip). Pathless layout.
  // -------------------------------------------------------------------------
  layout("routes/_shell.tsx", [
    index("routes/home.tsx"),

    route("live", "routes/live.tsx"),

    // `prefix("sports", [...])` is equivalent to writing `route("sports/...")`
    // for each child. It groups without introducing a wrapping component.
    ...prefix("sports", [
      index("routes/sports._index.tsx"),          // → /sports
      route(":sport", "routes/sports.$sport.tsx", [
        // A nested child: /sports/:sport/:league
        route(":league", "routes/sports.$sport.$league.tsx"),
      ]),
    ]),

    route("events/:eventId", "routes/events.$eventId.tsx"),

    // Phase 5: protected area. `/account` lives INSIDE the shell so it
    // keeps the header/sidebar/bet-slip chrome. The `requireUser` check
    // happens in the loader itself — see routes/account.tsx.
    route("account", "routes/account.tsx"),
  ]),

  // -------------------------------------------------------------------------
  // Auth area uses a DIFFERENT layout (minimal, centered card). This
  // demonstrates that different parts of the app can have totally different
  // shells. In Phase 5 this layout will also redirect authenticated users
  // away from /login via a loader.
  // -------------------------------------------------------------------------
  layout("routes/_auth.tsx", [
    route("login",    "routes/auth.login.tsx"),
    route("register", "routes/auth.register.tsx"),
  ]),

  // -------------------------------------------------------------------------
  // Resource route (Phase 3): action-only endpoint for bet slip mutations.
  // Lives OUTSIDE the shell because it has no component — no layout needed.
  // Every <fetcher.Form action="/bet-slip" method="post"> posts here.
  // -------------------------------------------------------------------------
  route("bet-slip", "routes/bet-slip.tsx"),

  // Phase 5: logout is an action-only resource route. No UI, posted to
  // from the Header's <Form action="/logout" method="post">.
  route("logout", "routes/logout.tsx"),

  // -------------------------------------------------------------------------
  // Splat route = catch-all 404. Matches any path not matched above.
  // `*` is the splat param name; you can read it with `params["*"]`.
  // -------------------------------------------------------------------------
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
