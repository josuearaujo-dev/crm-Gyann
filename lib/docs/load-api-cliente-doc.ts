import { readFileSync } from "fs"
import { join } from "path"

export function loadApiClienteDoc(baseUrl: string): string {
  const filePath = join(process.cwd(), "docs", "api-cliente.md")
  const content = readFileSync(filePath, "utf8")

  return content.replaceAll("https://seu-dominio.com", baseUrl)
}
