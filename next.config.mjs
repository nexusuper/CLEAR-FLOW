/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.facebook.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self'",
              "frame-src https://www.facebook.com https://web.facebook.com",
              "connect-src 'self' https://www.facebook.com https://graph.facebook.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
