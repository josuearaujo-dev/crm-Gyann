import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  consumeOAuthSession,
  exchangeCodeForToken,
  fetchPhoneNumberDetails,
  saveCoexistenceCredentials,
  subscribeAppToWaba,
} from "@/lib/whatsapp-coexistence"
import { isCoexistenceFeatureEnabled, toPublicWhatsAppIntegration } from "@/lib/whatsapp-credentials"
import type { WhatsAppCredential } from "@/lib/types"
import { logError, getErrorContext } from "@/lib/error-logger"

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
      .select("id, tenant_id, role, is_super_admin")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 })
    }

    const body = await request.json()
    const code = typeof body.code === "string" ? body.code.trim() : ""
    const state = typeof body.state === "string" ? body.state.trim() : ""
    const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : ""
    const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : ""
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : null
    const tenantId =
      (typeof body.tenantId === "string" && body.tenantId) || profile.tenant_id

    if (!code || !state) {
      return NextResponse.json({ error: "code e state são obrigatórios" }, { status: 400 })
    }

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 })
    }

    if (!profile.is_super_admin && tenantId !== profile.tenant_id) {
      return NextResponse.json({ error: "Sem permissão para outra empresa" }, { status: 403 })
    }

    if (!wabaId || !phoneNumberId) {
      return NextResponse.json(
        {
          error:
            "wabaId e phoneNumberId são obrigatórios. Conclua o fluxo na janela da Meta até selecionar o número.",
        },
        { status: 400 },
      )
    }

    const sessionResult = await consumeOAuthSession(state, tenantId, user.id)
    if (!sessionResult.ok) {
      return NextResponse.json({ error: sessionResult.error }, { status: 400 })
    }

    const tokenResult = await exchangeCodeForToken(code)
    const phoneDetails = await fetchPhoneNumberDetails(phoneNumberId, tokenResult.accessToken)

    try {
      await subscribeAppToWaba(wabaId, tokenResult.accessToken)
    } catch (subscribeError) {
      console.error("[coexistence] WABA subscribe warning:", subscribeError)
      // Continua — a assinatura pode já existir ou exigir permissões avançadas
    }

    const saved = await saveCoexistenceCredentials({
      tenantId,
      accessToken: tokenResult.accessToken,
      wabaId,
      phoneNumberId,
      businessId,
      displayPhoneNumber: phoneDetails.displayPhoneNumber,
      expiresIn: tokenResult.expiresIn,
    })

    return NextResponse.json({
      success: true,
      integration: toPublicWhatsAppIntegration(saved as WhatsAppCredential),
    })
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), "WHATSAPP_COEXISTENCE_COMPLETE_ERROR", {
      ...getErrorContext(request),
      statusCode: 500,
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao finalizar conexão" },
      { status: 500 },
    )
  }
}
