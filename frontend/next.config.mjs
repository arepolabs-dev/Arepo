// Arepo (the prediction-market research site) lives under /predictionmarket; `/` is the agency page.
// Every old Arepo path 308-redirects to the prefixed path, query string included (emailed verify,
// reset, unsubscribe, digest and market links keep working). `/` and `/api/*` are NOT redirected.
const PM = "/predictionmarket";
const OLD_PATHS = [
  "markets",
  "signals",
  "replay",
  "research-lab",
  "how-it-works",
  "methodology",
  "opportunities",
  "account",
  "signin",
  "signup",
  "forgot",
  "reset",
  "verify",
  "unsubscribe",
  "lab",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://arepo-api.onrender.com/api/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "arepolabs.com" }],
        destination: "https://www.arepolabs.com/:path*",
        permanent: true,
      },
      ...OLD_PATHS.map((p) => ({ source: `/${p}`, destination: `${PM}/${p}`, permanent: true })),
      ...OLD_PATHS.map((p) => ({
        source: `/${p}/:path*`,
        destination: `${PM}/${p}/:path*`,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
