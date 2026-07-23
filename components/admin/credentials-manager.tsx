"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiCredentialsForm } from "@/components/dashboard/api-credentials-form"
import { WhatsAppConnectionPanel } from "@/components/dashboard/whatsapp-connection-panel"
import { MktzapCredentialsForm } from "@/components/dashboard/mktzap-credentials-form"
import type { Tenant, ApiCredential, WhatsAppCredential, MktzapCredential } from "@/lib/types"
import { Building2 } from "lucide-react"

interface AdminCredentialsManagerProps {
  tenants: Tenant[]
  coexistenceFeatureEnabled?: boolean
}

export function AdminCredentialsManager({
  tenants,
  coexistenceFeatureEnabled = false,
}: AdminCredentialsManagerProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("")
  const [apiCredentials, setApiCredentials] = useState<ApiCredential[]>([])
  const [whatsappCredentials, setWhatsappCredentials] = useState<WhatsAppCredential | null>(null)
  const [mktzapCredentials, setMktzapCredentials] = useState<MktzapCredential | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedTenantId) {
      loadCredentials()
    } else {
      setApiCredentials([])
      setWhatsappCredentials(null)
      setMktzapCredentials(null)
    }
  }, [selectedTenantId])

  const loadCredentials = async () => {
    setLoading(true)
    const supabase = createClient()

    const [apiRes, whatsappRes, mktzapRes] = await Promise.all([
      supabase.from("api_credentials").select("*").eq("tenant_id", selectedTenantId),
      supabase.from("whatsapp_credentials").select("*").eq("tenant_id", selectedTenantId).single(),
      supabase.from("mktzap_credentials").select("*").eq("tenant_id", selectedTenantId).single(),
    ])

    setApiCredentials(apiRes.data || [])
    setWhatsappCredentials(whatsappRes.data || null)
    setMktzapCredentials(mktzapRes.data || null)
    setLoading(false)
  }

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Selecionar Empresa
          </CardTitle>
          <CardDescription>Escolha a empresa para gerenciar as credenciais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="tenant">Empresa</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger id="tenant">
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTenantId && (
        <Card>
          <CardHeader>
            <CardTitle>Credenciais - {selectedTenant?.name}</CardTitle>
            <CardDescription>Configure as credenciais de API e WhatsApp para esta empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Tabs defaultValue="api" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="api">API de Dados</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="mktzap">MKTZAP</TabsTrigger>
                </TabsList>
                <TabsContent value="api" className="mt-6">
                  <ApiCredentialsForm credentials={apiCredentials} canManage={true} tenantId={selectedTenantId} />
                </TabsContent>
                <TabsContent value="whatsapp" className="mt-6">
                  <WhatsAppConnectionPanel
                    credentials={whatsappCredentials}
                    canManage={true}
                    tenantId={selectedTenantId}
                    coexistenceFeatureEnabled={coexistenceFeatureEnabled}
                  />
                </TabsContent>
                <TabsContent value="mktzap" className="mt-6">
                  <MktzapCredentialsForm
                    credentials={mktzapCredentials}
                    canManage={true}
                    tenantId={selectedTenantId}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
