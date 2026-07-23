import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ClientApiCredential } from "@/lib/types"

export interface ClientApiAuthContext {
  tenantId: string
  credentialId: string
  credentialName: string
}

export function generateClientId(): string {
  return `cli_${randomBytes(8).toString("hex")}`
}

export function generateApiSecret(): string {
  return `sk_${randomBytes(24).toString("base64url")}`
}

export function hashApiSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export function getSecretPrefix(secret: string): string {
  return secret.slice(-4)
}

export function verifyApiSecret(secret: string, secretHash: string): boolean {
  const candidate = hashApiSecret(secret)

  try {
    return timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(secretHash, "utf8"))
  } catch {
    return false
  }
}

export function parseClientApiCredentials(request: Request): { clientId: string; secret: string } | null {
  const authHeader = request.headers.get("authorization")

  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8")
    const separatorIndex = decoded.indexOf(":")

    if (separatorIndex <= 0) {
      return null
    }

    return {
      clientId: decoded.slice(0, separatorIndex),
      secret: decoded.slice(separatorIndex + 1),
    }
  }

  const clientId = request.headers.get("x-client-id")
  const secret = request.headers.get("x-api-secret")

  if (!clientId || !secret) {
    return null
  }

  return { clientId, secret }
}

export async function authenticateClientApiRequest(request: Request): Promise<ClientApiAuthContext | null> {
  const credentials = parseClientApiCredentials(request)

  if (!credentials) {
    return null
  }

  const admin = createAdminClient()

  const { data: storedCredential, error } = await admin
    .from("client_api_credentials")
    .select("*")
    .eq("client_id", credentials.clientId)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !storedCredential) {
    return null
  }

  const credential = storedCredential as ClientApiCredential & { secret_hash: string }

  if (!verifyApiSecret(credentials.secret, credential.secret_hash)) {
    return null
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, is_active")
    .eq("id", credential.tenant_id)
    .maybeSingle()

  if (!tenant?.is_active) {
    return null
  }

  void admin
    .from("client_api_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", credential.id)

  return {
    tenantId: credential.tenant_id,
    credentialId: credential.id,
    credentialName: credential.name,
  }
}
