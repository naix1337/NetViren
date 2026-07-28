## Workstream 1: Root Scaffolding & Shared Configuration

**Files:**
- Create: `package.json` (root workspace)
- Create: `.env.example`
- Create: `.gitignore`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/next.config.ts`
- Create: `packages/frontend/tailwind.config.ts`
- Create: `packages/frontend/postcss.config.js`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "netviren",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:api": "npm run dev -w packages/api",
    "dev:frontend": "npm run dev -w packages/frontend",
    "build:api": "npm run build -w packages/api",
    "build:frontend": "npm run build -w packages/frontend",
    "build": "npm run build:api && npm run build:frontend",
    "start:api": "npm run start -w packages/api",
    "start:frontend": "npm run start -w packages/frontend"
  }
}
```

- [ ] **Step 2: Create .env.example**

```
# Database
DATABASE_PATH=/var/lib/netviren/db/netviren.db

# Auth
AUTH_SECRET=generate-a-random-256-bit-secret
AUTH_URL=http://localhost:3000

# Google OAuth
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# GitHub OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# API
API_PORT=4000
API_HOST=0.0.0.0
FRONTEND_URL=http://localhost:3000
AGENT_HANDLER_PORT=4001

# VirusTotal
VT_API_KEY=
VT_API_URL=https://www.virustotal.com/api/v3

# Discord
DISCORD_WEBHOOK_URL=

# Scan defaults
SCAN_INTERVAL_MINUTES=60
PORT_RANGES=20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017
PACKET_RETENTION_DAYS=7

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.next/
__pycache__/
*.pyc
.env
*.db
*.pcap
packets/
```

- [ ] **Step 4: Create packages/api/package.json**

```json
{
  "name": "@netviren/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/multipart": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "puppeteer": "^23.0.0",
    "node-cron": "^3.0.0",
    "nanoid": "^5.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.0"
  }
}
```

- [ ] **Step 5: Create packages/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Create packages/frontend/package.json**

```json
{
  "name": "@netviren/frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@auth/core": "^0.37.0",
    "next-intl": "^3.26.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.460.0",
    "framer-motion": "^11.0.0",
    "recharts": "^2.15.0",
    "sonner": "^1.7.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-badge": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-progress": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 7: Create packages/frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 8: Create packages/frontend/next.config.ts**

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
};

export default withNextIntl(config);
```

- [ ] **Step 9: Create packages/frontend/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0A0B0E',
        surface: '#111316',
        elevated: '#181B20',
        inset: '#0D0F12',
        hover: '#1F232A',
        'border-default': '#1E2128',
        'border-hover': '#2A2E38',
        'border-active': '#22D3EE',
        'text-primary': '#EDEEF0',
        'text-secondary': '#8B8F9B',
        'text-muted': '#5A5E6A',
        'accent-cyan': '#22D3EE',
        'accent-emerald': '#34D399',
        'accent-violet': '#A78BFA',
        'accent-amber': '#FBBF24',
        'accent-red': '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

- [ ] **Step 10: Create packages/frontend/postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

