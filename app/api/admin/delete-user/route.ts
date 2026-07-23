import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function DELETE(request: Request) {
  try {
    const adminClient = getAdminClient()
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: "Apenas super admins podem excluir usuários" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    if (!userId || userId === user.id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório e não é possível excluir a si mesmo" },
        { status: 400 },
      )
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error("[admin] delete-user error:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    const { error: profileDeleteError } = await adminClient.from("profiles").delete().eq("id", userId)

    if (profileDeleteError) {
      console.warn("[admin] profile delete (optional):", profileDeleteError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin] Error in delete-user API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno do servidor" },
      { status: 500 },
    )
  }
}
