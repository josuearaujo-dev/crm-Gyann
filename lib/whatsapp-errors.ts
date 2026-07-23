export interface WhatsAppErrorDetails {
  title?: string
  message?: string
  code?: number | string
  errorSubcode?: number | string
  type?: string
  fbtraceId?: string
  httpStatus?: number
  rawResponse?: unknown
}

export function extractWhatsAppErrorDetails(payload: unknown, httpStatus?: number): WhatsAppErrorDetails {
  const details: WhatsAppErrorDetails = { httpStatus, rawResponse: payload }

  if (!payload || typeof payload !== "object") {
    if (typeof payload === "string" && payload.trim()) {
      details.message = payload.trim()
    }
    return details
  }

  const data = payload as Record<string, unknown>
  const metaError = data.error

  if (typeof metaError === "string" && metaError.trim()) {
    details.message = metaError.trim()
    return details
  }

  if (!metaError || typeof metaError !== "object") {
    return details
  }

  const errorObject = metaError as Record<string, unknown>

  if (errorObject.error_user_title) details.title = String(errorObject.error_user_title)
  if (errorObject.error_user_msg) details.message = String(errorObject.error_user_msg)
  if (!details.message && errorObject.message) details.message = String(errorObject.message)
  if (errorObject.code != null) details.code = errorObject.code as number | string
  if (errorObject.error_subcode != null) details.errorSubcode = errorObject.error_subcode as number | string
  if (errorObject.type) details.type = String(errorObject.type)
  if (errorObject.fbtrace_id) details.fbtraceId = String(errorObject.fbtrace_id)

  return details
}

export function formatWhatsAppApiError(payload: unknown, httpStatus?: number): string {
  const details = extractWhatsAppErrorDetails(payload, httpStatus)
  const lines: string[] = []

  if (details.title) lines.push(details.title)
  if (details.message) lines.push(details.message)

  const metaParts: string[] = []
  if (details.code != null) metaParts.push(`código ${details.code}`)
  if (details.errorSubcode != null) metaParts.push(`subcódigo ${details.errorSubcode}`)
  if (details.type) metaParts.push(details.type)
  if (details.httpStatus) metaParts.push(`HTTP ${details.httpStatus}`)
  if (details.fbtraceId) metaParts.push(`trace ${details.fbtraceId}`)

  if (metaParts.length > 0) {
    lines.push(`(${metaParts.join(", ")})`)
  }

  if (lines.length > 0) {
    return lines.join("\n").trim()
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload.trim()
  }

  return httpStatus ? `Erro HTTP ${httpStatus} ao enviar mensagem` : "Erro ao enviar mensagem"
}

export function whatsAppErrorDetailsToRecord(details: WhatsAppErrorDetails): Record<string, unknown> {
  return {
    title: details.title ?? null,
    message: details.message ?? null,
    code: details.code ?? null,
    errorSubcode: details.errorSubcode ?? null,
    type: details.type ?? null,
    fbtraceId: details.fbtraceId ?? null,
    httpStatus: details.httpStatus ?? null,
    rawResponse: details.rawResponse ?? null,
  }
}
