/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "cards.scryfall.io" }] },
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};
export default nextConfig;
