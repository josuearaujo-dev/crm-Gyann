import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { sendWhatsAppMessage, buildWhatsAppPayload } from "@/lib/whatsapp"
import { getWhatsAppCredentialsForTenant } from "@/lib/whatsapp-credentials"
import { logError, getErrorContext } from "@/lib/error-logger"

function convertBrazilianDateToISO(dateStr: string): string | null {
  if (!dateStr) return null

  // Check if already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Convert from DD/MM/YYYY to YYYY-MM-DD
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month}-${day}`
  }

  return null
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Evita quebrar o build quando as variáveis não estão configuradas no ambiente.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase não está configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes)" },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  let tenantId: string | undefined
  let userId: string | undefined

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    userId = user.id

    const body = await request.json()
    const {
      templateId,
      records,
      tenantId: reqTenantId,
      userId: reqUserId,
      testMode,
      testNumber,
      testPhoneNumber,
      parameters,
    } = body
    const testPhone = testNumber || testPhoneNumber

    tenantId = reqTenantId

    if (!templateId || !records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Parâmetros obrigatórios não fornecidos" }, { status: 400 })
    }

    if (testMode && !testPhone) {
      return NextResponse.json({ error: "Número de teste obrigatório no modo de teste" }, { status: 400 })
    }

    const { data: template, error: templateError } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .single()

    if (templateError || !template) {
      await logError(templateError || new Error("Template não encontrado"), "TEMPLATE_NOT_FOUND", {
        ...getErrorContext(request),
        tenantId,
        userId,
        statusCode: 404,
        additionalData: { templateId },
      })
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })
    }

    if (!template.is_active || (template.meta_status && template.meta_status !== "APPROVED")) {
      return NextResponse.json(
        {
          error:
            template.meta_status === "PENDING"
              ? "Template aguardando aprovação na Meta. Atualize o status em Configurações > Templates WhatsApp."
              : "Template não está aprovado para envio",
        },
        { status: 400 },
      )
    }

    if (!template.name || template.name.trim() === "") {
      return NextResponse.json({ error: "Template sem nome configurado" }, { status: 400 })
    }

    const whatsappCreds = await getWhatsAppCredentialsForTenant(tenantId)

    if (!whatsappCreds) {
      const reason = !tenantId
        ? "tenant_id não informado na requisição"
        : "nenhum registro de whatsapp_credentials ativo/conectado para este tenant_id"
      console.log("[send-messages] Credenciais do WhatsApp não configuradas:", reason, { tenantId, userId })
      await logError(new Error("Credenciais do WhatsApp não configuradas"), "WHATSAPP_CREDENTIALS_ERROR", {
        ...getErrorContext(request),
        tenantId,
        userId,
        statusCode: 404,
        additionalData: { reason },
      })
      return NextResponse.json({ error: `Credenciais do WhatsApp não configuradas (${reason})` }, { status: 404 })
    }

    const results = []
    let successCount = 0
    let failedCount = 0

    for (const record of records) {
      try {
        const phoneField = template.phone_field || "telefone"
        // Em modo teste, sempre usa o número de teste, ignorando o número do registro
        const phoneToSend = testMode && testPhone ? String(testPhone).trim() : String(record[phoneField] || "")

        console.log("[v0] Sending message - testMode:", testMode, "testPhone:", testPhone, "phoneToSend:", phoneToSend)

        if (!phoneToSend || phoneToSend === "null" || phoneToSend === "undefined") {
          const errorMsg = testMode 
            ? "Número de teste não fornecido no modo de teste" 
            : "Telefone não encontrado no registro"
          results.push({
            id: record.id || record[Object.keys(record)[0]],
            success: false,
            error: errorMsg,
          })
          failedCount++
          continue
        }

        let payload: any

        if (parameters && parameters.length > 0) {
          const formattedParams = parameters.map((param: any) => ({
            type: "text",
            text: String(param.text || "").trim() || "-",
          }))

          payload = {
            messaging_product: "whatsapp",
            to: phoneToSend,
            type: "template",
            template: {
              name: (template.name || "").trim(),
              language: {
                code: template.language_code || "pt_BR",
              },
              components: [
                {
                  type: "body",
                  parameters: formattedParams,
                },
              ],
            },
          }
        } else {
          payload = buildWhatsAppPayload(phoneToSend, template, record)
        }

        console.log("[v0] WhatsApp payload:", JSON.stringify(payload, null, 2))

        const response = await sendWhatsAppMessage(whatsappCreds.phoneNumberId, whatsappCreds.accessToken, payload)

        const idPaxServico = record.idPaxServico || record.IdPaxServico
        const serviceDate = record.dataPickup || null

        const serviceDateISO = serviceDate ? convertBrazilianDateToISO(serviceDate) : null

        console.log("[v0] Saving message with idPaxServico:", idPaxServico, "serviceDate:", serviceDateISO)

        const metadata: Record<string, unknown> = {
          idPaxServico: idPaxServico,
          recordData: { ...record },
        }

        if (!response.success) {
          metadata.whatsappErrorDetails = response.errorDetails || null
          metadata.metaResponse = response.metaResponse || null
          metadata.httpStatus = response.httpStatus || null
        }

        const { data: messageRecord, error: insertError } = await supabase
          .from("messages")
          .insert({
            tenant_id: tenantId,
            sent_by: userId,
            template_id: templateId,
            recipient_phone: phoneToSend,
            whatsapp_message_id: response.messageId || null,
            recipient_wa_id: response.waId || null,
            template_name: template.name,
            status: response.success ? "sent" : "failed",
            error_message: response.error || null,
            payload: payload,
            metadata,
            id_pax_servico: idPaxServico ? String(idPaxServico) : null,
            service_date: serviceDateISO, // Use converted ISO date
          })
          .select()
          .single()

        if (insertError) {
          console.error("[v0] Error inserting message:", insertError.message)
        }

        results.push({
          id: record.id || record[Object.keys(record)[0]],
          success: response.success,
          whatsappMessageId: response.messageId,
          error: response.error,
          errorDetails: response.errorDetails,
        })

        if (response.success) {
          successCount++
        } else {
          failedCount++
        }
      } catch (error: any) {
        console.error("[v0] Error sending message:", error)
        await logError(error, "WHATSAPP_SEND_ERROR", {
          ...getErrorContext(request),
          tenantId,
          userId,
          additionalData: { record, templateId },
        })

        results.push({
          id: record.id || record[Object.keys(record)[0]],
          success: false,
          error: error.message || "Erro ao enviar mensagem",
        })
        failedCount++
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), "SEND_MESSAGES_ERROR", {
      ...getErrorContext(request),
      tenantId,
      userId,
      statusCode: 500,
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 })
  }
}
