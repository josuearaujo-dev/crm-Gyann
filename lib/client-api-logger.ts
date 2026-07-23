import { createAdminClient } from "@/lib/supabase/admin"

export type ClientApiLogStatus = "success" | "failed" | "validation_error"

export interface ClientApiMessageLogInput {
  tenantId: string
  credentialId?: string | null
  credentialName?: string | null
  templateId?: string | null
  templateName?: string | null
  externalId?: string | null
  recipientPhone?: string | null
  parameters?: Record<string, string>
  status: ClientApiLogStatus
  errorMessage?: string | null
  errorDetails?: Record<string, unknown> | null
  whatsappMessageId?: string | null
  messageId?: string | null
  payload?: Record<string, unknown> | null
  httpStatus?: number | null
  requestIp?: string | null
  userAgent?: string | null
}

export function getClientRequestMeta(request: Request): { requestIp?: string; userAgent?: string } {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const requestIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined
  const userAgent = request.headers.get("user-agent") || undefined

  return { requestIp, userAgent }
}

export async function logClientApiMessageAttempt(input: ClientApiMessageLogInput): Promise<string | null> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from("client_api_message_logs")
      .insert({
        tenant_id: input.tenantId,
        credential_id: input.credentialId || null,
        credential_name: input.credentialName || null,
        template_id: input.templateId || null,
        template_name: input.templateName || null,
        external_id: input.externalId || null,
        recipient_phone: input.recipientPhone || null,
        parameters: input.parameters || {},
        status: input.status,
        error_message: input.errorMessage || null,
        error_details: input.errorDetails || null,
        whatsapp_message_id: input.whatsappMessageId || null,
        message_id: input.messageId || null,
        payload: input.payload || null,
        http_status: input.httpStatus ?? null,
        request_ip: input.requestIp || null,
        user_agent: input.userAgent || null,
      })
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[client-api] Failed to write message log:", error.message)
      return null
    }

    return data?.id || null
  } catch (error) {
    console.error("[client-api] Failed to write message log:", error)
    return null
  }
}
