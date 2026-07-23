"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LayoutDashboard, MessageSquare, Settings, History, LogOut, Shield, ChevronLeft, Megaphone, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import Image from "next/image"

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/messages", label: "API WhatsApp", icon: MessageSquare },
  { href: "/dashboard/mktzap", label: "MKTZAP", icon: Megaphone },
  { href: "/dashboard/mktzap-logs", label: "Logs MKTZAP", icon: FileText },
  { href: "/dashboard/api-logs", label: "Logs API Cliente", icon: FileText },
  { href: "/dashboard/history", label: "Histórico", icon: History },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  const isExpanded = !desktopCollapsed || isHovered

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("is_super_admin, role").eq("id", user.id).single()
        setIsSuperAdmin(profile?.is_super_admin || false)
        setRole(profile?.role || null)
      }
    }
    checkAdmin()
  }, [])

  const visibleMenuItems = menuItems

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-lg bg-white/80 shadow-md backdrop-blur-sm md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <div className="relative h-5 w-5">
          <span
            className={cn(
              "absolute left-0 top-0.5 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-out",
              mobileOpen && "top-2 rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-2 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-out",
              mobileOpen && "opacity-0 translate-x-2",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-3.5 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-out",
              mobileOpen && "top-2 -rotate-45",
            )}
          />
        </div>
      </Button>

      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-all duration-300 md:hidden",
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible",
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar",
          "transition-all duration-300 ease-in-out",
          // Mobile styles
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "w-64",
          // Desktop styles
          "md:translate-x-0",
          isExpanded ? "md:w-64" : "md:w-[68px]",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
            isExpanded ? "justify-between px-5" : "justify-center px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 overflow-hidden transition-all duration-300",
              isExpanded ? "w-auto opacity-100" : "md:w-0 md:opacity-0",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden">
              <Image
                src="/logo-manage-notify.png"
                alt="Manage Notify"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="whitespace-nowrap text-base font-semibold text-sidebar-foreground">Manage Notify</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden md:flex h-8 w-8 shrink-0 rounded-lg hover:bg-sidebar-accent transition-all duration-200",
              !isExpanded && "absolute left-1/2 -translate-x-1/2",
            )}
            onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 text-sidebar-foreground/70 transition-transform duration-300 opacity-0",
                desktopCollapsed && "rotate-180",
              )}
            />
          </Button>

          {!isExpanded && (
            <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
              <Image
                src="/logo-manage-notify.png"
                alt="Manage Notify"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-hidden p-3">
          <div className="space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    !isExpanded && "md:justify-center md:px-0",
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      "group-hover:scale-110",
                      isActive && "text-primary",
                    )}
                  />

                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isExpanded
                        ? "opacity-100 translate-x-0"
                        : "md:opacity-0 md:-translate-x-2 md:absolute md:invisible",
                    )}
                  >
                    {item.label}
                  </span>

                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200" />
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {isSuperAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                "transition-all duration-200 ease-out",
                !isExpanded && "md:justify-center md:px-0",
              )}
              title={!isExpanded ? "Painel Admin" : undefined}
            >
              <Shield className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  isExpanded ? "opacity-100 translate-x-0" : "md:opacity-0 md:-translate-x-2 md:absolute md:invisible",
                )}
              >
                Painel Admin
              </span>
            </Link>
          )}

          <Button
            variant="ghost"
            className={cn(
              "group w-full gap-3 rounded-lg px-3 py-2.5 text-sm font-medium h-auto",
              "text-sidebar-foreground/80 hover:bg-red-50 hover:text-red-600",
              "transition-all duration-200 ease-out",
              isExpanded ? "justify-start" : "md:justify-center md:px-0",
            )}
            onClick={handleLogout}
            title={!isExpanded ? "Sair" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300",
                isExpanded ? "opacity-100 translate-x-0" : "md:opacity-0 md:-translate-x-2 md:absolute md:invisible",
              )}
            >
              Sair
            </span>
          </Button>
        </div>
      </aside>
    </>
  )
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(true)
  return { collapsed, setCollapsed }
}
