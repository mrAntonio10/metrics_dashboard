import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 💡 clave para Docker runner-only:
  output: 'standalone',

  // (opcional) durante el build estás ignorando errores
  // considera desactivar esto en producción si quieres builds estrictos
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', port: '', pathname: '/**' },
    ],
  },
};

export default nextConfig;
