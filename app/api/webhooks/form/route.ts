import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  let sourceId: string | null = null;
  let body: any = null;
  let statusCode = 200;
  let response: any = {};
  let headers: Record<string, string> = {};
  let queryParams: Record<string, string> = {};

  try {
    sourceId = request.nextUrl.searchParams.get("source");
    body = await request.json();

    console.log("[v0] Webhook form received:", { sourceId, body });

    // Capturar headers e query params para log
    request.nextUrl.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    if (!sourceId) {
      statusCode = 400;
      response = { error: "Source ID is required" };

      await supabase.from("webhook_logs").insert({
        source_id: null,
        method: "POST",
        url: request.url,
        headers,
        query_params: queryParams,
        body,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent") || null,
        status_code: statusCode,
        response,
      });

      return NextResponse.json(response, { status: statusCode });
    }

    // Extrair dados de forma flexível - aceitar múltiplas variações de nomes de campos
    const findField = (obj: any, possibleNames: string[]): string | undefined => {
      for (const key of Object.keys(obj)) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
        for (const name of possibleNames) {
          if (normalizedKey === name.toLowerCase().replace(/[^a-z]/g, '')) {
            return obj[key];
          }
        }
      }
      return undefined;
    };

    const name = findField(body, ['name', 'Name', 'full_name', 'fullname', 'Full Name']);
    const email = findField(body, ['email', 'Email', 'E-mail', 'e-mail', 'emailaddress']);
    const phone = findField(body, ['phone', 'Phone', 'telephone', 'Telephone', 'tel']);
    const company = findField(body, ['company', 'Company', 'Company Name', 'companyname']);

    console.log("[v0] Extracted fields:", { name, email, phone, company });

    if (!name || !email) {
      statusCode = 400;
      response = { 
        error: "Name and email are required",
        received: { name: !!name, email: !!email },
        bodyKeys: Object.keys(body),
        body
      };

      await supabase.from("webhook_logs").insert({
        source_id: sourceId,
        method: "POST",
        url: request.url,
        headers,
        query_params: queryParams,
        body,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent") || null,
        status_code: statusCode,
        response,
      });

      return NextResponse.json(response, { status: statusCode });
    }

    // Buscar a fonte para obter o created_by (user)
    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .select("created_by")
      .eq("id", sourceId)
      .single();

    // Se a fonte não for encontrada, ainda retornar 200 mas registrar o aviso
    let assignedTo: string | null = null;
    if (sourceError || !source) {
      console.warn("[v0] Source not found, creating lead without assignment:", sourceError);
      assignedTo = null;
    } else {
      assignedTo = source.created_by;
    }

    // Buscar a primeira coluna do pipeline como padrão
    const { data: defaultColumn } = await supabase
      .from("pipeline_columns")
      .select("id")
      .order("position", { ascending: true })
      .limit(1)
      .single();

    console.log("[v0] Creating lead with:", { name, email, phone, company, source_id: sourceId, assigned_to: assignedTo, column_id: defaultColumn?.id });

    // Criar o lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone: phone || null,
        company: company || null,
        source_id: sourceId,
        column_id: defaultColumn?.id || null,
        assigned_to: assignedTo,
      })
      .select()
      .single();

    if (leadError) {
      console.error("[v0] Error creating lead:", leadError);
      // Mesmo com erro, retornar 200 para o n8n continuar o fluxo
      statusCode = 200;
      response = { success: false, error: "Failed to create lead", details: leadError.message, received: { name, email, phone, company } };
    } else {
      console.log("[v0] Lead created successfully:", lead?.id);
      statusCode = 200;
      response = { success: true, lead };
    }

    // Salvar log
    await supabase.from("webhook_logs").insert({
      source_id: sourceId,
      method: "POST",
      url: request.url,
      headers,
      query_params: queryParams,
      body,
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent") || null,
      status_code: statusCode,
      response,
    });

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("[v0] Webhook error:", error);
    statusCode = 500;
    response = { error: "Internal server error", details: String(error) };

    // Salvar log de erro
    try {
      await supabase.from("webhook_logs").insert({
        source_id: sourceId,
        method: "POST",
        url: request.url,
        headers,
        query_params: queryParams,
        body,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent") || null,
        status_code: statusCode,
        response,
      });
    } catch (logError) {
      console.error("[v0] Failed to log webhook error:", logError);
    }

    return NextResponse.json(response, { status: statusCode });
  }
}

// Suporte para GET (verificacao do webhook)
export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get("source");
  const supabase = createAdminClient();

  const queryParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  let statusCode = 200;
  let response: any = {};

  if (!sourceId) {
    statusCode = 400;
    response = { error: "Source ID is required" };
  } else {
    response = { 
      status: "active",
      message: "Webhook is ready to receive leads",
      source: sourceId
    };
  }

  // Salvar log
  await supabase.from("webhook_logs").insert({
    source_id: sourceId || null,
    method: "GET",
    url: request.url,
    headers,
    query_params: queryParams,
    body: null,
    ip_address: request.ip || null,
    user_agent: request.headers.get("user-agent") || null,
    status_code: statusCode,
    response,
  });

  return NextResponse.json(response, { status: statusCode });
}
