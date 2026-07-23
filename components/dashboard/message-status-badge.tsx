import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getMessageStatusStyle } from "@/lib/messages-utils"

interface MessageStatusBadgeProps {
  status: string
  errorMessage?: string | null
  className?: string
}

export function MessageStatusBadge({ status, errorMessage, className }: MessageStatusBadgeProps) {
  const config = getMessageStatusStyle(status)

  const badge = (
    <Badge className={`gap-1 text-xs ${config.className} ${className ?? ""}`} style={config.style}>
      {config.label}
    </Badge>
  )

  if (status === "failed" && errorMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help">{badge}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-md whitespace-pre-wrap text-xs">{errorMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
