"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient, isApiClientError } from "@/lib/api-client";
import type { Me } from "@/lib/types";

export function useMe() {
  const { api } = useApiClient();

  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/v1/me"),
    retry: (count, error) => {
      if (isApiClientError(error) && error.status === 401) return false;
      return count < 2;
    },
  });
}
