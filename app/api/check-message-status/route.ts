import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 })
    }

    const { idPaxServicos, startDate, endDate } = await request.json()

    console.log("[v0] Checking status for IdPaxServicos:", idPaxServicos)
    console.log("[v0] Date range:", startDate, "to", endDate)

    if (!Array.isArray(idPaxServicos) || idPaxServicos.length === 0) {
      return NextResponse.json({ statuses: {} })
    }

    let query = supabase
      .from("messages")
      .select("id_pax_servico, status, whatsapp_message_id, status_updated_at, service_date")
      .eq("tenant_id", profile.tenant_id)
      .in("id_pax_servico", idPaxServicos)

    // Adiciona filtro de data se fornecido
    if (startDate && endDate) {
      query = query.gte("service_date", startDate).lte("service_date", endDate)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error("[v0] Error fetching messages:", error)
      return NextResponse.json({ error: "Erro ao buscar mensagens" }, { status: 500 })
    }

    console.log("[v0] Messages found in database:", messages?.length)

    const statuses: Record<string, { status: string; updatedAt: string; messageId: string }> = {}

    messages?.forEach((message) => {
      if (message.id_pax_servico) {
        console.log("[v0] Found message for IdPaxServico:", message.id_pax_servico, "Status:", message.status)

        statuses[message.id_pax_servico] = {
          status: message.status || "unknown",
          updatedAt: message.status_updated_at || "",
          messageId: message.whatsapp_message_id || "",
        }
      }
    })

    console.log("[v0] Final statuses map:", statuses)

    return NextResponse.json({ statuses })
  } catch (error) {
    console.error("[v0] Error in check-message-status:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
