"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(false)
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Senha curta",
        description: "A nova senha deve ter no mínimo 6 caracteres.",
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas diferentes",
        description: "A nova senha e a confirmação não coincidem.",
      })
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Sessão inválida. Faça login novamente.",
      })
      setIsLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      toast({
        variant: "destructive",
        title: "Senha atual incorreta",
        description: "A senha atual informada não está correta.",
      })
      setIsLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: updateError.message,
      })
      setIsLoading(false)
      return
    }

    setSuccessMessage(true)
    toast({
      title: "Senha alterada",
      description: "Sua senha foi alterada com sucesso.",
    })
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="current_password">Senha atual</Label>
        <Input
          id="current_password"
          type="password"
          value={currentPassword}
          onChange={(e) => { setCurrentPassword(e.target.value); setSuccessMessage(false) }}
          placeholder="Digite sua senha atual"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new_password">Nova senha</Label>
        <Input
          id="new_password"
          type="password"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setSuccessMessage(false) }}
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm_password">Confirmar nova senha</Label>
        <Input
          id="confirm_password"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setSuccessMessage(false) }}
          placeholder="Repita a nova senha"
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        <Lock className="mr-2 h-4 w-4" />
        {isLoading ? "Alterando..." : "Alterar senha"}
      </Button>
      {successMessage && (
        <p className="text-sm font-medium text-green-600 dark:text-green-400" role="alert">
          Senha alterada com sucesso!
        </p>
      )}
    </form>
  )
}
