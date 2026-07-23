import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAccessToken } from "@/lib/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EXAMPLE_BY_FIELD: Record<string, string> = {
  aeroporto: "MCZ",
  canal: "RPA COSTAZUL",
  cliente: "Cliente Exemplo Operadora",
  dataPickup: "15/02/2026",
  ddi: "54",
  departamento: "RECEPTIVO",
  destino: "PRAIA DOURADA MARAGOGI PARK",
  empresa: "Sua Empresa de Turismo",
  evento: "INDEFINIDO",
  horaPickup: "08:45:00",
  horaServico: "08:45:00",
  hotelPousada: "PRAIA DOURADA MARAGOGI PARK",
  idCanal: "5",
  idDepartamento: "1",
  idFile: "110428",
  idHotelPousada: "3",
  idOrdemServico: "85809",
  idParametroServico: "1",
  idPaxServico: "693144",
  idServico: "60",
  idServicoFile: "242899",
  idTipoServico: "1",
  idioma: "PT_BR",
  msgFim: "Mensagem de encerramento",
  msgInicio: "Mensagem de abertura",
  nomePax: "CARLOS ENRIQUE",
  origem: "AEROPORTO ZUMBI DOS PALMARES",
  parametroServico: "CHEGADA",
  servico: "TRANSFER CHEGADA - VIA MACEIO",
  telefone: "91165088356",
  tipoServico: "Regular",
  voo: "G3 9522",
  adt: "1",
  chd: "2",
  inf: "1",
  snr: "1",
  qtdPaxs: "5",
}

function extractVariables(templateText: string): string[] {
  const matches = templateText.matchAll(/\{\{(\d+)\}\}/g)
  return [...new Set([...matches].map((match) => match[1]))].sort((a, b) => Number(a) - Number(b))
}

function buildTemplateExamples(templateText: string, mapping: Record<string, string>) {
  const variables = extractVariables(templateText)
  if (variables.length === 0) return undefined

  return {
    body_text: [
      variables.map((variable) => {
        const mappedField = mapping[variable]
        return mappedField ? (EXAMPLE_BY_FIELD[mappedField] ?? `Exemplo ${mappedField}`) : `Exemplo ${variable}`
      }),
    ],
  }
}

async function getAuthorizedContext(permission: "criar" | "atualizar" | "excluir" | "sincronizar") {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role, is_super_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.tenant_id) {
    return { error: NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 }) }
  }

  if (profile.role !== "manager" && profile.role !== "admin" && !profile.is_super_admin) {
    return { error: NextResponse.json({ error: `Sem permissão para ${permission} templates` }, { status: 403 }) }
  }

  return { supabase, profile }
}

async function getWhatsAppCredentials(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const { data: whatsappCreds, error: credsError } = await supabase
    .from("whatsapp_credentials")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single()

  if (credsError || !whatsappCreds) {
    return { error: NextResponse.json({ error: "Credenciais do WhatsApp não configuradas" }, { status: 404 }) }
  }

  const wabaId = String(whatsappCreds.business_account_id || "").trim()
  let accessToken = ""
  try {
    accessToken = resolveAccessToken(whatsappCreds)
  } catch {
    accessToken = ""
  }

  if (!wabaId || !accessToken) {
    return {
      error: NextResponse.json(
        { error: "Configure o Business Account ID (WABA) e o Access Token nas credenciais do WhatsApp" },
        { status: 400 },
      ),
    }
  }

  return { wabaId, accessToken }
}

async function parseMetaResponse(response: Response) {
  const text = await response.text()

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    return { raw: text }
  }
}

function getMetaError(metaJson: Record<string, unknown> | null, fallback: string) {
  return (
    (metaJson as any)?.error?.message ||
    (metaJson as any)?.error?.error_user_msg ||
    (metaJson as any)?.raw ||
    fallback
  )
}

function getBodyTextFromMetaTemplate(template: Record<string, unknown>) {
  const components = template.components as Array<Record<string, unknown>> | undefined
  const bodyComponent = components?.find((component) => String(component.type).toUpperCase() === "BODY")
  return typeof bodyComponent?.text === "string" ? bodyComponent.text : ""
}

function formatDatabaseSchemaError(message: string) {
  if (/category|meta_template_id|meta_status|meta_response/i.test(message) && /schema cache|column/i.test(message)) {
    return "Banco de dados desatualizado. Execute a migration scripts/028_add_meta_fields_to_message_templates.sql no Supabase SQL Editor e tente novamente."
  }

  return message
}

export async function GET() {
  try {
    const context = await getAuthorizedContext("sincronizar")
    if (context.error) return context.error

    const credentials = await getWhatsAppCredentials(context.supabase, context.profile.tenant_id)
    if (credentials.error) return credentials.error

    const allMetaTemplates: Array<Record<string, unknown>> = []
    let nextUrl: string | null =
      `https://graph.facebook.com/v23.0/${credentials.wabaId}/message_templates?fields=name,status,language,category,components&limit=100`

    while (nextUrl) {
      const metaResponse = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      })
      const metaJson = await parseMetaResponse(metaResponse)

      if (!metaResponse.ok) {
        return NextResponse.json(
          { error: getMetaError(metaJson, "Falha ao buscar templates na Meta"), metaResponse: metaJson },
          { status: 400 },
        )
      }

      const data = ((metaJson as any)?.data || []) as Array<Record<string, unknown>>
      allMetaTemplates.push(...data)
      nextUrl = ((metaJson as any)?.paging?.next as string | undefined) || null
    }

    const { data: existingTemplates } = await context.supabase
      .from("message_templates")
      .select("*")
      .eq("tenant_id", context.profile.tenant_id)

    const existingByName = new Map((existingTemplates || []).map((template) => [template.name, template]))

    const rows = allMetaTemplates
      .filter((template) => typeof template.name === "string" && template.name.trim().length > 0)
      .map((template) => {
        const name = String(template.name).trim()
        const existing = existingByName.get(name)
        const metaStatus = String(template.status || "PENDING").trim().toUpperCase()

        return {
          tenant_id: context.profile.tenant_id,
          name,
          language_code: String(template.language || existing?.language_code || "pt_BR"),
          description: existing?.description || "Importado da Meta",
          template_text: getBodyTextFromMetaTemplate(template) || existing?.template_text || "",
          parameter_mapping: existing?.parameter_mapping || {},
          category: String(template.category || existing?.category || "UTILITY").toUpperCase(),
          meta_template_id: String(template.id || existing?.meta_template_id || "").trim() || null,
          meta_status: metaStatus,
          meta_response: template,
          is_active: existing?.is_active ?? false,
        }
      })

    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Nenhum template encontrado na Meta." })
    }

    const { data: syncedTemplates, error: upsertError } = await context.supabase
      .from("message_templates")
      .upsert(rows, { onConflict: "tenant_id,name" })
      .select("*")

    if (upsertError) {
      return NextResponse.json({ error: formatDatabaseSchemaError(upsertError.message) }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: syncedTemplates?.length || 0,
      templates: syncedTemplates,
      message: `${syncedTemplates?.length || 0} template(s) sincronizado(s) da Meta.`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao sincronizar templates" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizedContext("atualizar")
    if (context.error) return context.error

    const body = await request.json()
    const { templateId } = body as { templateId?: string }

    if (!templateId) {
      return NextResponse.json({ error: "templateId é obrigatório" }, { status: 400 })
    }

    const { data: template, error: templateError } = await context.supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", context.profile.tenant_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })
    }

    const credentials = await getWhatsAppCredentials(context.supabase, context.profile.tenant_id)
    if (credentials.error) return credentials.error

    const metaTemplateId = String(template.meta_template_id || "").trim()
    let metaStatus: string | null = null
    let metaJson: Record<string, unknown> | null = null

    if (metaTemplateId) {
      const metaResponse = await fetch(
        `https://graph.facebook.com/v23.0/${metaTemplateId}?fields=name,status,language,category`,
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      )

      metaJson = await parseMetaResponse(metaResponse)

      if (!metaResponse.ok) {
        return NextResponse.json(
          { error: getMetaError(metaJson, "Falha ao consultar status na Meta"), metaResponse: metaJson },
          { status: 400 },
        )
      }

      metaStatus = String((metaJson as any)?.status || "").trim().toUpperCase() || null
    } else {
      const metaResponse = await fetch(
        `https://graph.facebook.com/v23.0/${credentials.wabaId}/message_templates?name=${encodeURIComponent(template.name)}&fields=name,status,language,category`,
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      )

      metaJson = await parseMetaResponse(metaResponse)

      if (!metaResponse.ok) {
        return NextResponse.json(
          { error: getMetaError(metaJson, "Falha ao consultar status na Meta"), metaResponse: metaJson },
          { status: 400 },
        )
      }

      const templates = (metaJson as any)?.data as Array<Record<string, unknown>> | undefined
      const match = templates?.find((item) => String(item.name) === template.name)
      metaStatus = match ? String(match.status || "").trim().toUpperCase() : null
    }

    if (!metaStatus) {
      return NextResponse.json({ error: "Não foi possível obter o status do template na Meta" }, { status: 400 })
    }

    const { data: updatedTemplate, error: updateError } = await context.supabase
      .from("message_templates")
      .update({
        meta_status: metaStatus,
        meta_response: metaJson,
      })
      .eq("id", templateId)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      message:
        metaStatus === "APPROVED"
          ? "Template aprovado na Meta e liberado para envio."
          : `Status atualizado: ${metaStatus}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao atualizar status" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthorizedContext("excluir")
    if (context.error) return context.error

    const body = await request.json()
    const { templateId } = body as { templateId?: string }

    if (!templateId) {
      return NextResponse.json({ error: "templateId é obrigatório" }, { status: 400 })
    }

    const { data: template, error: templateError } = await context.supabase
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", context.profile.tenant_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })
    }

    const credentials = await getWhatsAppCredentials(context.supabase, context.profile.tenant_id)
    if (credentials.error) return credentials.error

    const metaResponse = await fetch(
      `https://graph.facebook.com/v23.0/${credentials.wabaId}/message_templates?name=${encodeURIComponent(template.name)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    )
    const metaJson = await parseMetaResponse(metaResponse)

    if (!metaResponse.ok) {
      return NextResponse.json(
        { error: getMetaError(metaJson, "Falha ao excluir template na Meta"), metaResponse: metaJson },
        { status: 400 },
      )
    }

    const { error: deleteError } = await context.supabase.from("message_templates").delete().eq("id", templateId)

    if (deleteError) {
      return NextResponse.json(
        {
          error: `Template excluído na Meta, mas falhou ao remover localmente: ${deleteError.message}`,
          metaResponse: metaJson,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      metaResponse: metaJson,
      message: "Template excluído na Meta e removido do sistema.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao excluir template" },
      { status: 500 },
    )
  }
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
      .select("tenant_id, role, is_super_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 400 })
    }

    if (profile.role !== "manager" && profile.role !== "admin" && !profile.is_super_admin) {
      return NextResponse.json({ error: "Sem permissão para criar templates" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      language_code,
      description,
      template_text,
      parameter_mapping,
      category,
    } = body as {
      name?: string
      language_code?: string
      description?: string
      template_text?: string
      parameter_mapping?: Record<string, string>
      category?: string
    }

    const normalizedName = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
    const normalizedLanguage = String(language_code || "pt_BR").trim()
    const normalizedText = String(template_text || "").trim()
    const normalizedCategory = String(category || "UTILITY").trim().toUpperCase()
    const mapping = parameter_mapping || {}

    if (!normalizedName || !normalizedText) {
      return NextResponse.json({ error: "Nome e texto do template são obrigatórios" }, { status: 400 })
    }

    if (!/^[a-z0-9_]+$/.test(normalizedName)) {
      return NextResponse.json(
        { error: "O nome do template deve conter apenas letras minúsculas, números e underscore" },
        { status: 400 },
      )
    }

    const unmapped = extractVariables(normalizedText).filter((variable) => !mapping[variable])
    if (unmapped.length > 0) {
      return NextResponse.json(
        { error: `Mapeie todos os parâmetros: {{${unmapped.join("}}, {{")}}}` },
        { status: 400 },
      )
    }

    const { data: whatsappCreds, error: credsError } = await supabase
      .from("whatsapp_credentials")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .single()

    if (credsError || !whatsappCreds) {
      return NextResponse.json({ error: "Credenciais do WhatsApp não configuradas" }, { status: 404 })
    }

    const wabaId = String(whatsappCreds.business_account_id || "").trim()
    let accessToken = ""
    try {
      accessToken = resolveAccessToken(whatsappCreds)
    } catch {
      accessToken = ""
    }

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        { error: "Configure o Business Account ID (WABA) e o Access Token nas credenciais do WhatsApp" },
        { status: 400 },
      )
    }

    const metaPayload: Record<string, unknown> = {
      name: normalizedName,
      category: normalizedCategory,
      language: normalizedLanguage,
      components: [
        {
          type: "BODY",
          text: normalizedText,
          ...(buildTemplateExamples(normalizedText, mapping)
            ? { example: buildTemplateExamples(normalizedText, mapping) }
            : {}),
        },
      ],
    }

    const metaResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    })

    const metaResponseText = await metaResponse.text()
    let metaJson: Record<string, unknown> | null = null

    try {
      metaJson = metaResponseText ? JSON.parse(metaResponseText) : null
    } catch {
      metaJson = { raw: metaResponseText }
    }

    if (!metaResponse.ok) {
      const metaError =
        (metaJson as any)?.error?.message ||
        (metaJson as any)?.error?.error_user_msg ||
        metaResponseText ||
        "Falha ao criar template na Meta"

      return NextResponse.json({ error: metaError, metaResponse: metaJson }, { status: 400 })
    }

    const metaTemplateId = String((metaJson as any)?.id || "").trim() || null
    const metaStatus = String((metaJson as any)?.status || "PENDING").trim().toUpperCase()

    const { data: insertedTemplate, error: insertError } = await supabase
      .from("message_templates")
      .insert({
        tenant_id: profile.tenant_id,
        name: normalizedName,
        language_code: normalizedLanguage,
        description: description || null,
        template_text: normalizedText,
        parameter_mapping: mapping,
        category: normalizedCategory,
        meta_template_id: metaTemplateId,
        meta_status: metaStatus,
        meta_response: metaJson,
        is_active: false,
      })
      .select("*")
      .single()

    if (insertError) {
      return NextResponse.json(
        {
          error: `Template criado na Meta, mas falhou ao salvar localmente: ${formatDatabaseSchemaError(insertError.message)}`,
          metaResponse: metaJson,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      template: insertedTemplate,
      metaResponse: metaJson,
      message:
        metaStatus === "APPROVED"
          ? "Template criado e aprovado na Meta."
          : "Template enviado para a Meta e aguardando aprovação.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao criar template" },
      { status: 500 },
    )
  }
}
