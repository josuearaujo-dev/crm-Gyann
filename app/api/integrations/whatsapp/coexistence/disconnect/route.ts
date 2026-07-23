import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { disconnectCoexistence } from "@/lib/whatsapp-coexistence"
import { isCoexistenceFeatureEnabled } from "@/lib/whatsapp-credentials"

export async function POST(request: Request) {
  try {
    if (!isCoexistenceFeatureEnabled()) {
      return NextResponse.json({ error: "Coexistence não está habilitado neste ambiente" }, { status: 403 })
    }

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

    const body = await request.json().catch(() => ({}))
    const tenantId =
      (typeof body.tenantId === "string" && body.tenantId) || profile?.tenant_id

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 })
    }

    if (!profile?.is_super_admin && tenantId !== profile?.tenant_id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const canManage =
      profile?.is_super_admin || profile?.role === "manager" || profile?.role === "admin"

    if (!canManage) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    await disconnectCoexistence(tenantId)

    return NextResponse.json({
      success: true,
      message:
        "Número desconectado do sistema. O WhatsApp Business continua no celular, mas o sistema deixará de enviar e receber mensagens por esta conexão.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar" },
      { status: 500 },
    )
  }
}
