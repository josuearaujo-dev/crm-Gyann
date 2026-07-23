"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { WhatsAppCredential } from "@/lib/types"
import { Eye, EyeOff, Save, Copy, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface WhatsAppCredentialsFormProps {
  credentials: WhatsAppCredential | null
  canManage: boolean
  tenantId: string | null
}

export function WhatsAppCredentialsForm({ credentials, canManage, tenantId }: WhatsAppCredentialsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    phone_number_id: credentials?.phone_number_id || "",
    access_token: credentials?.access_token || "",
    business_account_id: credentials?.business_account_id || "",
    verify_token: credentials?.verify_token || "",
  })

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/webhook/whatsapp` : "/api/webhook/whatsapp"

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) {
      setError("Você precisa estar vinculado a uma empresa")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    if (credentials) {
      const { error: updateError } = await supabase
        .from("whatsapp_credentials")
        .update({
          ...formData,
          connection_mode: "manual",
          coexistence_enabled: false,
          connection_status: "connected",
          connected_at: new Date().toISOString(),
          last_error: null,
          is_active: true,
        })
        .eq("id", credentials.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        router.refresh()
      }
    } else {
      const { error: insertError } = await supabase.from("whatsapp_credentials").insert({
        ...formData,
        tenant_id: tenantId,
        connection_mode: "manual",
        coexistence_enabled: false,
        connection_status: "connected",
        connected_at: new Date().toISOString(),
        is_active: true,
      })

      if (insertError) {
        setError(insertError.message)
      } else {
        setSuccess(true)
        router.refresh()
      }
    }
    setIsLoading(false)
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar credenciais.</p>
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="phone_number_id">Phone Number ID</Label>
          <Input
            id="phone_number_id"
            value={formData.phone_number_id}
            onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
            placeholder="1234567890"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="access_token">Access Token</Label>
          <div className="relative">
            <Input
              id="access_token"
              type={showToken ? "text" : "password"}
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="business_account_id">WABA ID / Business Account ID *</Label>
          <Input
            id="business_account_id"
            value={formData.business_account_id}
            onChange={(e) => setFormData({ ...formData, business_account_id: e.target.value })}
            placeholder="123456789012345"
            required
          />
          <p className="text-xs text-muted-foreground">
            Usado para criar templates na Meta via API (/{"{WABA_ID}"}/message_templates).
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="verify_token">Webhook Verify Token</Label>
          <Input
            id="verify_token"
            value={formData.verify_token}
            onChange={(e) => setFormData({ ...formData, verify_token: e.target.value })}
            placeholder="Crie um token único para verificação"
            required
          />
          <p className="text-xs text-muted-foreground">
            Crie um token secreto. Você usará este mesmo token na configuração do Webhook na Meta.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Salvo com sucesso!</p>}
        <Button type="submit" disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Salvando..." : "Salvar Credenciais"}
        </Button>
      </form>

      {credentials && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuração do Webhook na Meta</CardTitle>
            <CardDescription>
              Use estas informações para configurar o webhook no painel da Meta Business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Callback URL</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-background px-3 py-2 text-sm border break-all">{webhookUrl}</code>
                <Button type="button" variant="outline" size="icon" onClick={() => handleCopy(webhookUrl, "url")}>
                  {copied === "url" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Verify Token</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-background px-3 py-2 text-sm border">
                  {formData.verify_token || "Configure acima"}
                </code>
                {formData.verify_token && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(formData.verify_token, "token")}
                  >
                    {copied === "token" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-md bg-background p-3 text-sm">
              <p className="font-medium mb-2">Campos para inscrever no Webhook:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  <code className="text-xs bg-muted px-1 rounded">messages</code> - Status e mensagens
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 rounded">smb_message_echoes</code> - Mensagens enviadas pelo
                  app (Coexistence)
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 rounded">history</code> - Sincronização de histórico
                  (Coexistence)
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
