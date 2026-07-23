"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TemplatesList } from "@/components/dashboard/templates-list"
import { MktzapTemplatesList } from "@/components/dashboard/mktzap-templates-list"
import type { Tenant, MessageTemplate, MktzapTemplate } from "@/lib/types"
import { Building2 } from "lucide-react"

interface AdminTemplatesManagerProps {
  tenants: Tenant[]
}

export function AdminTemplatesManager({ tenants }: AdminTemplatesManagerProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("")
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [mktzapTemplates, setMktzapTemplates] = useState<MktzapTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedTenantId) {
      loadTemplates()
    } else {
      setTemplates([])
      setMktzapTemplates([])
    }
  }, [selectedTenantId])

  const loadTemplates = async () => {
    setLoading(true)
    const supabase = createClient()

    const [whatsappRes, mktzapRes] = await Promise.all([
      supabase
        .from("message_templates")
        .select("*")
        .eq("tenant_id", selectedTenantId)
        .order("name"),
      supabase
        .from("mktzap_templates")
        .select("*")
        .eq("tenant_id", selectedTenantId)
        .order("name"),
    ])

    setTemplates(whatsappRes.data || [])
    setMktzapTemplates(mktzapRes.data || [])
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
          <CardDescription>Escolha a empresa para gerenciar os templates</CardDescription>
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
            <CardTitle>Templates - {selectedTenant?.name}</CardTitle>
            <CardDescription>Configure os templates de mensagem para esta empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Tabs defaultValue="whatsapp" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="mktzap">MKTZAP</TabsTrigger>
                </TabsList>
                <TabsContent value="whatsapp" className="mt-6">
                  <TemplatesList templates={templates} canManage={true} tenantId={selectedTenantId} />
                </TabsContent>
                <TabsContent value="mktzap" className="mt-6">
                  <MktzapTemplatesList templates={mktzapTemplates} canManage={true} tenantId={selectedTenantId} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
