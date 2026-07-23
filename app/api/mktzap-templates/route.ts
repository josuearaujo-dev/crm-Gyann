import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMktzapToken, fetchMktzapTemplates } from "@/lib/mktzap"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/mktzap-templates" })
}

export async function POST(request: Request) {
  try {
    console.log("[mktzap-templates] POST route hit")
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
    const tenantId = requestedTenantId || userTenantId

    if (!isSuperAdmin && requestedTenantId && requestedTenantId !== userTenantId) {
      return NextResponse.json(
        { error: "Você não tem permissão para sincronizar templates de outra empresa" },
        { status: 403 },
      )
    }

    console.log("[mktzap-templates] Tenant selecionado:", {
      requestedTenantId,
      userTenantId,
      effectiveTenantId: tenantId,
      isSuperAdmin,
    })

    // Busca credenciais MKTZAP do tenant
    const { data: credentials, error: credError } = await supabase
      .from("mktzap_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle()

    if (credError || !credentials) {
      const reason = credError
        ? `${credError.message} (code: ${credError.code ?? "n/a"})`
        : "nenhuma credencial MKTZAP ativa encontrada para o tenant"
      console.log("[mktzap-templates] Credenciais não encontradas:", { tenantId, reason })
      return NextResponse.json(
        {
          error: "Credenciais MKTZAP não configuradas para esta empresa",
          details: reason,
          tenantId,
        },
        { status: 400 },
      )
    }

    // Busca token
    const token = await getMktzapToken(credentials.company_id, credentials.client_key, tenantId)

    // Busca templates da API MKTZAP
    const apiTemplates = await fetchMktzapTemplates(credentials.company_id, token)

    // Busca templates existentes no banco para preservar mapeamentos
    const { data: existingTemplates } = await supabase
      .from("mktzap_templates")
      .select("*")
      .eq("tenant_id", tenantId)

    const existingMap = new Map(
      (existingTemplates || []).map((t) => [t.mktzap_id, t])
    )

    // Sincroniza: upsert de cada template
    let synced = 0
    let created = 0
    let updated = 0

    for (const apiTpl of apiTemplates) {
      // Pula templates deletados
      if (apiTpl.deleted_at) continue

      const existing = existingMap.get(apiTpl.id)

      if (existing) {
        // Atualiza nome, template, language, header_template, updated_at_mktzap
        const { error: updateError } = await supabase
          .from("mktzap_templates")
          .update({
            name: apiTpl.name,
            language: apiTpl.language,
            template: apiTpl.template,
            header_template: apiTpl.header_template || null,
            updated_at_mktzap: apiTpl.updated_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (!updateError) updated++
      } else {
        // Cria novo
        const { error: insertError } = await supabase
          .from("mktzap_templates")
          .insert({
            tenant_id: tenantId,
            mktzap_id: apiTpl.id,
            name: apiTpl.name,
            language: apiTpl.language,
            template: apiTpl.template,
            header_template: apiTpl.header_template || null,
            broker_phone: null,
            updated_at_mktzap: apiTpl.updated_at,
            parameter_mapping: {},
            dynamic_parameter_flags: {},
            is_passeio: false,
            is_active: false,
          })

        if (!insertError) created++
      }

      synced++
    }

    console.log(`[mktzap] Templates sync: ${synced} total, ${created} created, ${updated} updated`)

    return NextResponse.json({
      success: true,
      total: synced,
      created,
      updated,
    })
  } catch (error) {
    console.error("[mktzap] Error syncing templates:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar templates MKTZAP" },
      { status: 500 },
    )
  }
}
