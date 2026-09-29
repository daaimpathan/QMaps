/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiOrigin = (process.env.QMAPS_API_ORIGIN || 'http://localhost:8000').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
