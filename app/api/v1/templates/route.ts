import { NextResponse } from "next/server"
import { authenticateClientApiRequest } from "@/lib/client-api-auth"
import { getOrderedParameterMappingEntries } from "@/lib/client-api-messages"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  try {
    const auth = await authenticateClientApiRequest(request)

    if (!auth) {
      return NextResponse.json({ error: "Credenciais inválidas ou inativas" }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: templates, error } = await admin
      .from("message_templates")
      .select("id, name, language_code, description, parameter_mapping, meta_status, is_active")
      .eq("tenant_id", auth.tenantId)
      .eq("is_active", true)
      .order("name")

    if (error) {
      return NextResponse.json({ error: "Erro ao listar templates" }, { status: 500 })
    }

    const items = (templates || [])
      .filter((template) => !template.meta_status || template.meta_status === "APPROVED")
      .map((template) => {
        const mapping = (template.parameter_mapping || {}) as Record<string, string>

        return {
          id: template.id,
          name: template.name,
          languageCode: template.language_code,
          description: template.description,
          parameters: Object.keys(mapping),
          parameterSchema: getOrderedParameterMappingEntries(mapping).map(([key, fieldName]) => ({
            key,
            fieldName,
          })),
          metaStatus: template.meta_status,
        }
      })

    return NextResponse.json({
      templates: items,
      count: items.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    )
  }
}
