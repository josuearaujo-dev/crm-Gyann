import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { toPublicWhatsAppIntegration } from "@/lib/whatsapp-credentials"
import type { WhatsAppCredential } from "@/lib/types"

export async function GET(request: Request) {
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

    const url = new URL(request.url)
    const tenantId = url.searchParams.get("tenantId") || profile?.tenant_id

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 })
    }

    if (!profile?.is_super_admin && tenantId !== profile?.tenant_id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("whatsapp_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        connected: false,
        integration: null,
        coexistenceEnabled: process.env.WHATSAPP_COEXISTENCE_ENABLED === "true",
      })
    }

    return NextResponse.json({
      connected: !!data.is_active && (data.connection_status ?? "connected") === "connected",
      integration: toPublicWhatsAppIntegration(data as WhatsAppCredential),
      coexistenceEnabled: process.env.WHATSAPP_COEXISTENCE_ENABLED === "true",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    )
  }
}
