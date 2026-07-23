import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { apiCredentialId, startDate, endDate } = body

    if (!apiCredentialId || !startDate || !endDate) {
      return NextResponse.json({ error: "Parâmetros obrigatórios não fornecidos" }, { status: 400 })
    }

    // Get API credentials
    const { data: credentials, error: credError } = await supabase
      .from("api_credentials")
      .select("*")
      .eq("id", apiCredentialId)
      .single()

    if (credError || !credentials) {
      const reason = credError
        ? `Supabase: ${credError.message} (code: ${credError.code})`
        : "nenhum registro de api_credentials com o id informado"
      console.log("[fetch-data] Credenciais não encontradas:", reason, { apiCredentialId })
      return NextResponse.json({ error: "Credenciais não encontradas" }, { status: 404 })
    }

    // Make request to external API with Basic Auth
    const authHeader = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")

    const apiUrl = new URL(credentials.base_url)
    // Format dates as YYYY-MM-DD for the API
    apiUrl.searchParams.set("dataInicio", startDate)
    apiUrl.searchParams.set("dataFim", endDate)

    console.log("[v0] Fetching from URL:", apiUrl.toString())

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    console.log("[v0] API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      const isHtml = errorText.trim().toLowerCase().startsWith("<!") || errorText.includes("<html")
      const shortMessage = isHtml
        ? `A API externa retornou erro ${response.status} (resposta em HTML). Verifique a URL, credenciais e o período.`
        : errorText.length > 300
          ? `A API externa retornou erro ${response.status}: ${errorText.slice(0, 300)}...`
          : `Erro na API externa: ${response.status} - ${errorText}`
      console.log("[fetch-data] API externa falhou:", response.status, isHtml ? "(resposta HTML)" : errorText.slice(0, 500))
      return NextResponse.json({ error: shortMessage }, { status: 502 })
    }

    const contentType = response.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")
    let data: unknown
    if (isJson) {
      data = await response.json()
    } else {
      const text = await response.text()
      console.log("[fetch-data] Resposta não é JSON:", text.slice(0, 200))
      return NextResponse.json(
        { error: "A API externa não retornou JSON. Verifique a URL da API." },
        { status: 502 },
      )
    }
    console.log("[fetch-data] API raw response (pretty):\n", JSON.stringify(data, null, 2))

    // Ensure data is an array and has required fields
    const obj = data as Record<string, unknown>
    const records = Array.isArray(data) ? data : obj?.records || obj?.data || obj?.result || []

    console.log("[fetch-data] Total records before processing:", Array.isArray(records) ? records.length : 0)
    if (Array.isArray(records) && records.length > 0) {
      const first = records[0] as Record<string, unknown>
      console.log("[fetch-data] Keys in first record:", Object.keys(first))
      if (Array.isArray(first.servicosFile)) {
        console.log("[fetch-data] servicosFile count in first record:", first.servicosFile.length)
      }
    }

    // Flatten servicosFile when present and normalize fields for UI filters/grid.
    const processedRecords = records.flatMap((record: Record<string, unknown>, index: number) => {
      const basePhone = record.phone || record.telefone || record.celular || record.whatsapp || record.fone || record.cel || ""
      const servicosFile = Array.isArray(record.servicosFile) ? (record.servicosFile as Record<string, unknown>[]) : []

      if (servicosFile.length === 0) {
        return [{
          id: record.id || record.ID || record.codigo || `record-${index}`,
          phone: basePhone,
          categoriaServico: record.categoriaServico || record.tipoServico || record.idTipoServico || "",
          parametro: record.parametro || record.parametroServico || "",
          parametroServico: record.parametroServico || record.parametro || "",
          ...record,
        }]
      }

      return servicosFile.map((servico, serviceIndex) => {
        const categoriaServico = servico.categoriaServico || servico.tipoServico || servico.idTipoServico || record.categoriaServico || record.tipoServico || record.idTipoServico || ""
        const parametro = servico.parametro || servico.parametroServico || record.parametro || record.parametroServico || ""
        const idPaxServico = servico.idPaxServico || servico.idServicoReceptivo || servico.id || record.idPaxServico || record.id || record.ID || `${index}-${serviceIndex}`

        return {
          id: idPaxServico,
          idPaxServico,
          phone: basePhone,
          servico: servico.nome || servico.servico || record.servico || record.nome || "",
          categoriaServico,
          tipoServico: categoriaServico,
          parametro,
          parametroServico: parametro,
          voo: servico.voo || record.voo || "",
          dataPickup: servico.dataInicioServico || record.dataPickup || record.dataInicioServico || "",
          horaServico: servico.horaServicoVoo || servico.horaServico || record.horaServico || "",
          ...record,
          ...servico,
        }
      })
    })

    console.log("[fetch-data] Total records after processing:", processedRecords.length)
    if (processedRecords.length > 0) {
      console.log("[fetch-data] First processed record:\n", JSON.stringify(processedRecords[0], null, 2))
    }

    return NextResponse.json({ data: processedRecords })
  } catch (error) {
    console.error("[v0] Error fetching data:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 })
  }
}
