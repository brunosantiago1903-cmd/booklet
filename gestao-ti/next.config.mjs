/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O service worker (public/sw.js) é servido estaticamente; headers garantem escopo correto.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
