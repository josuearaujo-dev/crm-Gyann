import type { MessageTemplate } from "@/lib/types"

export function getOrderedParameterMappingEntries(
  mapping: Record<string, string> = {},
): Array<[paramName: string, fieldName: string]> {
  return Object.entries(mapping).sort(([a], [b]) => {
    const numA = Number(a)
    const numB = Number(b)

    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB
    }

    return a.localeCompare(b, "pt-BR")
  })
}

export function getTemplateParameterKeys(template: MessageTemplate): string[] {
  return getOrderedParameterMappingEntries(template.parameter_mapping || {}).map(([key]) => key)
}

export function validateTemplateForSend(template: MessageTemplate): string | null {
  if (!template.is_active) {
    return "Template não está ativo para envio"
  }

  if (template.meta_status && template.meta_status !== "APPROVED") {
    if (template.meta_status === "PENDING") {
      return "Template aguardando aprovação na Meta"
    }

    return "Template não está aprovado para envio"
  }

  if (!template.name || template.name.trim() === "") {
    return "Template sem nome configurado"
  }

  const parameterKeys = getTemplateParameterKeys(template)
  if (parameterKeys.length === 0) {
    return "Template sem mapeamento de parâmetros"
  }

  return null
}

export function validateClientParameters(
  template: MessageTemplate,
  parameters: Record<string, string>,
): string | null {
  const missing = getTemplateParameterKeys(template).filter((key) => {
    const value = parameters[key]
    return value == null || String(value).trim() === ""
  })

  if (missing.length > 0) {
    return `Parâmetros obrigatórios ausentes: ${missing.join(", ")}`
  }

  return null
}

export function mapClientParametersToRecord(
  template: MessageTemplate,
  parameters: Record<string, string>,
): Record<string, string> {
  const record: Record<string, string> = {}

  for (const [paramName, fieldName] of getOrderedParameterMappingEntries(template.parameter_mapping || {})) {
    record[fieldName] = String(parameters[paramName] ?? "").trim()
  }

  return record
}
