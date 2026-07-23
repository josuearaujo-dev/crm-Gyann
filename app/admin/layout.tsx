"use client"

import type React from "react"
import { createClient } from "../../lib/supabase/client"
import { useRouter } from "next/navigation"
import { AdminSidebar } from "../../components/admin/sidebar"
import { AdminHeader } from "../../components/admin/header"
import { useState, useEffect } from "react"
import { cn } from "../../lib/utils"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        router.push("/auth/login")
        return
      }

      const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

      if (!profile?.is_super_admin) {
        router.push("/dashboard")
        return
      }

      setIsLoading(false)
    }
    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AdminSidebar />
      <div className={cn("transition-all duration-300", isCollapsed ? "md:pl-16" : "md:pl-64")}>
        <AdminHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
