"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function DashboardHeader() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const initials =
    user?.user_metadata?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    user?.email?.slice(0, 2).toUpperCase() ||
    "U"

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 pl-14 md:px-6 md:pl-6">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium truncate max-w-[120px] sm:max-w-none">
            {user?.user_metadata?.full_name || user?.email}
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user?.user_metadata?.company_name || "Tenant"}
          </p>
        </div>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
