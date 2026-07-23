import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileForm } from "@/components/dashboard/profile-form"
import { ChangePasswordForm } from "@/components/dashboard/change-password-form"
import { MktzapCredentialsForm } from "@/components/dashboard/mktzap-credentials-form"
import { TemplatesList } from "@/components/dashboard/templates-list"
import { MktzapTemplatesList } from "@/components/dashboard/mktzap-templates-list"
import { TenantUsersManager } from "@/components/dashboard/tenant-users-manager"
import { ClientApiCredentialsForm } from "@/components/dashboard/client-api-credentials-form"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*, tenant:tenants(*)").eq("id", user.id).single()

  const tenantId = profile?.tenant_id ?? null
  const isManager = profile?.role === "manager"

  // Busca credenciais MKTZAP se o tenant estiver vinculado
  let mktzapCredentials = null
  let whatsappTemplates: any[] = []
  let mktzapTemplates: any[] = []
  let tenantUsers: any[] = []
  let clientApiCredentials: any[] = []
  if (tenantId) {
    const { data } = await supabase
      .from("mktzap_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .single()
    mktzapCredentials = data

    const { data: waTemplates } = await supabase
      .from("message_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name")
    whatsappTemplates = waTemplates || []

    const { data: mkTemplates } = await supabase
      .from("mktzap_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name")
    mktzapTemplates = mkTemplates || []

    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name, role, id_mktzap, created_at")
      .eq("tenant_id", tenantId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
    tenantUsers = users || []

    const { data: apiClientCredentials } = await supabase
      .from("client_api_credentials")
      .select("id, name, client_id, secret_prefix, is_active, last_used_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
    clientApiCredentials = apiClientCredentials || []
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
          <TabsTrigger value="perfil">Perfil e Empresa</TabsTrigger>
          <TabsTrigger value="usuarios" disabled={!tenantId || !isManager}>
            Usuários
          </TabsTrigger>
          <TabsTrigger value="api-cliente" disabled={!tenantId || !isManager}>
            API Cliente
          </TabsTrigger>
          <TabsTrigger value="credenciais" disabled={!tenantId || !isManager}>
            Credenciais MKTZAP
          </TabsTrigger>
          <TabsTrigger value="templates-whatsapp" disabled={!tenantId || !isManager}>
            Templates WhatsApp
          </TabsTrigger>
          <TabsTrigger value="templates-mktzap" disabled={!tenantId || !isManager}>
            Templates MKTZAP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">Perfil</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm profile={profile} email={user.email || ""} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">Alterar senha</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Altere sua senha de acesso</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">Empresa</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Informações da sua empresa</CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.tenant ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">{profile.tenant.name}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Slug</p>
                      <p className="font-mono text-sm">{profile.tenant.slug}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Seu papel</p>
                      <p className="font-medium capitalize">{profile.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Você ainda não está vinculado a uma empresa.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api-cliente">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">API para clientes</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Gere credenciais para sistemas externos enviarem mensagens WhatsApp pela sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientApiCredentialsForm
                credentials={clientApiCredentials}
                canManage={isManager}
                tenantId={tenantId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credenciais">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Credenciais MKTZAP</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Configure as credenciais de acesso à plataforma MKTZAP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MktzapCredentialsForm credentials={mktzapCredentials} canManage={isManager} tenantId={tenantId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Usuários da empresa</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Cadastre novos usuários da empresa com papel usuário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TenantUsersManager users={tenantUsers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates-whatsapp">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Templates WhatsApp</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Crie templates na Meta automaticamente e mapeie os parâmetros para os campos da API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatesList templates={whatsappTemplates} canManage={isManager} tenantId={tenantId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates-mktzap">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">Templates MKTZAP</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Sincronize e mapeie os templates usados na integração MKTZAP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MktzapTemplatesList templates={mktzapTemplates} canManage={isManager} tenantId={tenantId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
