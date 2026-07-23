"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Smartphone, Loader2, Unplug, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>,
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

interface PublicIntegration {
  connectionMode: string
  status: string
  displayPhoneNumber: string | null
  wabaId: string | null
  phoneNumberId: string
  coexistenceEnabled: boolean
  connectedAt: string | null
  lastError: string | null
}

interface WhatsAppCoexistenceConnectProps {
  tenantId: string
  canManage: boolean
  coexistenceFeatureEnabled: boolean
  currentIntegration?: PublicIntegration | null
}

function loadFacebookSdk(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve()
      return
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      })
      resolve()
    }

    if (document.getElementById("facebook-jssdk")) {
      return
    }

    const script = document.createElement("script")
    script.id = "facebook-jssdk"
    script.src = "https://connect.facebook.net/en_US/sdk.js"
    script.async = true
    script.onerror = () => reject(new Error("Falha ao carregar o SDK da Meta"))
    document.body.appendChild(script)
  })
}

export function WhatsAppCoexistenceConnect({
  tenantId,
  canManage,
  coexistenceFeatureEnabled,
  currentIntegration,
}: WhatsAppCoexistenceConnectProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [integration, setIntegration] = useState<PublicIntegration | null>(currentIntegration || null)
  const router = useRouter()

  const refreshStatus = useCallback(async () => {
    const response = await fetch(`/api/integrations/whatsapp/coexistence/status?tenantId=${tenantId}`)
    const data = await response.json()
    if (response.ok) {
      setIntegration(data.integration)
    }
  }, [tenantId])

  useEffect(() => {
    if (coexistenceFeatureEnabled) {
      void refreshStatus()
    }
  }, [coexistenceFeatureEnabled, refreshStatus])

  if (!coexistenceFeatureEnabled) {
    return null
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Sem permissão para conectar o WhatsApp Business.</p>
  }

  const isCoexistenceConnected =
    integration?.connectionMode === "coexistence" && integration?.status === "connected"

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const sessionResponse = await fetch("/api/integrations/whatsapp/coexistence/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })

      const sessionData = await sessionResponse.json()
      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || "Falha ao iniciar conexão")
      }

      const { state, appId, configId } = sessionData as {
        state: string
        appId: string
        configId: string
      }

      await loadFacebookSdk(appId)

      const sessionInfoExtras: Record<string, string> = {}

      const finishWithCode = async (code: string, extras: Record<string, string>) => {
        const completeResponse = await fetch("/api/integrations/whatsapp/coexistence/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            state,
            tenantId,
            wabaId: extras.waba_id || extras.wabaId,
            phoneNumberId: extras.phone_number_id || extras.phoneNumberId,
            businessId: extras.business_id || extras.businessId,
          }),
        })

        const completeData = await completeResponse.json()
        if (!completeResponse.ok) {
          throw new Error(completeData.error || "Falha ao finalizar conexão")
        }

        setSuccess("WhatsApp Business conectado com sucesso.")
        setIntegration(completeData.integration)
        router.refresh()
      }

      const messageHandler = (event: MessageEvent) => {
        if (!event.origin.includes("facebook.com") && !event.origin.includes("fb.com")) {
          return
        }

        try {
          const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data
          if (payload?.type === "WA_EMBEDDED_SIGNUP") {
            const data = payload.data || {}
            if (data.waba_id) sessionInfoExtras.waba_id = String(data.waba_id)
            if (data.phone_number_id) sessionInfoExtras.phone_number_id = String(data.phone_number_id)
            if (data.business_id) sessionInfoExtras.business_id = String(data.business_id)
          }
        } catch {
          // ignore non-JSON messages
        }
      }

      window.addEventListener("message", messageHandler)

      await new Promise<void>((resolve, reject) => {
        if (!window.FB) {
          reject(new Error("SDK da Meta não disponível"))
          return
        }

        window.FB.login(
          (response) => {
            window.removeEventListener("message", messageHandler)

            const code = response?.authResponse?.code
            if (!code) {
              reject(new Error("Conexão cancelada ou código não recebido da Meta"))
              return
            }

            finishWithCode(code, sessionInfoExtras).then(resolve).catch(reject)
          },
          {
            config_id: configId,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            },
          },
        )
      })
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Erro ao conectar")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Deseja desconectar este número do sistema?\n\nO WhatsApp Business continuará no celular, mas o sistema deixará de enviar e receber mensagens por esta conexão.",
      )
    ) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/integrations/whatsapp/coexistence/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Falha ao desconectar")
      }
      setSuccess(data.message || "Desconectado")
      setIntegration(null)
      router.refresh()
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Erro ao desconectar")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-5 w-5 text-emerald-700" />
          Conectar WhatsApp Business do celular
        </CardTitle>
        <CardDescription>
          Use o mesmo número no aplicativo WhatsApp Business e no sistema. Você continuará utilizando o WhatsApp
          Business normalmente no celular.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCoexistenceConnected && integration ? (
          <div className="space-y-3 rounded-md border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600">Conectado</Badge>
              <Badge variant="outline">WhatsApp Business do celular</Badge>
            </div>
            <p>
              <span className="text-muted-foreground">Número:</span>{" "}
              {integration.displayPhoneNumber || integration.phoneNumberId}
            </p>
            <p>
              <span className="text-muted-foreground">Sincronização:</span> Ativa
            </p>
            {integration.connectedAt && (
              <p>
                <span className="text-muted-foreground">Conectado em:</span>{" "}
                {new Date(integration.connectedAt).toLocaleString("pt-BR")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconectar com a Meta
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDisconnect} disabled={isLoading}>
                <Unplug className="mr-2 h-4 w-4" />
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" onClick={handleConnect} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
            Conectar com a Meta
          </Button>
        )}

        {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </CardContent>
    </Card>
  )
}
