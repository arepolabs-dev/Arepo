// A route handler, not robots.ts: Next 14 only recognises robots.ts at the top of app/, and this
// site has no top-level app/ layout (each route group owns its root layout).
export const dynamic = "force-static";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /phase1",
    "",
    "Sitemap: https://www.arepolabs.com/sitemap.xml",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
