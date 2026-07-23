import { createAdminClient } from "@/lib/supabase/admin"
import { isTokenEncryptionConfigured, resolveAccessToken } from "@/lib/crypto"
import type { WhatsAppConnectionMode, WhatsAppCredential } from "@/lib/types"

export interface ResolvedWhatsAppCredentials {
  id: string
  tenantId: string
  accessToken: string
  phoneNumberId: string
  wabaId: string | null
  businessId: string | null
  displayPhoneNumber: string | null
  connectionMode: WhatsAppConnectionMode
  coexistenceEnabled: boolean
  connectionStatus: string
  isActive: boolean
}

function getConnectionMode(row: WhatsAppCredential): WhatsAppConnectionMode {
  return row.connection_mode ?? "manual"
}

export function toPublicWhatsAppIntegration(row: WhatsAppCredential) {
  return {
    id: row.id,
    connectionMode: getConnectionMode(row),
    status: row.connection_status ?? (row.is_active ? "connected" : "disconnected"),
    displayPhoneNumber: row.display_phone_number ?? null,
    wabaId: row.business_account_id ?? null,
    phoneNumberId: row.phone_number_id,
    businessId: row.business_id ?? null,
    coexistenceEnabled: row.coexistence_enabled ?? false,
    historySyncStatus: row.history_sync_status ?? null,
    connectedAt: row.connected_at ?? null,
    disconnectedAt: row.disconnected_at ?? null,
    lastWebhookAt: row.last_webhook_at ?? null,
    lastError: row.last_error ?? null,
    isActive: row.is_active,
    hasToken: !!(row.access_token_encrypted || row.access_token),
    tokenEncryptionEnabled: isTokenEncryptionConfigured(),
  }
}

export async function getWhatsAppCredentialsForTenant(
  tenantId: string,
): Promise<ResolvedWhatsAppCredentials | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("whatsapp_credentials")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const row = data as WhatsAppCredential
  const status = row.connection_status ?? "connected"

  if (status === "disconnected" || status === "expired" || status === "error") {
    return null
  }

  const accessToken = resolveAccessToken(row)
  const phoneNumberId = String(row.phone_number_id || "").trim()

  if (!phoneNumberId) {
    return null
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    accessToken,
    phoneNumberId,
    wabaId: row.business_account_id ?? null,
    businessId: row.business_id ?? null,
    displayPhoneNumber: row.display_phone_number ?? null,
    connectionMode: getConnectionMode(row),
    coexistenceEnabled: row.coexistence_enabled ?? false,
    connectionStatus: status,
    isActive: row.is_active,
  }
}

export async function findWhatsAppCredentialsByPhoneNumberId(
  phoneNumberId: string,
): Promise<(WhatsAppCredential & { accessToken: string }) | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("whatsapp_credentials")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const row = data as WhatsAppCredential

  return {
    ...row,
    accessToken: resolveAccessToken(row),
  }
}

export function isCoexistenceFeatureEnabled(): boolean {
  return (
    process.env.WHATSAPP_COEXISTENCE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_WHATSAPP_COEXISTENCE_ENABLED === "true"
  )
}

export function getMetaGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v21.0"
}
