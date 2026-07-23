import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMktzapToken } from "@/lib/mktzap"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/mktzap-token" })
}

export async function POST(request: Request) {
  try {
    console.log("[mktzap-token] POST route hit")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role, is_super_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    let requestedTenantId: string | null = null
    try {
      const body = await request.json()
      requestedTenantId = body?.tenantId || null
    } catch {
      requestedTenantId = null
    }

    const userTenantId = profile.tenant_id
    const isSuperAdmin = !!profile.is_super_admin
    const effectiveTenantId = requestedTenantId || userTenantId

    if (!isSuperAdmin && requestedTenantId && requestedTenantId !== userTenantId) {
      return NextResponse.json(
        { error: "Você não tem permissão para acessar credenciais de outra empresa" },
        { status: 403 },
      )
    }

    console.log("[mktzap-token] Tenant selecionado:", {
      requestedTenantId,
      userTenantId,
      effectiveTenantId,
      isSuperAdmin,
    })

    // Busca credenciais MKTZAP do tenant
    const { data: credentials, error: credError } = await supabase
      .from("mktzap_credentials")
      .select("*")
      .eq("tenant_id", effectiveTenantId)
      .eq("is_active", true)
      .maybeSingle()

    if (credError || !credentials) {
      const reason = credError
        ? `${credError.message} (code: ${credError.code ?? "n/a"})`
        : "nenhuma credencial MKTZAP ativa encontrada para o tenant"
      console.log("[mktzap-token] Credenciais não encontradas:", { effectiveTenantId, reason })
      return NextResponse.json(
        {
          error: "Credenciais MKTZAP não configuradas para esta empresa",
          details: reason,
          tenantId: effectiveTenantId,
        },
        { status: 400 },
      )
    }

    const token = await getMktzapToken(credentials.company_id, credentials.client_key, effectiveTenantId)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[mktzap] Error in token API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao buscar token MKTZAP" },
      { status: 500 },
    )
  }
}
