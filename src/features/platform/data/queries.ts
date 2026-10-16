/**
 * Query Hooks لمنطقة المنصة — عبر TanStack Query فوق المتجر التجريبي.
 * عند الربط الفعلي: يستبدل جسم queryFn/mutationFn فقط باستدعاءات Supabase.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { CreateTenantInput, PlatformTenantOverview } from "@/types"

import {
  computePlatformStats,
  createCompany,
  fetchCompanies,
  fetchCompany,
} from "./mock-db"

const keys = {
  companies: ["platform", "companies"] as const,
  company: (id: string) => ["platform", "companies", id] as const,
}

export function useCompanies() {
  return useQuery<PlatformTenantOverview[]>({
    queryKey: keys.companies,
    queryFn: fetchCompanies,
  })
}

export function useCompany(tenantId: string) {
  return useQuery<PlatformTenantOverview | null>({
    queryKey: keys.company(tenantId),
    queryFn: () => fetchCompany(tenantId),
  })
}

export function usePlatformStats(
  companies: PlatformTenantOverview[] | undefined,
) {
  return computePlatformStats(companies ?? [])
}

export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTenantInput) => createCompany(input),
    onSuccess: (created) => {
      queryClient.setQueryData<PlatformTenantOverview[]>(
        keys.companies,
        (old) => [...(old ?? []), created],
      )
    },
  })
}
