import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { logError, getErrorContext } from "@/lib/error-logger"
import { findWhatsAppCredentialsByPhoneNumberId } from "@/lib/whatsapp-credentials"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured")
  }

  return createClient(url, serviceRoleKey)
}

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "wo01Maker@1"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (mode === "subscribe" && challenge) {
    if (token === WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }
  }

  return new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[webhook] received:", JSON.stringify(body, null, 2))

    const entries = body.entry || []

    for (const entry of entries) {
      const changes = entry.changes || []

      for (const change of changes) {
        switch (change.field) {
          case "messages":
            await handleMessagesWebhook(change.value)
            break
          case "smb_message_echoes":
            await handleSmbMessageEchoes(change.value)
            break
          case "smb_app_state_sync":
            await handleSmbAppStateSync(change.value)
            break
          case "history":
            await handleHistoryWebhook(change.value)
            break
          default:
            console.log("[webhook] ignored field:", change.field)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), "WEBHOOK_ERROR", {
      ...getErrorContext(request),
      statusCode: 500,
    })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function touchLastWebhook(phoneNumberId?: string) {
  if (!phoneNumberId) return

  const supabase = getSupabaseAdmin()
  await supabase
    .from("whatsapp_credentials")
    .update({ last_webhook_at: new Date().toISOString() })
    .eq("phone_number_id", phoneNumberId)
}

async function handleMessagesWebhook(value: Record<string, unknown>) {
  const phoneNumberId = (value?.metadata as { phone_number_id?: string } | undefined)?.phone_number_id
  await touchLastWebhook(phoneNumberId)

  const statuses = (value.statuses as Array<Record<string, unknown>>) || []
  for (const status of statuses) {
    await processStatusUpdate(status as {
      id: string
      status: string
      timestamp?: string
      recipient_id?: string
      errors?: Array<{ code: number; title: string }>
    })
  }

  const messages = (value.messages as Array<Record<string, unknown>>) || []
  for (const message of messages) {
    console.log("[webhook] incoming message:", message.type, message.id)

    if (message.type === "button") {
      console.log("[webhook] button reply:", message.button)
    }
  }
}

async function handleSmbMessageEchoes(value: Record<string, unknown>) {
  const phoneNumberId = (value?.metadata as { phone_number_id?: string } | undefined)?.phone_number_id
  await touchLastWebhook(phoneNumberId)

  const integration = phoneNumberId ? await findWhatsAppCredentialsByPhoneNumberId(phoneNumberId) : null
  if (!integration) {
    console.log("[webhook] smb_message_echoes: integração não encontrada para", phoneNumberId)
    return
  }

  const echoes = (value.message_echoes as Array<Record<string, unknown>>) || []
  const supabase = getSupabaseAdmin()

  for (const echo of echoes) {
    const externalId = String(echo.id || "")
    if (!externalId) continue

    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", externalId)
      .maybeSingle()

    if (existing) {
      continue
    }

    const to = String(echo.to || "")
    const from = String(echo.from || "")

    await supabase.from("messages").insert({
      tenant_id: integration.tenant_id,
      whatsapp_message_id: externalId,
      recipient_phone: to || from,
      recipient_wa_id: to || from,
      template_name: "whatsapp_business_app",
      payload: echo,
      status: "sent",
      message_source: "whatsapp_business_app",
      direction: "outbound",
      metadata: {
        source: "smb_message_echoes",
        phoneNumberId,
      },
    })
  }
}

async function handleSmbAppStateSync(value: Record<string, unknown>) {
  const phoneNumberId = (value?.metadata as { phone_number_id?: string } | undefined)?.phone_number_id
  await touchLastWebhook(phoneNumberId)
  console.log("[webhook] smb_app_state_sync received for", phoneNumberId, Object.keys(value || {}))
}

async function handleHistoryWebhook(value: Record<string, unknown>) {
  const phoneNumberId = (value?.metadata as { phone_number_id?: string } | undefined)?.phone_number_id
  await touchLastWebhook(phoneNumberId)

  const supabase = getSupabaseAdmin()
  if (phoneNumberId) {
    await supabase
      .from("whatsapp_credentials")
      .update({ history_sync_status: "syncing" })
      .eq("phone_number_id", phoneNumberId)
  }

  console.log("[webhook] history event received for", phoneNumberId)
}

async function processStatusUpdate(status: {
  id: string
  status: string
  timestamp?: string
  recipient_id?: string
  errors?: Array<{ code: number; title: string }>
}) {
  try {
    const supabase = getSupabaseAdmin()
    const messageId = status.id
    const newStatus = mapWebhookStatus(status.status)
    const timestamp = status.timestamp
      ? new Date(Number.parseInt(status.timestamp) * 1000).toISOString()
      : new Date().toISOString()

    const { data: message, error: findError } = await supabase
      .from("messages")
      .select("id, status, tenant_id")
      .eq("whatsapp_message_id", messageId)
      .single()

    if (findError || !message) {
      console.log("[webhook] Message not found for ID:", messageId)
      return
    }

    const statusOrder = ["pending", "sent", "delivered", "read", "failed"]
    const currentIndex = statusOrder.indexOf(message.status)
    const newIndex = statusOrder.indexOf(newStatus)

    if (newStatus !== "failed" && newIndex <= currentIndex) {
      console.log("[webhook] Skipping status update - current status is already ahead")
      return
    }

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      status_updated_at: timestamp,
    }

    if (newStatus === "failed" && status.errors?.length) {
      updatePayload.error_message = status.errors.map((e) => `${e.title} (${e.code})`).join("; ")
    }

    const { error: updateError } = await supabase.from("messages").update(updatePayload).eq("id", message.id)

    if (updateError) {
      await logError(updateError, "WEBHOOK_STATUS_UPDATE_ERROR", {
        endpoint: "/api/webhook/whatsapp",
        method: "POST",
        tenantId: message.tenant_id,
        additionalData: {
          messageId: message.id,
          whatsappMessageId: messageId,
          newStatus,
        },
      })
      return
    }

    const { error: historyError } = await supabase.from("message_status_history").insert({
      message_id: message.id,
      status: newStatus,
      timestamp,
      raw_payload: status,
    })

    if (historyError) {
      await logError(historyError, "WEBHOOK_HISTORY_INSERT_ERROR", {
        endpoint: "/api/webhook/whatsapp",
        method: "POST",
        tenantId: message.tenant_id,
        additionalData: { messageId: message.id },
      })
    }

    console.log("[webhook] Status updated:", { messageId: message.id, newStatus })
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), "WEBHOOK_PROCESS_STATUS_ERROR", {
      endpoint: "/api/webhook/whatsapp",
      method: "POST",
      additionalData: { statusPayload: status },
    })
  }
}

function mapWebhookStatus(webhookStatus: string): string {
  const statusMap: Record<string, string> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  }
  return statusMap[webhookStatus] || "sent"
}
