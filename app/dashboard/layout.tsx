"use client"

import type React from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed] = useState(true)

  return (
    <div className="min-h-svh bg-muted/30">
      <DashboardSidebar />
      <div className={cn("transition-all duration-300 pl-0", isCollapsed ? "md:pl-16" : "md:pl-64")}>
        <DashboardHeader />
        <main className="p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
