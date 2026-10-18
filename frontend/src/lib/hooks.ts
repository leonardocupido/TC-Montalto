import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { Summary, User } from "./types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<User>("/auth/me"),
    retry: false,
  });
}

export function useSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["summary"],
    queryFn: () => apiGet<Summary>("/me/summary"),
    enabled,
    refetchInterval: 30000,
  });
}
