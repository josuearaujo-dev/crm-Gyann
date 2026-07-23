import type React from "react"

interface MarkdownContentProps {
  content: string
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "hr" }

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    return <span key={index}>{part}</span>
  })
}

function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index++
      continue
    }

    if (line.trim() === "---") {
      blocks.push({ type: "hr" })
      index++
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      index++
      continue
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      index++

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index])
        index++
      }

      blocks.push({ type: "code", language, code: codeLines.join("\n") })
      index++
      continue
    }

    if (line.includes("|") && lines[index + 1]?.includes("---")) {
      const headers = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
      index += 2

      const rows: string[][] = []
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(
          lines[index]
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean),
        )
        index++
      }

      blocks.push({ type: "table", headers, rows })
      continue
    }

    if (line.startsWith("- ")) {
      const items: string[] = []
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim())
        index++
      }
      blocks.push({ type: "list", items })
      continue
    }

    const orderedListMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedListMatch) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, "").trim())
        index++
      }
      blocks.push({ type: "list", items, ordered: true })
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("#") &&
      !lines[index].startsWith("```") &&
      !lines[index].startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[index]) &&
      lines[index].trim() !== "---" &&
      !(lines[index].includes("|") && lines[index + 1]?.includes("---"))
    ) {
      paragraphLines.push(lines[index])
      index++
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") })
    }
  }

  return blocks
}

function headingClass(level: number): string {
  if (level === 1) return "text-3xl font-bold tracking-tight"
  if (level === 2) return "mt-10 text-2xl font-semibold tracking-tight border-b pb-2"
  if (level === 3) return "mt-8 text-xl font-semibold"
  if (level === 4) return "mt-6 text-lg font-semibold"
  return "mt-4 text-base font-semibold"
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const blocks = parseMarkdown(content)

  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className = headingClass(block.level)
          if (block.level === 1) {
            return (
              <h1 key={index} className={className}>
                {parseInline(block.text)}
              </h1>
            )
          }
          if (block.level === 2) {
            return (
              <h2 key={index} className={className}>
                {parseInline(block.text)}
              </h2>
            )
          }
          if (block.level === 3) {
            return (
              <h3 key={index} className={className}>
                {parseInline(block.text)}
              </h3>
            )
          }
          if (block.level === 4) {
            return (
              <h4 key={index} className={className}>
                {parseInline(block.text)}
              </h4>
            )
          }
          return (
            <h5 key={index} className={className}>
              {parseInline(block.text)}
            </h5>
          )
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-muted-foreground">
              {parseInline(block.text)}
            </p>
          )
        }

        if (block.type === "code") {
          return (
            <div key={index} className="overflow-hidden rounded-lg border bg-slate-950 text-slate-50">
              {block.language && (
                <div className="border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-400">
                  {block.language}
                </div>
              )}
              <pre className="overflow-x-auto p-4 text-sm leading-6">
                <code>{block.code}</code>
              </pre>
            </div>
          )
        }

        if (block.type === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {block.headers.map((header) => (
                      <th key={header} className="px-4 py-3 font-semibold">
                        {parseInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3 align-top text-muted-foreground">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul"
          const listClass = block.ordered
            ? "list-decimal space-y-2 pl-6 text-muted-foreground"
            : "list-disc space-y-2 pl-6 text-muted-foreground"

          return (
            <ListTag key={index} className={listClass}>
              {block.items.map((item) => (
                <li key={item}>{parseInline(item)}</li>
              ))}
            </ListTag>
          )
        }

        return <hr key={index} className="my-8 border-border" />
      })}
    </div>
  )
}
