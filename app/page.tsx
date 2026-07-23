import { Button } from "@/components/ui/button"
import { MessageSquare, Zap, Shield, BarChart3 } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/auth/login")

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WhatsApp API</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Envie mensagens do WhatsApp
            <br />
            <span className="text-primary">de forma automatizada</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Sistema multi-tenant para integração com a API oficial do WhatsApp Business. Conecte seus dados, configure
            templates e envie mensagens em escala.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">Começar Agora</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">Recursos do Sistema</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Integração Rápida</h3>
                <p className="mt-2 text-muted-foreground">Conecte sua API de dados e envie mensagens em minutos</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Multi-tenant Seguro</h3>
                <p className="mt-2 text-muted-foreground">Cada empresa tem seus dados isolados com segurança total</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Monitoramento</h3>
                <p className="mt-2 text-muted-foreground">Acompanhe status de entrega e leitura das mensagens</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>WhatsApp API Multi-tenant System</p>
        </div>
      </footer>
    </div>
  )
}
