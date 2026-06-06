/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deal-radar/shared-types', '@deal-radar/validation-engine', '@deal-radar/ai-engine']
};

export default nextConfig;
