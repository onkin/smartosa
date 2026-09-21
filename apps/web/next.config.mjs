/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for `next build`. Leaving it on in `next dev` mixes
  // pages/_document chunks into the App Router cache and breaks routes.
  ...(process.env.NODE_ENV === 'production' ? {output: 'export'} : {}),
  images: {unoptimized: true},
  trailingSlash: false,
  transpilePackages: ['@smartosa/core', '@smartosa/brand'],
};

export default nextConfig;
