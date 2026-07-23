import type { WhatsAppErrorDetails } from "@/lib/whatsapp-errors"

interface WhatsAppErrorDetailsProps {
  errorMessage?: string | null
  errorDetails?: Record<string, unknown> | WhatsAppErrorDetails | null
  className?: string
}

function readDetail(details: Record<string, unknown>, key: string): string | null {
  const value = details[key]
  if (value == null || value === "") return null
  return String(value)
}

export function WhatsAppErrorDetailsView({
  errorMessage,
  errorDetails,
  className = "",
}: WhatsAppErrorDetailsProps) {
  const details = (errorDetails || {}) as Record<string, unknown>
  const title = readDetail(details, "title")
  const message = readDetail(details, "message") || errorMessage
  const code = readDetail(details, "code")
  const errorSubcode = readDetail(details, "errorSubcode")
  const type = readDetail(details, "type")
  const fbtraceId = readDetail(details, "fbtraceId")
  const httpStatus = readDetail(details, "httpStatus")
  const rawResponse = details.rawResponse

  if (!message && !title && !code && !rawResponse) {
    return <p className={`text-xs text-muted-foreground ${className}`}>Sem detalhes do erro.</p>
  }

  return (
    <div className={`space-y-2 text-xs ${className}`}>
      {title && (
        <p>
          <span className="font-medium text-foreground">Título Meta:</span> {title}
        </p>
      )}
      {message && (
        <p className="whitespace-pre-wrap text-destructive">
          <span className="font-medium">Mensagem:</span> {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-muted-foreground">
        {code && <span>Código: {code}</span>}
        {errorSubcode && <span>Subcódigo: {errorSubcode}</span>}
        {type && <span>Tipo: {type}</span>}
        {httpStatus && <span>HTTP: {httpStatus}</span>}
        {fbtraceId && <span className="break-all">Trace: {fbtraceId}</span>}
      </div>
      {rawResponse != null && (
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-5">
          {JSON.stringify(rawResponse, null, 2)}
        </pre>
      )}
    </div>
  )
}
