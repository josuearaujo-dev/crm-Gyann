import type { Metadata } from "next"
import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { MarkdownContent } from "@/components/docs/markdown-content"
import { getAppBaseUrl } from "@/lib/docs/get-app-base-url"
import { loadApiClienteDoc } from "@/lib/docs/load-api-cliente-doc"

export const metadata: Metadata = {
  title: "Documentação da API | Manage Notify",
  description: "Guia de integração para envio de mensagens WhatsApp via API",
}

export default async function ApiClienteDocsPage() {
  const baseUrl = await getAppBaseUrl()
  const content = loadApiClienteDoc(baseUrl)

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold leading-none">Manage Notify</p>
              <p className="text-xs text-muted-foreground">API de mensagens WhatsApp</p>
            </div>
          </div>
          <div className="hidden sm:block rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
            {baseUrl}/api/v1
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-8 rounded-xl border bg-muted/20 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            URL base desta instalação:{" "}
            <code className="rounded bg-background px-2 py-1 font-mono text-xs text-foreground">{baseUrl}/api/v1</code>
          </p>
        </div>

        <MarkdownContent content={content} />

        <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          <p>
            Precisa de credenciais de acesso? Solicite ao administrador da sua empresa ou acesse{" "}
            <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
              o painel
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  )
}
