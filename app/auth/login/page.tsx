"use client"

import type React from "react"

import { createClient } from "../../../lib/supabase/client"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"

// Background animado usando apenas CSS (sem Three.js para evitar problemas de compatibilidade)
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#174873] via-[#19849c] to-[#30BFBF]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)] animate-pulse" />
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [recoverySuccess, setRecoverySuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setRecoverySuccess(params.get("recovered") === "1")
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Erro ao fazer login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Informe seu e-mail para receber o link de redefinição.")
      setInfo(null)
      return
    }

    const supabase = createClient()
    setIsResettingPassword(true)
    setError(null)
    setInfo(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setInfo("Enviamos um link de redefinição para o seu e-mail.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link de redefinição.")
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Background - full screen */}
      <div className="absolute inset-0">
        <AnimatedBackground />
      </div>

      {/* Content - centered card */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4 sm:p-6">
        {/* Desktop version with two columns */}
        <div className="hidden md:grid w-full max-w-[56rem] overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
          {/* Left side - branding */}
          <div className="relative flex bg-gradient-to-br from-[#174873] to-[#19849c] p-10 text-white">
            <div className="flex h-full flex-col justify-between">
              <div>
                

                <h1 className="mb-5 text-3xl font-bold leading-tight">
                  Manage Notify integra notificações ao seu ecossistema
                </h1>

                <p className="text-base text-white/90">
                  Conecte-se para enviar mensagens WhatsApp, gerenciar templates e monitorar entregas em tempo real.
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm leading-relaxed text-white/90">
                  O Manage Notify foi criado para simplificar comunicações. Automatize envios, aplique templates
                  personalizados e entregue mensagens confiáveis aos seus clientes.
                </p>
              </div>
            </div>
          </div>

          {/* Right side - login form (desktop) */}
          <div className="flex items-center justify-center bg-white p-10">
            <div className="w-full max-w-sm">
              <div className="mb-7">
                <div className="flex items-start gap-4 mb-3">
                  <Image
                    src="/logo-manage-notify.png"
                    alt="Manage Notify Logo"
                    width={72}
                    height={72}
                    className="flex-shrink-0 object-contain"
                  />
                  <div>
                    <h2 className="text-xl font-normal text-gray-600 leading-tight">Bem-vindo ao</h2>
                    <h1 className="text-3xl font-bold text-[#174873] leading-tight">Manage Notify</h1>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Use suas credenciais corporativas para monitorar integrações e gerir suas conexões de dados.
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email-desktop" className="text-sm font-medium text-gray-700">
                      E-mail corporativo
                    </Label>
                    <Input
                      id="email-desktop"
                      type="email"
                      placeholder="admin@managetour.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-lg border-gray-200 bg-gray-50 px-4 text-base"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password-desktop" className="text-sm font-medium text-gray-700">
                      Senha
                    </Label>
                    <Input
                      id="password-desktop"
                      type="password"
                      placeholder="••••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-lg border-gray-200 bg-gray-50 px-4 text-base"
                    />
                  </div>

                  {(recoverySuccess || info) && (
                    <p className="text-sm text-emerald-700">
                      {recoverySuccess ? "Senha redefinida com sucesso. Faça login com a nova senha." : info}
                    </p>
                  )}
                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-lg bg-[#174873] text-base font-medium text-white hover:bg-[#174873]/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 justify-start text-[#174873]"
                    onClick={handleResetPassword}
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword ? "Enviando link..." : "Redefinir senha"}
                  </Button>
                </div>

                
              </form>
            </div>
          </div>
        </div>

        {/* Mobile version */}
        <div className="md:hidden w-full max-w-sm">
          <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-2xl p-6">
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-2">
                <Image
                  src="/logo-manage-notify.png"
                  alt="Manage Notify Logo"
                  width={58}
                  height={58}
                  className="flex-shrink-0 object-contain"
                />
                <div>
                  <h2 className="text-lg font-normal text-gray-600 leading-tight">Bem-vindo ao</h2>
                  <h1 className="text-2xl font-bold text-[#174873] leading-tight">Manage Notify</h1>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Use suas credenciais corporativas para monitorar integrações e gerir suas conexões de dados.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email-mobile" className="text-sm font-medium text-gray-700">
                    E-mail corporativo
                  </Label>
                  <Input
                    id="email-mobile"
                    type="email"
                    placeholder="admin@managetour.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-lg border-gray-200 bg-gray-50 px-4 text-base"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password-mobile" className="text-sm font-medium text-gray-700">
                    Senha
                  </Label>
                  <Input
                    id="password-mobile"
                    type="password"
                    placeholder="••••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-lg border-gray-200 bg-gray-50 px-4 text-base"
                  />
                </div>

                {(recoverySuccess || info) && (
                  <p className="text-sm text-emerald-700">
                    {recoverySuccess ? "Senha redefinida com sucesso. Faça login com a nova senha." : info}
                  </p>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-lg bg-[#174873] text-base font-medium text-white hover:bg-[#174873]/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 justify-start text-[#174873]"
                  onClick={handleResetPassword}
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? "Enviando link..." : "Redefinir senha"}
                </Button>
              </div>

              
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
