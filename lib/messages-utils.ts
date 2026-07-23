import type { CSSProperties } from "react"
import type { Message } from "@/lib/types"

export const MESSAGES_INITIAL_LIMIT = 300
export const MESSAGES_PAGE_SIZE = 25

export type MessageStatusKey = "pending" | "sent" | "delivered" | "read" | "failed" | "sending"

export interface MessageStatusStyle {
  label: string
  className: string
  style?: CSSProperties
}

export const MESSAGE_STATUS_STYLES: Record<MessageStatusKey, MessageStatusStyle> = {
  sending: { label: "Enviando...", className: "bg-gray-200 text-gray-700" },
  pending: { label: "Pendente", className: "bg-gray-200 text-gray-700" },
  sent: { label: "Enviada", className: "text-white", style: { backgroundColor: "#005375" } },
  delivered: { label: "Entregue", className: "text-white", style: { backgroundColor: "#53bdea" } },
  read: { label: "Lida", className: "text-white", style: { backgroundColor: "#34a868" } },
  failed: { label: "Falhou", className: "bg-red-500 text-white" },
}

export function getMessageStatusStyle(status: string): MessageStatusStyle {
  return MESSAGE_STATUS_STYLES[status as MessageStatusKey] ?? MESSAGE_STATUS_STYLES.pending
}

function parseMessagePayload(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof payload === "object") return payload as Record<string, unknown>
  return null
}

export function getMessageServiceName(message: Message): string {
  const recordData = message.metadata?.recordData as Record<string, unknown> | undefined
  if (recordData?.servico) return String(recordData.servico)
  return "—"
}

export function getMessagePayloadContent(message: Message): string {
  const payload = parseMessagePayload(message.payload)
  if (!payload) return "—"

  if (payload.type === "text") {
    const text = payload.text as Record<string, unknown> | undefined
    if (text?.body) return String(text.body)
  }

  const template = payload.template as Record<string, unknown> | undefined
  const components = template?.components as Array<Record<string, unknown>> | undefined
  if (!components?.length) return "—"

  const sections: string[] = []

  for (const component of components) {
    const type = String(component.type || "")
    const parameters = component.parameters as Array<Record<string, unknown>> | undefined
    if (!parameters?.length) continue

    if (type === "header") {
      const headerText = parameters
        .map((param) => {
          if (param.type === "text") return String(param.text || "")
          if (param.type === "image") return "[Imagem]"
          if (param.type === "video") return "[Vídeo]"
          if (param.type === "document") return "[Documento]"
          return ""
        })
        .filter(Boolean)
        .join(" ")
      if (headerText) sections.push(headerText)
    }

    if (type === "body") {
      const bodyText = parameters
        .map((param) => String(param.text || ""))
        .filter((text) => text.length > 0)
        .join("\n")
      if (bodyText) sections.push(bodyText)
    }
  }

  return sections.join("\n\n").trim() || "—"
}

export function messageMatchesSearch(message: Message, searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase()
  if (!term) return true

  const serviceName = getMessageServiceName(message).toLowerCase()
  const content = getMessagePayloadContent(message).toLowerCase()
  return (
    message.recipient_phone?.toLowerCase().includes(term) ||
    message.template_name?.toLowerCase().includes(term) ||
    (serviceName !== "—" && serviceName.includes(term)) ||
    (content !== "—" && content.includes(term))
  )
}
