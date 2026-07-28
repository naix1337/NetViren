'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#181B20',
            border: '1px solid #1E2128',
            color: '#EDEEF0',
          },
        }}
      />
    </SessionProvider>
  );
}
