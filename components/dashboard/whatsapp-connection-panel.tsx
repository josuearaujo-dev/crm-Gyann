"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsAppCredentialsForm } from "@/components/dashboard/whatsapp-credentials-form"
import { WhatsAppCoexistenceConnect } from "@/components/dashboard/whatsapp-coexistence-connect"
import type { WhatsAppCredential } from "@/lib/types"
import { KeyRound, Smartphone } from "lucide-react"

interface WhatsAppConnectionPanelProps {
  credentials: WhatsAppCredential | null
  canManage: boolean
  tenantId: string | null
  coexistenceFeatureEnabled: boolean
}

export function WhatsAppConnectionPanel({
  credentials,
  canManage,
  tenantId,
  coexistenceFeatureEnabled,
}: WhatsAppConnectionPanelProps) {
  const defaultTab =
    credentials?.connection_mode === "coexistence" && coexistenceFeatureEnabled ? "coexistence" : "manual"

  const [tab, setTab] = useState(defaultTab)

  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Selecione uma empresa para configurar o WhatsApp.</p>
  }

  const publicIntegration = credentials
    ? {
        connectionMode: credentials.connection_mode ?? "manual",
        status: credentials.connection_status ?? (credentials.is_active ? "connected" : "disconnected"),
        displayPhoneNumber: credentials.display_phone_number ?? null,
        wabaId: credentials.business_account_id,
        phoneNumberId: credentials.phone_number_id,
        coexistenceEnabled: credentials.coexistence_enabled ?? false,
        connectedAt: credentials.connected_at ?? null,
        lastError: credentials.last_error ?? null,
      }
    : null

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={`grid w-full ${coexistenceFeatureEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
          <TabsTrigger value="manual" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Token permanente
          </TabsTrigger>
          {coexistenceFeatureEnabled && (
            <TabsTrigger value="coexistence" className="gap-2">
              <Smartphone className="h-4 w-4" />
              WhatsApp Business
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Use esta opção se o número já está configurado diretamente na WhatsApp Cloud API e você possui o token, o
            Phone Number ID e o WhatsApp Business Account ID.
          </p>
          <WhatsAppCredentialsForm credentials={credentials} canManage={canManage} tenantId={tenantId} />
        </TabsContent>

        {coexistenceFeatureEnabled && (
          <TabsContent value="coexistence" className="mt-4">
            <WhatsAppCoexistenceConnect
              tenantId={tenantId}
              canManage={canManage}
              coexistenceFeatureEnabled={coexistenceFeatureEnabled}
              currentIntegration={publicIntegration}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
