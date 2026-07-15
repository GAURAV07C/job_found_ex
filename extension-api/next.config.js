/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/track/open/:id',
        destination: '/api/track/open?id=:id',
      },
      {
        source: '/track/open/:id.png',
        destination: '/api/track/open?id=:id',
      },
      {
        source: '/api/tracking/:id',
        destination: '/api/track/open?id=:id',
      },
    ];
  },
};
module.exports = nextConfig;
