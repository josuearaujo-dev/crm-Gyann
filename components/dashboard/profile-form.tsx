"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { Profile } from "@/lib/types"
import { Save } from "lucide-react"

interface ProfileFormProps {
  profile: Profile | null
  email: string
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [idMktzap, setIdMktzap] = useState(profile?.id_mktzap ?? "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, id_mktzap: idMktzap || null })
      .eq("id", profile?.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled className="bg-muted" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nome Completo</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="id_mktzap">ID MKTZAP</Label>
        <Input
          id="id_mktzap"
          value={idMktzap}
          onChange={(e) => setIdMktzap(e.target.value)}
          placeholder="Identificador na plataforma MKTZAP (opcional)"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Salvo com sucesso!</p>}
      <Button type="submit" disabled={isLoading}>
        <Save className="mr-2 h-4 w-4" />
        {isLoading ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  )
}
