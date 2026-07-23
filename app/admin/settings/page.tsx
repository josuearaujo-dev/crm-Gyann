import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MessageSettingsManager } from "@/components/admin/message-settings-manager"

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

  if (!profile?.is_super_admin) {
    redirect("/dashboard")
  }

  // Busca todos os tenants com suas configurações
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, message_resend_behavior")
    .order("name")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      <MessageSettingsManager tenants={tenants || []} />

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>URL para configurar no Meta Business Suite para receber status de mensagens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>URL do Webhook</Label>
            <Input
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/api/webhook/whatsapp`
                  : "/api/webhook/whatsapp"
              }
              readOnly
              className="font-mono bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Configure esta URL no Meta Business Suite para receber atualizações de status das mensagens.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
          <CardDescription>Detalhes técnicos do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">Versão</dt>
              <dd className="font-medium">1.0.0</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">API do WhatsApp</dt>
              <dd className="font-medium">WhatsApp Business Cloud API</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
