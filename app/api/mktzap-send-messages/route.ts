import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMktzapToken } from "@/lib/mktzap"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface DataRecord {
  [key: string]: unknown
}

function convertToISODate(input: unknown): string | null {
  const value = String(input || "").trim()
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) {
    const [, day, month, year] = br
    return `${year}-${month}-${day}`
  }
  return null
}

/** Remove apenas caracteres especiais (espaços, parênteses, hífens, pontos). O número já vem tratado da API de dados. */
function normalizePhone(input: string): string {
  return String(input || "").trim().replace(/[\s().\-]/g, "")
}

function buildParamsFromMapping(
  record: DataRecord,
  mapping: Record<string, string>,
  dynamicFlags: Record<string, boolean>,
  dynamicValues: Record<string, string>,
): string[] {
  return Object.keys(mapping)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      if (dynamicFlags[key]) {
        return String(dynamicValues[key] ?? "-")
      }
      const fieldName = mapping[key]
      const raw = record[fieldName]
      return String(raw ?? "-")
    })
}

function extractMktzapSuccess(responseJson: Record<string, unknown> | null): boolean {
  if (!responseJson) return false
  const historyNode = (responseJson as any)?.history_id
  if (typeof historyNode?.success === "boolean") {
    return historyNode.success
  }
  if (typeof (responseJson as any)?.success === "boolean") {
    return (responseJson as any).success
  }
  return false
}

function toNumericIdIfPossible(value: string | null): number | string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  return trimmed
}

export async function POST(request: Request) {
  const supabase = await createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, records, tenantId: requestedTenantId, dynamicValues } = body as {
      templateId?: string
      records?: DataRecord[]
      tenantId?: string | null
      dynamicValues?: Record<string, string>
    }

    if (!templateId || !records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Parâmetros obrigatórios não fornecidos" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, is_super_admin, id_mktzap")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    const userTenantId = profile.tenant_id
    const isSuperAdmin = !!profile.is_super_admin
    const tenantId = requestedTenantId || userTenantId

    if (!isSuperAdmin && requestedTenantId && requestedTenantId !== userTenantId) {
      return NextResponse.json(
        { error: "Você não tem permissão para enviar mensagens para outra empresa" },
        { status: 403 },
      )
    }

    const { data: template, error: templateError } = await supabase
      .from("mktzap_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template MKTZAP não encontrado" }, { status: 404 })
    }

    if (!template.broker_phone) {
      return NextResponse.json(
        { error: "Template sem broker_phone configurado. Configure o telefone de envio no template." },
        { status: 400 },
      )
    }

    const mapping = (template.parameter_mapping || {}) as Record<string, string>
    const dynamicFlags = (template.dynamic_parameter_flags || {}) as Record<string, boolean>
    const dynamicValuesInput = (dynamicValues || {}) as Record<string, string>
    const mappedKeys = Object.keys(mapping)
    if (mappedKeys.length === 0) {
      return NextResponse.json({ error: "Template sem mapeamento de parâmetros" }, { status: 400 })
    }

    const missingDynamic = Object.keys(dynamicFlags).filter((key) => {
      if (!dynamicFlags[key]) return false
      const value = String(dynamicValuesInput[key] ?? "").trim()
      return !value
    })
    if (missingDynamic.length > 0) {
      return NextResponse.json(
        { error: `Preencha os campos dinâmicos: {{${missingDynamic.join("}}, {{")}}}` },
        { status: 400 },
      )
    }

    const { data: credentials, error: credsError } = await supabase
      .from("mktzap_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single()

    if (credsError || !credentials) {
      return NextResponse.json({ error: "Credenciais MKTZAP não configuradas" }, { status: 404 })
    }

    const token = await getMktzapToken(credentials.company_id, credentials.client_key, tenantId)
    const sendUrl = `https://api.mktzap.com.br/company/${credentials.company_id}/history/send-hsm`
    console.log("[mktzap] Sending messages to:", sendUrl)

    const results: Array<Record<string, unknown>> = []
    let successCount = 0
    let failedCount = 0

    for (const record of records) {
      try {
        const rawPhone = String(
          record.telefone || record.phone || record.celular || record.whatsapp || record.fone || "",
        )
        const normalizedPhone = normalizePhone(rawPhone)
        const phoneDigits = normalizedPhone.replace(/\D/g, "")
        if (!phoneDigits) {
          const idPaxServico = String(record.idPaxServico || record.id || "").trim() || null
          const idFile = String(record.idFile || "").trim() || null
          const serviceDate = convertToISODate(record.dataPickup)
          const statusKey = idPaxServico || "NO_ID_PAX_SERVICO"
          await supabase.from("mktzap_messages").insert({
            tenant_id: tenantId,
            sent_by: user.id,
            mktzap_template_id: template.id,
            id_pax_servico: idPaxServico,
            id_file: idFile,
            service_date: serviceDate,
            broker_phone: String(template.broker_phone),
            phone_ddi: "",
            phone_number: "",
            recipient_phone: "",
            recipient_name: String(record.nomePax || record.name || "Cliente"),
            lead_id: null,
            mktzap_message_id: null,
            payload: { reason: "PHONE_NOT_FOUND" },
            response: { success: false, description: "Telefone não encontrado no registro" },
            status: "failed",
            error_message: "Telefone não encontrado no registro",
          })
          results.push({
            id: record.id || record.idPaxServico || null,
            success: false,
            statusKey,
            error: "Telefone não encontrado no registro",
          })
          failedCount++
          continue
        }

        const recipientName = String(record.nomePax || record.name || "Cliente")
        const params = buildParamsFromMapping(record, mapping, dynamicFlags, dynamicValuesInput)
        const idFile = String(record.idFile || "").trim() || null
        const idPaxServico = String(record.idPaxServico || record.id || "").trim() || null
        const serviceDate = convertToISODate(record.dataPickup)
        const statusKey = idPaxServico || "NO_ID_PAX_SERVICO"
        const operatorUserIdRaw = profile?.id_mktzap ? String(profile.id_mktzap) : null
        const operatorUserId = toNumericIdIfPossible(operatorUserIdRaw)

        // DDI vem na chave "ddi" da API de dados; enviamos como "phone_ddi" no payload MKTZAP
        const ddi = String(record.ddi ?? "").trim()
        const ddiMissing = !ddi

        const payload = {
          type: "whatsapp-enterprise",
          broker_phone: String(template.broker_phone),
          phone_ddi: ddi,
          phone_number: phoneDigits,
          name: recipientName,
          operator_user_id: operatorUserId,
          custom_fields: {
            "10477": idFile || "",
          },
          only_active: false,
          contact_already_exists: true,
          is_auto: true,
          messages: {
            type: "hsm",
            content: {
              hsm_id: Number(template.mktzap_id),
              params,
            },
          },
        }

        const response = await fetch(sendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const responseText = await response.text()
        console.log("[mktzap] Send response RAW:", {
          status: response.status,
          ok: response.ok,
          body: responseText,
        })
        let responseJson: Record<string, unknown> | null = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch {
          responseJson = { raw: responseText }
        }

        const isSuccess = extractMktzapSuccess(responseJson)
        const sendError = isSuccess ? null : String((responseJson as any)?.message || responseText || "Falha no envio")
        const errorMessage = ddiMissing ? (sendError ? `DDI não informado. ${sendError}` : "DDI não informado") : sendError
        const historyNode = (responseJson as any)?.history_id
        const mktzapMessageId =
          (historyNode && (historyNode.history_id || historyNode.id)) || (responseJson as any)?.history_id || null
        const protocol = (historyNode && historyNode.protocol) || (responseJson as any)?.protocol || null

        // salva log de envio
        await supabase
          .from("mktzap_messages")
          .insert({
            tenant_id: tenantId,
            sent_by: user.id,
            mktzap_template_id: template.id,
            id_pax_servico: idPaxServico,
            id_file: idFile,
            service_date: serviceDate,
            broker_phone: String(template.broker_phone),
            phone_ddi: ddi,
            phone_number: phoneDigits,
            recipient_phone: phoneDigits,
            recipient_name: recipientName,
            lead_id: null,
            mktzap_message_id: mktzapMessageId ? String(mktzapMessageId) : null,
            payload,
            response: {
              send: responseJson,
              request_payload: payload,
            },
            status: isSuccess ? "sent" : "failed",
            error_message: errorMessage,
          })

        results.push({
          id: record.id || record.idPaxServico || null,
          success: isSuccess,
          error: errorMessage,
          ddiMissing: ddiMissing || undefined,
          statusKey,
          idPaxServico,
          idFile,
          serviceDate,
          mktzapMessageId: mktzapMessageId ? String(mktzapMessageId) : null,
          protocol: protocol ? String(protocol) : null,
          response: {
            send: responseJson,
            request_payload: payload,
          },
        })

        if (isSuccess) successCount++
        else failedCount++
      } catch (error) {
        const idPaxServico = String((record as any).idPaxServico || (record as any).id || "").trim() || null
        const idFile = String((record as any).idFile || "").trim() || null
        const serviceDate = convertToISODate((record as any).dataPickup)
        await supabase
          .from("mktzap_messages")
          .insert({
            tenant_id: tenantId,
            sent_by: user.id,
            mktzap_template_id: template.id,
            id_pax_servico: idPaxServico,
            id_file: idFile,
            service_date: serviceDate,
            broker_phone: String(template.broker_phone),
            phone_ddi: "",
            phone_number: "",
            recipient_phone: "",
            recipient_name: String((record as any).nomePax || (record as any).name || "Cliente"),
            lead_id: null,
            mktzap_message_id: null,
            payload: { reason: "UNEXPECTED_ERROR" },
            response: { success: false, error: error instanceof Error ? error.message : "Erro ao enviar" },
            status: "failed",
            error_message: error instanceof Error ? error.message : "Erro ao enviar",
          })
        results.push({
          id: (record as any).id || (record as any).idPaxServico || null,
          success: false,
          error: error instanceof Error ? error.message : "Erro ao enviar",
          statusKey: String((record as any).idPaxServico || (record as any).id || "").trim() || "NO_ID_PAX_SERVICO",
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao enviar mensagens MKTZAP" },
      { status: 500 },
    )
  }
}
