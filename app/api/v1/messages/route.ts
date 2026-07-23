import { NextResponse } from "next/server"
import { authenticateClientApiRequest } from "@/lib/client-api-auth"
import type { ClientApiAuthContext } from "@/lib/client-api-auth"
import {
  getTemplateParameterKeys,
  validateClientParameters,
  validateTemplateForSend,
} from "@/lib/client-api-messages"
import { getClientRequestMeta, logClientApiMessageAttempt } from "@/lib/client-api-logger"
import { logError, getErrorContext } from "@/lib/error-logger"
import { getWhatsAppCredentialsForTenant } from "@/lib/whatsapp-credentials"
import { createAdminClient } from "@/lib/supabase/admin"
import type { MessageTemplate } from "@/lib/types"
import { buildWhatsAppPayloadFromParameters, sendWhatsAppMessage } from "@/lib/whatsapp"

interface ClientMessageInput {
  phone?: string
  telefone?: string
  parameters?: Record<string, string>
  externalId?: string
}

function normalizePhone(message: ClientMessageInput): string {
  return String(message.phone || message.telefone || "").trim()
}

function validatePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")

  if (digits.length < 10) {
    return "Telefone inválido. Informe DDI + DDD + número (ex.: 5511999999999)"
  }

  return null
}

function normalizeMessages(body: Record<string, unknown>): ClientMessageInput[] {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages as ClientMessageInput[]
  }

  if (body.phone || body.telefone) {
    return [
      {
        phone: typeof body.phone === "string" ? body.phone : undefined,
        telefone: typeof body.telefone === "string" ? body.telefone : undefined,
        parameters: (body.parameters as Record<string, string> | undefined) || {},
        externalId: typeof body.externalId === "string" ? body.externalId : undefined,
      },
    ]
  }

  return []
}

async function writeClientApiLog(
  request: Request,
  auth: ClientApiAuthContext,
  input: {
    templateId?: string | null
    templateName?: string | null
    externalId?: string | null
    recipientPhone?: string | null
    parameters?: Record<string, string>
    status: "success" | "failed" | "validation_error"
    errorMessage?: string | null
    errorDetails?: Record<string, unknown> | null
    whatsappMessageId?: string | null
    messageId?: string | null
    payload?: Record<string, unknown> | null
    httpStatus?: number | null
  },
) {
  const { requestIp, userAgent } = getClientRequestMeta(request)

  await logClientApiMessageAttempt({
    tenantId: auth.tenantId,
    credentialId: auth.credentialId,
    credentialName: auth.credentialName,
    templateId: input.templateId,
    templateName: input.templateName,
    externalId: input.externalId,
    recipientPhone: input.recipientPhone,
    parameters: input.parameters,
    status: input.status,
    errorMessage: input.errorMessage,
    errorDetails: input.errorDetails,
    whatsappMessageId: input.whatsappMessageId,
    messageId: input.messageId,
    payload: input.payload,
    httpStatus: input.httpStatus,
    requestIp,
    userAgent,
  })
}

export async function POST(request: Request) {
  let tenantId: string | undefined
  let auth: ClientApiAuthContext | null = null

  try {
    auth = await authenticateClientApiRequest(request)

    if (!auth) {
      return NextResponse.json({ error: "Credenciais inválidas ou inativas" }, { status: 401 })
    }

    tenantId = auth.tenantId
    const body = await request.json()
    const templateId = typeof body.templateId === "string" ? body.templateId : ""
    const messages = normalizeMessages(body)

    if (!templateId) {
      await writeClientApiLog(request, auth, {
        status: "validation_error",
        errorMessage: "templateId é obrigatório",
        httpStatus: 400,
      })

      return NextResponse.json({ error: "templateId é obrigatório" }, { status: 400 })
    }

    if (messages.length === 0) {
      await writeClientApiLog(request, auth, {
        templateId,
        status: "validation_error",
        errorMessage: "Informe phone/telefone e parameters para envio único, ou messages[] para envio em lote",
        httpStatus: 400,
      })

      return NextResponse.json(
        {
          error:
            "Informe phone/telefone e parameters para envio único, ou messages[] para envio em lote",
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: templateData, error: templateError } = await admin
      .from("message_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (templateError || !templateData) {
      await writeClientApiLog(request, auth, {
        templateId,
        status: "validation_error",
        errorMessage: "Template não encontrado",
        httpStatus: 404,
      })

      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })
    }

    const template = templateData as MessageTemplate
    const templateValidationError = validateTemplateForSend(template)

    if (templateValidationError) {
      await writeClientApiLog(request, auth, {
        templateId,
        templateName: template.name,
        status: "validation_error",
        errorMessage: templateValidationError,
        httpStatus: 400,
      })

      return NextResponse.json({ error: templateValidationError }, { status: 400 })
    }

    const whatsappCreds = await getWhatsAppCredentialsForTenant(tenantId)

    if (!whatsappCreds) {
      await writeClientApiLog(request, auth, {
        templateId,
        templateName: template.name,
        status: "validation_error",
        errorMessage: "Credenciais do WhatsApp não configuradas para esta empresa",
        httpStatus: 404,
      })

      return NextResponse.json({ error: "Credenciais do WhatsApp não configuradas para esta empresa" }, { status: 404 })
    }

    const results: Array<Record<string, unknown>> = []
    let successCount = 0
    let failedCount = 0

    for (const message of messages) {
      const phone = normalizePhone(message)
      const parameters = message.parameters || {}
      const externalId = message.externalId

      if (!phone) {
        await writeClientApiLog(request, auth, {
          templateId,
          templateName: template.name,
          externalId: externalId || null,
          parameters,
          status: "validation_error",
          errorMessage: "Telefone não informado",
          httpStatus: 422,
        })

        results.push({
          externalId: externalId || null,
          success: false,
          error: "Telefone não informado",
        })
        failedCount++
        continue
      }

      const phoneValidationError = validatePhone(phone)
      if (phoneValidationError) {
        await writeClientApiLog(request, auth, {
          templateId,
          templateName: template.name,
          externalId: externalId || null,
          recipientPhone: phone,
          parameters,
          status: "validation_error",
          errorMessage: phoneValidationError,
          httpStatus: 422,
        })

        results.push({
          externalId: externalId || null,
          phone,
          success: false,
          error: phoneValidationError,
        })
        failedCount++
        continue
      }

      const parameterValidationError = validateClientParameters(template, parameters)
      if (parameterValidationError) {
        await writeClientApiLog(request, auth, {
          templateId,
          templateName: template.name,
          externalId: externalId || null,
          recipientPhone: phone,
          parameters,
          status: "validation_error",
          errorMessage: parameterValidationError,
          httpStatus: 422,
        })

        results.push({
          externalId: externalId || null,
          phone,
          success: false,
          error: parameterValidationError,
        })
        failedCount++
        continue
      }

      try {
        const payload = buildWhatsAppPayloadFromParameters(phone, template, parameters)
        const response = await sendWhatsAppMessage(
          whatsappCreds.phoneNumberId,
          whatsappCreds.accessToken,
          payload,
        )

        const metadata: Record<string, unknown> = {
          source: "client_api",
          credentialId: auth.credentialId,
          credentialName: auth.credentialName,
          externalId: externalId || null,
          parameters,
          requiredParameters: getTemplateParameterKeys(template),
        }

        if (!response.success) {
          metadata.whatsappErrorDetails = response.errorDetails || null
          metadata.metaResponse = response.metaResponse || null
          metadata.httpStatus = response.httpStatus || null
        }

        const { data: messageRecord } = await admin
          .from("messages")
          .insert({
            tenant_id: tenantId,
            sent_by: null,
            template_id: templateId,
            recipient_phone: phone,
            whatsapp_message_id: response.messageId || null,
            recipient_wa_id: response.waId || null,
            template_name: template.name,
            status: response.success ? "sent" : "failed",
            error_message: response.error || null,
            payload,
            metadata,
            id_pax_servico: externalId ? String(externalId) : null,
          })
          .select("id")
          .maybeSingle()

        const logStatus = response.success && response.messageId ? "success" : "failed"

        await writeClientApiLog(request, auth, {
          templateId,
          templateName: template.name,
          externalId: externalId || null,
          recipientPhone: phone,
          parameters,
          status: logStatus,
          errorMessage: response.error || null,
          errorDetails: response.errorDetails || null,
          whatsappMessageId: response.messageId || null,
          messageId: messageRecord?.id || null,
          payload: payload as unknown as Record<string, unknown>,
          httpStatus: logStatus === "success" ? 200 : 422,
        })

        results.push({
          externalId: externalId || null,
          phone,
          success: logStatus === "success",
          messageId: messageRecord?.id || null,
          whatsappMessageId: response.messageId || null,
          error: response.error || null,
          errorDetails: response.errorDetails || null,
        })

        if (logStatus === "success") {
          successCount++
        } else {
          failedCount++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro ao enviar mensagem"

        await logError(error instanceof Error ? error : new Error(String(error)), "CLIENT_API_SEND_ERROR", {
          ...getErrorContext(request),
          tenantId,
          additionalData: { templateId, phone, externalId },
        })

        await writeClientApiLog(request, auth, {
          templateId,
          templateName: template.name,
          externalId: externalId || null,
          recipientPhone: phone,
          parameters,
          status: "failed",
          errorMessage,
          httpStatus: 422,
        })

        results.push({
          externalId: externalId || null,
          phone,
          success: false,
          error: errorMessage,
        })
        failedCount++
      }
    }

    const allFailed = successCount === 0 && failedCount > 0
    const partialFailure = successCount > 0 && failedCount > 0
    const firstError = results.find((result) => result.error)?.error as string | undefined

    return NextResponse.json(
      {
        error: allFailed ? firstError || "Nenhuma mensagem foi enviada" : undefined,
        sent: successCount,
        failed: failedCount,
        allSucceeded: successCount > 0 && failedCount === 0,
        results,
      },
      {
        status: allFailed ? 422 : partialFailure ? 207 : 200,
      },
    )
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), "CLIENT_API_MESSAGES_ERROR", {
      ...getErrorContext(request),
      tenantId,
      statusCode: 500,
    })

    if (auth) {
      await writeClientApiLog(request, auth, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Erro interno",
        httpStatus: 500,
      })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 })
  }
}
