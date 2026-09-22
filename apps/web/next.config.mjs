/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for `next build`. Leaving it on in `next dev` mixes
  // pages/_document chunks into the App Router cache and breaks routes.
  ...(process.env.NODE_ENV === 'production'
    ? {output: 'export'}
    : {
        async rewrites() {
          return [{source: '/api/discover', destination: 'http://127.0.0.1:4310/api/discover'}];
        },
      }),
  images: {unoptimized: true},
  trailingSlash: false,
  transpilePackages: ['@smartosa/core', '@smartosa/brand'],
};

export default nextConfig;
