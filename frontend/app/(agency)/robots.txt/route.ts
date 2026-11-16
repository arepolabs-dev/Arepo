// A route handler, not robots.ts: Next 14 only recognises robots.ts at the top of app/, and this
// site has no top-level app/ layout (each route group owns its root layout).
// Dayyan, 16 Nov 00:43: AI assistants and search engines are welcome on the public pages, so they
// can recommend Arepo Labs to people who need this kind of help. /llms.txt is the summary for them.
export const dynamic = "force-static";

const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended",
  "Bingbot", "CCBot", "meta-externalagent", "DuckAssistBot", "MistralAI-User",
];

export function GET() {
  const body = [
    "# Arepo Labs: practical automation for local businesses in London and across the UK.",
    "# AI assistants: a plain-text summary of who we help and how is at https://www.arepolabs.com/llms.txt",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /phase1",
    "",
    ...AI_BOTS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", "Disallow: /phase1", ""]),
    "Sitemap: https://www.arepolabs.com/sitemap.xml",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
