import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SendMessagesForm } from "@/components/dashboard/send-messages-form"

export default async function MessagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const tenantId = profile?.tenant_id ?? null
  const canSelectApi = !!tenantId

  const { data: apiCredentials, error: apiCredsError } = await supabase
    .from("api_credentials")
    .select("*")
    .eq("is_active", true)
    .eq("tenant_id", tenantId)

  const { data: templates, error: templatesError } = await supabase
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .eq("tenant_id", tenantId)

  const { data: whatsappCredentials, error: whatsappCredsError } = await supabase
    .from("whatsapp_credentials")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle()

  // Log motivo de credenciais não configuradas (para diagnóstico)
  if (!tenantId) {
    console.log("[messages] Credenciais consideradas não configuradas: usuário sem tenant_id (profile.tenant_id ausente).")
  }
  if (!whatsappCredentials) {
    const reason = !tenantId
      ? "tenant_id ausente"
      : whatsappCredsError
        ? `erro ao buscar WhatsApp: ${whatsappCredsError.message} (code: ${whatsappCredsError.code})`
        : "nenhum registro de whatsapp_credentials ativo para este tenant"
    console.log("[messages] WhatsApp considerado não configurado:", reason)
  }
  if (!apiCredentials?.length) {
    const reason = !tenantId
      ? "tenant_id ausente"
      : apiCredsError
        ? `erro ao buscar API: ${apiCredsError.message} (code: ${apiCredsError.code})`
        : "nenhuma credencial de API ativa para este tenant"
    console.log("[messages] API considerada não configurada:", reason)
  }
  if (!templates?.length) {
    const reason = !tenantId
      ? "tenant_id ausente"
      : templatesError
        ? `erro ao buscar templates: ${templatesError.message} (code: ${templatesError.code})`
        : "nenhum template ativo para este tenant"
    console.log("[messages] Templates considerados não configurados:", reason)
  }

  // Busca configuração do tenant sobre reenvio de mensagens
  const { data: tenant } = await supabase
    .from("tenants")
    .select("message_resend_behavior")
    .eq("id", profile?.tenant_id)
    .single()

  const hasWhatsApp = !!whatsappCredentials
  const hasApi = (apiCredentials?.length || 0) > 0
  const hasTemplates = (templates?.length || 0) > 0
  const resendBehavior = tenant?.message_resend_behavior || "skip" // default: skip

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API WhatsApp</h1>
        <p className="text-muted-foreground">Busque dados da API e envie mensagens via WhatsApp</p>
      </div>

      {(!hasWhatsApp || !hasApi || !hasTemplates) && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">Configuração Necessária</CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300">
            <ul className="list-disc pl-5 space-y-1">
              {!hasWhatsApp && <li>Configure as credenciais do WhatsApp</li>}
              {!hasApi && <li>Adicione uma credencial de API</li>}
              {!hasTemplates && <li>Crie pelo menos um template</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Buscar e Enviar</CardTitle>
          <CardDescription>Selecione o período e a API para buscar os dados</CardDescription>
        </CardHeader>
        <CardContent>
          <SendMessagesForm
            apiCredentials={apiCredentials || []}
            templates={templates || []}
            tenantId={profile?.tenant_id}
            userId={user.id}
            disabled={!hasWhatsApp || !hasApi || !hasTemplates}
            resendBehavior={resendBehavior as "skip" | "resend"}
            canSelectApi={canSelectApi}
          />
        </CardContent>
      </Card>
    </div>
  )
}
