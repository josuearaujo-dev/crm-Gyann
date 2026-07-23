import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MktzapSendMessagesForm } from "@/components/dashboard/mktzap-send-messages-form"
import Link from "next/link"

export default async function MktzapPage() {
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
  const canManage = profile?.role === "admin" || profile?.role === "manager" || profile?.is_super_admin

  // Verifica se o tenant tem credenciais MKTZAP
  let hasMktzapCredentials = false
  if (tenantId) {
    const { data } = await supabase
      .from("mktzap_credentials")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single()
    hasMktzapCredentials = !!data
  }

  // Verifica se tem API de dados (mesma do WhatsApp)
  const { data: apiCredentials } = await supabase
    .from("api_credentials")
    .select("*")
    .eq("is_active", true)
    .eq("tenant_id", tenantId)

  const hasApi = (apiCredentials?.length || 0) > 0

  // Busca templates MKTZAP
  let mktzapTemplates: any[] = []
  if (tenantId) {
    const { data } = await supabase
      .from("mktzap_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name")
    mktzapTemplates = data || []
  }

  const hasTemplates = mktzapTemplates.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">MKTZAP</h1>
        <p className="text-muted-foreground">Integração MKTZAP — mesma fonte de dados, envio via MKTZAP</p>
      </div>

      {(!hasMktzapCredentials || !hasApi) && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">Configuração Necessária</CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300">
            <ul className="list-disc pl-5 space-y-1">
              {!hasMktzapCredentials && (
                <li>
                  Configure as credenciais MKTZAP em{" "}
                  <Link href="/dashboard/settings" className="underline font-medium">
                    Configurações
                  </Link>
                </li>
              )}
              {!hasApi && <li>Adicione uma credencial de API de Dados</li>}
              {hasMktzapCredentials && !hasTemplates && <li>Sincronize e configure ao menos 1 template MKTZAP</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasMktzapCredentials && hasApi && hasTemplates && (
        <Card>
          <CardHeader>
            <CardTitle>Envio de Mensagens MKTZAP</CardTitle>
            <CardDescription>
              Busque os registros na API de dados e envie usando o template MKTZAP selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MktzapSendMessagesForm
              apiCredentials={apiCredentials || []}
              templates={mktzapTemplates}
              tenantId={tenantId}
              disabled={!tenantId}
              canSelectApi={canManage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
