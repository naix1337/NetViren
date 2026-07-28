import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
};

export default withNextIntl(config);
