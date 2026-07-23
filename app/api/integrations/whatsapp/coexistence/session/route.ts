import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMetaAppConfig, createOAuthSession } from "@/lib/whatsapp-coexistence"
import { isCoexistenceFeatureEnabled } from "@/lib/whatsapp-credentials"

async function getAuthorizedManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, is_super_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.tenant_id && !profile?.is_super_admin) {
    return { error: NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 }) }
  }

  const canManage =
    profile.is_super_admin || profile.role === "manager" || profile.role === "admin"

  if (!canManage) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }

  return { supabase, profile, user }
}

export async function POST(request: Request) {
  try {
    if (!isCoexistenceFeatureEnabled()) {
      return NextResponse.json({ error: "Coexistence não está habilitado neste ambiente" }, { status: 403 })
    }

    const auth = await getAuthorizedManager()
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const tenantId =
      (typeof body.tenantId === "string" && body.tenantId) || auth.profile.tenant_id

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 })
    }

    if (!auth.profile.is_super_admin && tenantId !== auth.profile.tenant_id) {
      return NextResponse.json({ error: "Sem permissão para outra empresa" }, { status: 403 })
    }

    const { appId, configId } = getMetaAppConfig()

    if (!appId || !configId) {
      return NextResponse.json(
        {
          error:
            "Configure META_APP_ID (ou NEXT_PUBLIC_META_APP_ID) e META_EMBEDDED_SIGNUP_CONFIG_ID no servidor",
        },
        { status: 500 },
      )
    }

    const state = await createOAuthSession(tenantId, auth.user.id)

    return NextResponse.json({
      state,
      appId,
      configId,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar sessão" },
      { status: 500 },
    )
  }
}
