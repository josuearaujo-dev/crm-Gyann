import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface ErrorLogContext {
  tenantId?: string
  userId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  userAgent?: string
  ipAddress?: string
  additionalData?: Record<string, unknown>
}

export async function logError(error: Error | string, errorType: string, context?: ErrorLogContext): Promise<void> {
  try {
    const errorMessage = typeof error === "string" ? error : error.message
    const errorStack = typeof error === "string" ? undefined : error.stack

    const { error: insertError } = await supabase.from("error_logs").insert({
      tenant_id: context?.tenantId || null,
      user_id: context?.userId || null,
      error_type: errorType,
      error_message: errorMessage,
      error_stack: errorStack,
      context: context?.additionalData || null,
      endpoint: context?.endpoint || null,
      method: context?.method || null,
      status_code: context?.statusCode || null,
      user_agent: context?.userAgent || null,
      ip_address: context?.ipAddress || null,
    })

    if (insertError) {
      console.error("[v0] Failed to log error to database:", insertError)
    }
  } catch (logError) {
    // Don't let logging errors crash the app
    console.error("[v0] Error in error logger:", logError)
  }
}

export function getErrorContext(request: Request): Pick<ErrorLogContext, "endpoint" | "method" | "userAgent"> {
  return {
    endpoint: new URL(request.url).pathname,
    method: request.method,
    userAgent: request.headers.get("user-agent") || undefined,
  }
}
