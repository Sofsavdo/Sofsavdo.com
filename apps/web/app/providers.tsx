"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/services/session";
import { AdminSessionProvider } from "@/services/adminSession";
import { BuyerSessionProvider } from "@/services/buyerSession";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // Do not retry on 401 Unauthorized errors
              if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
                return false;
              }
              // Retry other errors once
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AdminSessionProvider>
          <BuyerSessionProvider>{children}</BuyerSessionProvider>
        </AdminSessionProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
