import type { WhatsAppTemplatePayload, MessageTemplate } from "./types"
import { getOrderedParameterMappingEntries } from "./client-api-messages"
import {
  extractWhatsAppErrorDetails,
  formatWhatsAppApiError,
  whatsAppErrorDetailsToRecord,
  type WhatsAppErrorDetails,
} from "./whatsapp-errors"

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0"

export { formatWhatsAppApiError, extractWhatsAppErrorDetails, type WhatsAppErrorDetails }

interface SendMessageResult {
  success: boolean
  messageId?: string
  waId?: string
  error?: string
  errorDetails?: Record<string, unknown> | null
  httpStatus?: number
  metaResponse?: unknown
}

async function parseWhatsAppResponse(response: Response): Promise<{ data: unknown; httpStatus: number }> {
  const httpStatus = response.status
  const responseText = await response.text()

  if (!responseText.trim()) {
    return { data: null, httpStatus }
  }

  try {
    return { data: JSON.parse(responseText), httpStatus }
  } catch {
    return {
      data: {
        error: {
          message: responseText.slice(0, 1000),
          type: "invalid_json_response",
        },
      },
      httpStatus,
    }
  }
}

function buildErrorResult(data: unknown, httpStatus: number): SendMessageResult {
  const parsed = extractWhatsAppErrorDetails(data, httpStatus)

  return {
    success: false,
    error: formatWhatsAppApiError(data, httpStatus),
    errorDetails: whatsAppErrorDetailsToRecord(parsed),
    httpStatus,
    metaResponse: data,
  }
}

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: WhatsAppTemplatePayload,
): Promise<SendMessageResult> {
  try {
    console.log("[whatsapp] Sending message:", JSON.stringify(payload, null, 2))

    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const { data, httpStatus } = await parseWhatsAppResponse(response)

    if (!response.ok) {
      console.log("[whatsapp] API error:", httpStatus, JSON.stringify(data, null, 2))
      return buildErrorResult(data, httpStatus)
    }

    const responseData = data as Record<string, unknown> | null
    const messageId = (responseData?.messages as Array<{ id?: string }> | undefined)?.[0]?.id
    const waId = (responseData?.contacts as Array<{ wa_id?: string }> | undefined)?.[0]?.wa_id

    if (!messageId) {
      console.log("[whatsapp] Response without message id:", JSON.stringify(data, null, 2))
      return buildErrorResult(data, httpStatus)
    }

    return {
      success: true,
      messageId,
      waId,
      httpStatus,
      metaResponse: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const parsed = extractWhatsAppErrorDetails({ error: { message } })

    return {
      success: false,
      error: message,
      errorDetails: whatsAppErrorDetailsToRecord(parsed),
      metaResponse: { error: { message } },
    }
  }
}

export function buildWhatsAppPayload(
  recipientPhone: string,
  template: MessageTemplate,
  data: Record<string, unknown>,
): WhatsAppTemplatePayload {
  const parameters = buildTemplateParameters(template, (fieldName) => {
    const rawValue = data[fieldName]
    return rawValue != null ? String(rawValue).trim() : ""
  })

  return buildWhatsAppTemplatePayload(recipientPhone, template, parameters)
}

export function buildWhatsAppPayloadFromParameters(
  recipientPhone: string,
  template: MessageTemplate,
  parameters: Record<string, string>,
): WhatsAppTemplatePayload {
  const resolvedParameters = getOrderedParameterMappingEntries(template.parameter_mapping).map(
    ([paramName, dataField]) => {
      const textValue = parameters[paramName] != null ? String(parameters[paramName]).trim() : ""

      if (!textValue) {
        console.warn(`[whatsapp] Empty value for parameter ${paramName} (field: ${dataField})`)
      }

      return {
        type: "text" as const,
        text: textValue || "-",
      }
    },
  )

  return buildWhatsAppTemplatePayload(recipientPhone, template, resolvedParameters)
}

function buildTemplateParameters(
  template: MessageTemplate,
  resolveValue: (fieldName: string) => string,
): Array<{ type: "text"; text: string }> {
  return getOrderedParameterMappingEntries(template.parameter_mapping).map(([paramName, dataField]) => {
    const textValue = resolveValue(dataField)

    if (!textValue) {
      console.warn(`[whatsapp] Empty value for parameter ${paramName} (field: ${dataField})`)
    }

    return {
      type: "text" as const,
      text: textValue || "-",
    }
  })
}

function buildWhatsAppTemplatePayload(
  recipientPhone: string,
  template: MessageTemplate,
  parameters: Array<{ type: "text"; text: string }>,
): WhatsAppTemplatePayload {
  const templateName = template.name.trim()
  const languageCode = (template.language_code || "pt_BR").replace("-", "_")

  const components =
    parameters.length > 0
      ? [
          {
            type: "body" as const,
            parameters,
          },
        ]
      : undefined

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatPhoneNumber(recipientPhone),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  }
}

function formatPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}
