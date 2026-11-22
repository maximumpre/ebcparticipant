/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // /login → / owned by middleware nextWithHeaders AFTER Sector E cloak
  // (cold direct hits must get ErrorScreen 200, not a pre-middleware 308).
}

export default nextConfig
