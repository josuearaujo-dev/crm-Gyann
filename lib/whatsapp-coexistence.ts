import { createAdminClient } from "@/lib/supabase/admin"
import { encryptSecret, isTokenEncryptionConfigured } from "@/lib/crypto"
import { getMetaGraphVersion } from "@/lib/whatsapp-credentials"

const GRAPH_BASE = () => `https://graph.facebook.com/${getMetaGraphVersion()}`

export function getMetaAppConfig() {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || ""
  const appSecret = process.env.META_APP_SECRET || ""
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || process.env.NEXT_PUBLIC_META_CONFIG_ID || ""
  const redirectUri = process.env.META_REDIRECT_URI || ""

  return { appId, appSecret, configId, redirectUri }
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  expiresIn?: number
}> {
  const { appId, appSecret, redirectUri } = getMetaAppConfig()

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID e META_APP_SECRET precisam estar configurados no servidor")
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })

  if (redirectUri) {
    params.set("redirect_uri", redirectUri)
  }

  const response = await fetch(`${GRAPH_BASE()}/oauth/access_token?${params.toString()}`, {
    method: "GET",
  })

  const data = await response.json()

  if (!response.ok || !data.access_token) {
    const message = data?.error?.message || "Falha ao trocar código por token na Meta"
    throw new Error(message)
  }

  return {
    accessToken: String(data.access_token),
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
  }
}

export async function debugToken(inputToken: string): Promise<Record<string, unknown>> {
  const { appId, appSecret } = getMetaAppConfig()
  const appToken = `${appId}|${appSecret}`

  const params = new URLSearchParams({
    input_token: inputToken,
    access_token: appToken,
  })

  const response = await fetch(`${GRAPH_BASE()}/debug_token?${params.toString()}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || "Falha ao validar token na Meta")
  }

  return (data?.data || data) as Record<string, unknown>
}

export async function fetchPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
  const response = await fetch(
    `${GRAPH_BASE()}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error("[coexistence] Failed to fetch phone details:", data)
    return { displayPhoneNumber: null, verifiedName: null }
  }

  return {
    displayPhoneNumber: data.display_phone_number ? String(data.display_phone_number) : null,
    verifiedName: data.verified_name ? String(data.verified_name) : null,
  }
}

export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${GRAPH_BASE()}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || "Falha ao assinar o aplicativo na WABA")
  }
}

export async function createOAuthSession(tenantId: string, userId: string): Promise<string> {
  const admin = createAdminClient()
  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await admin.from("whatsapp_oauth_sessions").insert({
    tenant_id: tenantId,
    user_id: userId,
    state,
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(error.message || "Falha ao criar sessão OAuth")
  }

  return state
}

export async function consumeOAuthSession(
  state: string,
  tenantId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("whatsapp_oauth_sessions")
    .select("*")
    .eq("state", state)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Sessão de conexão inválida ou expirada" }
  }

  if (data.used_at) {
    return { ok: false, error: "Esta sessão de conexão já foi utilizada" }
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Sessão de conexão expirada. Inicie novamente." }
  }

  if (data.tenant_id !== tenantId || data.user_id !== userId) {
    return { ok: false, error: "Sessão de conexão não pertence a este usuário/empresa" }
  }

  const { error: updateError } = await admin
    .from("whatsapp_oauth_sessions")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("used_at", null)

  if (updateError) {
    return { ok: false, error: "Não foi possível validar a sessão de conexão" }
  }

  return { ok: true }
}

export async function saveCoexistenceCredentials(input: {
  tenantId: string
  accessToken: string
  wabaId: string
  phoneNumberId: string
  businessId?: string | null
  displayPhoneNumber?: string | null
  expiresIn?: number
}): Promise<Record<string, unknown>> {
  const admin = createAdminClient()

  if (!isTokenEncryptionConfigured()) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY é obrigatória para salvar conexões Coexistence")
  }

  const encrypted = encryptSecret(input.accessToken)
  const tokenExpiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null

  const payload = {
    tenant_id: input.tenantId,
    phone_number_id: input.phoneNumberId,
    business_account_id: input.wabaId,
    business_id: input.businessId || null,
    display_phone_number: input.displayPhoneNumber || null,
    access_token: "",
    access_token_encrypted: encrypted,
    token_expires_at: tokenExpiresAt,
    connection_mode: "coexistence",
    connection_status: "connected",
    coexistence_enabled: true,
    history_sync_status: "pending",
    connected_at: new Date().toISOString(),
    disconnected_at: null,
    last_error: null,
    is_active: true,
  }

  const { data: existing } = await admin
    .from("whatsapp_credentials")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .maybeSingle()

  let result

  if (existing?.id) {
    const { data, error } = await admin
      .from("whatsapp_credentials")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) throw new Error(error.message)
    result = data
  } else {
    const { data, error } = await admin.from("whatsapp_credentials").insert(payload).select("*").single()

    if (error) throw new Error(error.message)
    result = data
  }

  return result
}

export async function disconnectCoexistence(tenantId: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from("whatsapp_credentials")
    .update({
      is_active: false,
      connection_status: "disconnected",
      disconnected_at: new Date().toISOString(),
      access_token: "",
      access_token_encrypted: null,
      last_error: null,
    })
    .eq("tenant_id", tenantId)
    .eq("connection_mode", "coexistence")

  if (error) {
    throw new Error(error.message)
  }
}
