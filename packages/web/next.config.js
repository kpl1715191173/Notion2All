/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@notion2all/core'],
  images: {
    domains: [
      's3.us-west-2.amazonaws.com',
      'notion.so',
      'www.notion.so',
      'prod-files-secure.s3.us-west-2.amazonaws.com'
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

module.exports = nextConfig;