/**
 * Query Hooks لمنطقة المنصة — TanStack Query فوق Platform API الموحد.
 * نفس الـ hooks تعمل في الوضعين (live/demo) بلا أي فرق في الاستهلاك.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import type {
  ProvisionCompanyInput,
  ProvisioningJob,
  PlatformTenantOverview,
  SubscriptionUpdateInput,
} from "@/types"

import {
  computePlatformStats,
} from "./mock-db"
import { getPlatformApi } from "./api"

const api = () => getPlatformApi()

const keys = {
  companies: ["platform", "companies"] as const,
  company: (id: string) => ["platform", "companies", id] as const,
  job: (id: string) => ["platform", "jobs", id] as const,
}

export function usePlatformMode() {
  return api().mode
}

export function useCompanies() {
  return useQuery<PlatformTenantOverview[]>({
    queryKey: keys.companies,
    queryFn: () => api().fetchCompanies(),
  })
}

export function useCompany(tenantId: string) {
  return useQuery<PlatformTenantOverview | null>({
    queryKey: keys.company(tenantId),
    queryFn: () => api().fetchCompany(tenantId),
  })
}

/**
 * مهمة توفير — polling طالما قيد التنفيذ، يتوقف عند succeeded/failed.
 * (في live: كل poll ينفذ خطوة واحدة على الخادم — State machine آمنة)
 */
export function useProvisioningJob(jobId: string | null) {
  return useQuery<ProvisioningJob | null>({
    queryKey: keys.job(jobId ?? "none"),
    queryFn: () => api().pollJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      return data.status === "running" || data.status === "queued" ? 900 : false
    },
  })
}

export function useProvisionCompany() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (input: ProvisionCompanyInput) => api().startProvision(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.companies })
    },
    onError: (err: Error) => {
      // أسباب الخادم المعروفة تُترجم — البقية تظهر كما هي
      if (err.message === "slug_taken") {
        toast.error(t("provisioning.slugTakenToast"))
      } else {
        toast.error(err.message)
      }
    },
  })
}

export function useCompanyAction() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ companyId, action }: { companyId: string; action: string }) =>
      api().startCompanyAction(
        companyId,
        action as Exclude<import("@/types").ProvisioningAction, "provision">,
      ),
    onSuccess: (jobId) => {
      queryClient.invalidateQueries({ queryKey: keys.companies })
      if (jobId) toast.info(t("provisioning.startedToast"))
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSubscriptionUpdate() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (input: SubscriptionUpdateInput) => api().subscriptionUpdate(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: keys.companies })
      if (result.ok) {
        toast.success(t("provisioning.subscriptionUpdatedToast"))
      } else {
        toast.error(result.message ?? t("common.error"))
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function usePlatformStats(
  companies: PlatformTenantOverview[] | undefined,
) {
  return computePlatformStats(companies ?? [])
}
