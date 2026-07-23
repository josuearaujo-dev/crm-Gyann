import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface StatusRow {
  id_pax_servico: string | null
  status: string
  mktzap_message_id: string | null
  created_at: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, is_super_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Perfil sem empresa vinculada" }, { status: 400 })
    }

    const body = await request.json()
    const {
      templateId,
      idPaxServicos,
      tenantId: requestedTenantId,
    } = body as {
      templateId?: string
      idPaxServicos?: string[]
      tenantId?: string | null
    }

    if (!templateId) {
      return NextResponse.json({ statuses: {} })
    }

    const tenantId = requestedTenantId || profile.tenant_id
    if (!profile.is_super_admin && requestedTenantId && requestedTenantId !== profile.tenant_id) {
      return NextResponse.json({ error: "Sem permissão para acessar outra empresa" }, { status: 403 })
    }

    let query = supabase
      .from("mktzap_messages")
      .select("id_pax_servico, status, mktzap_message_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("mktzap_template_id", templateId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })

    if (Array.isArray(idPaxServicos) && idPaxServicos.length > 0) {
      query = query.in("id_pax_servico", idPaxServicos)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: "Erro ao consultar mensagens enviadas" }, { status: 500 })
    }

    const statuses: Record<string, { status: string; messageId: string; createdAt: string }> = {}
    ;(data as StatusRow[] | null)?.forEach((row) => {
      const key = row.id_pax_servico || "NO_ID_PAX_SERVICO"
      if (!statuses[key]) {
        statuses[key] = {
          status: row.status || "sent",
          messageId: row.mktzap_message_id || "",
          createdAt: row.created_at,
        }
      }
    })

    return NextResponse.json({ statuses })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao consultar status MKTZAP" },
      { status: 500 },
    )
  }
}
