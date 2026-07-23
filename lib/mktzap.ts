// Utilitário server-side para MKTZAP: token cacheado + chamadas à API

const tokenCache = new Map<string, { token: string; expiresAt: number }>()
const TOKEN_DURATION_MS = 55 * 60 * 1000 // 55 minutos

export async function getMktzapToken(companyId: string, clientKey: string, tenantId: string): Promise<string> {
  // Verifica cache
  const cached = tokenCache.get(tenantId)
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[mktzap] Using cached token for tenant:", tenantId)
    return cached.token
  }

  const url = `https://api.mktzap.com.br/company/${companyId}/token?clientKey=${clientKey}`
  // Log completo para depuração (não deixar em produção com clientKey exposto)
  console.log("[mktzap] Fetching token RAW:", {
    url,
    companyId,
    clientKey,
  })
  // Log seguro, com clientKey mascarado
  console.log("[mktzap] Fetching token:", url.replace(clientKey, "***"))

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[mktzap] Token fetch error:", response.status, errorText)
    throw new Error(`Erro ao buscar token MKTZAP: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const token = data.accessToken || data.token || data.access_token

  if (!token || typeof token !== "string") {
    throw new Error("Token MKTZAP inválido ou ausente na resposta da API")
  }

  console.log("[mktzap] Token fetched successfully")

  // Armazena no cache
  tokenCache.set(tenantId, { token, expiresAt: Date.now() + TOKEN_DURATION_MS })

  return token
}

export interface MktzapApiTemplate {
  id: number
  company_id: number | null
  name: string
  namespace: string
  element_name: string
  policy: string
  language: string
  template: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  use_in_poll: number
  header_type: string | null
  header_template: string | null
  template_type: string | null
  auth_type: string | null
  footer: string | null
  buttons: string | null
  category: string | null
}

export async function fetchMktzapTemplates(companyId: string, token: string): Promise<MktzapApiTemplate[]> {
  const url = `https://api.mktzap.com.br/company/${companyId}/history/post-hsm-template`

  console.log("[mktzap] Fetching templates from:", url)

  const response = await fetch(url, {
    // Endpoint exige POST (GET retorna 405 MethodNotAllowed)
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[mktzap] Templates fetch error:", response.status, errorText)
    throw new Error(`Erro ao buscar templates MKTZAP: ${response.status} - ${errorText}`)
  }

  const result = await response.json()

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("Resposta inesperada da API de templates MKTZAP")
  }

  console.log("[mktzap] Templates fetched:", result.data.length)
  return result.data
}
