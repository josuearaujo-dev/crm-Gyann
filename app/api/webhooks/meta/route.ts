import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Verificacao do webhook pelo Meta
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const sourceId = searchParams.get("source");

  console.log("[v0] Meta webhook verification:", { mode, sourceId, tokenReceived: !!token });

  const supabase = createAdminClient();

  // Salvar log da requisição
  const queryParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let statusCode = 200;
  let response: any = { success: true };

  if (!sourceId) {
    statusCode = 400;
    response = { error: "Source ID is required" };
    
    await supabase.from("webhook_logs").insert({
      source_id: null,
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

  // Verificar o token na tabela lead_sources
  const { data: source, error } = await supabase
    .from("lead_sources")
    .select("webhook_token")
    .eq("id", sourceId)
    .single();

  if (error || !source) {
    console.error("[v0] Source not found:", sourceId);
    statusCode = 404;
    response = { error: "Invalid source" };
  } else if (mode === "subscribe" && token === source.webhook_token) {
    console.log("[v0] Webhook verified successfully");
    statusCode = 200;
    response = { verified: true, challenge };
  } else {
    console.error("[v0] Token mismatch");
    statusCode = 403;
    response = { error: "Verification failed" };
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

  if (statusCode === 200 && mode === "subscribe") {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(response, { status: statusCode });
}

// Receber leads do Meta
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  let sourceId: string | null = null;
  let body: any = null;
  let statusCode = 200;
  let response: any = {};

  try {
    sourceId = request.nextUrl.searchParams.get("source");
    body = await request.json();

    // Buscar a fonte
    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .select("user_id, default_column_id")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: "Invalid source" }, { status: 404 });
    }

    // Processar leads do Meta Lead Ads
    const entries = body.entry || [];
    const createdLeads = [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      
      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadData = change.value;
          
          // Extrair campos do lead do Meta
          const fieldData = leadData.field_data || [];
          const leadFields: Record<string, string> = {};
          
          for (const field of fieldData) {
            const name = field.name?.toLowerCase();
            const values = field.values || [];
            if (name && values.length > 0) {
              leadFields[name] = values[0];
            }
          }

          // Mapear campos comuns
          const name = leadFields.full_name || 
                       leadFields.name || 
                       `${leadFields.first_name || ""} ${leadFields.last_name || ""}`.trim() ||
                       "Lead Meta";
          const email = leadFields.email || "";
          const phone = leadFields.phone_number || leadFields.phone || "";

          if (email) {
            const { data: lead, error: leadError } = await supabase
              .from("leads")
              .insert({
                name,
                email,
                phone: phone || null,
                source_id: sourceId,
                column_id: source.default_column_id,
                user_id: source.user_id,
              })
              .select()
              .single();

            if (!leadError && lead) {
              createdLeads.push(lead);
            }
          }
        }
      }
    }

    statusCode = 201;
    response = { 
      success: true, 
      created: createdLeads.length,
      leads: createdLeads 
    };

    // Salvar log de sucesso
    await supabase.from("webhook_logs").insert({
      source_id: sourceId,
      method: "POST",
      url: request.url,
      headers: request.headers,
      query_params: request.nextUrl.searchParams,
      body,
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent") || null,
      status_code: statusCode,
      response,
    });

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("Meta webhook error:", error);
    statusCode = 500;
    response = { error: "Internal server error", details: String(error) };

    // Salvar log de erro
    try {
      await supabase.from("webhook_logs").insert({
        source_id: sourceId,
        method: "POST",
        url: request.url,
        headers: request.headers,
        query_params: request.nextUrl.searchParams,
        body,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent") || null,
        status_code: statusCode,
        response,
      });
    } catch (logError) {
      console.error("Failed to log webhook error:", logError);
    }

    return NextResponse.json(response, { status: statusCode });
  }
}
