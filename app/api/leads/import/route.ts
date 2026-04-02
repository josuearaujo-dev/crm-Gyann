import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const leads = Array.isArray(body) ? body : [body];

    console.log(`[v0] Importing ${leads.length} leads...`);

    // Buscar dados de referência para substituir placeholders
    const { data: sources } = await supabase
      .from("lead_sources")
      .select("id, name")
      .order("created_at", { ascending: false });

    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("created_at", { ascending: false });

    const { data: states } = await supabase
      .from("us_states")
      .select("id, name, abbreviation");

    const { data: nationalities } = await supabase
      .from("nationalities")
      .select("id, nationality, country");

    const { data: columns } = await supabase
      .from("pipeline_columns")
      .select("id, name")
      .order("position", { ascending: true });

    // Valores padrão
    const defaultSource = sources?.[0]?.id || null;
    const defaultUser = users?.[0]?.id || null;
    const defaultColumn = columns?.[0]?.id || "87f7c397-8c2d-49ae-838d-d71cc1690c03";

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const lead of leads) {
      try {
        // Limpar e validar dados
        const cleanedLead: any = {
          name: lead.name?.trim(),
          email: lead.email?.trim()?.toLowerCase() || null,
          phone: lead.phone?.trim() || null,
          company: lead.company?.trim() || null,
          deal_value: parseFloat(lead.deal_value) || 0,
          position: lead.position || 0,
          is_lost: lead.is_lost || false,
          loss_reason_id: lead.loss_reason_id || null,
          loss_notes: lead.loss_notes || null,
          lost_at: lead.lost_at || null,
          metadata: lead.metadata || {},
        };

        // Substituir placeholders
        if (lead.source_id === "uuid-da-fonte-de-leads" || !lead.source_id) {
          cleanedLead.source_id = defaultSource;
        } else {
          cleanedLead.source_id = lead.source_id;
        }

        if (lead.assigned_to === "uuid-do-usuario-responsavel" || !lead.assigned_to) {
          cleanedLead.assigned_to = defaultUser;
        } else {
          cleanedLead.assigned_to = lead.assigned_to;
        }

        if (lead.column_id === "uuid-da-coluna-do-pipeline" || !lead.column_id) {
          cleanedLead.column_id = defaultColumn;
        } else {
          cleanedLead.column_id = lead.column_id;
        }

        // State (tentar mapear por nome ou abbreviation se for string)
        if (lead.state_id && lead.state_id !== "uuid-do-estado") {
          if (lead.state_id.includes("-")) {
            // É um UUID válido
            cleanedLead.state_id = lead.state_id;
          } else if (states) {
            // Tentar encontrar por nome ou abbreviation
            const foundState = states.find(
              (s: any) => 
                s.name?.toLowerCase() === lead.state_id?.toLowerCase() || 
                s.abbreviation?.toLowerCase() === lead.state_id?.toLowerCase()
            );
            cleanedLead.state_id = foundState?.id || null;
          }
        }

        // Nationality (opcional)
        if (lead.nationality_id && lead.nationality_id !== "uuid-da-nacionalidade") {
          cleanedLead.nationality_id = lead.nationality_id;
        }

        // Validação mínima
        if (!cleanedLead.name) {
          results.failed++;
          results.errors.push({
            lead: lead,
            error: "Nome é obrigatório",
          });
          continue;
        }

        // Verificar duplicatas por email
        if (cleanedLead.email) {
          const { data: existing } = await supabase
            .from("leads")
            .select("id, name")
            .eq("email", cleanedLead.email)
            .limit(1);

          if (existing && existing.length > 0) {
            console.log(`[v0] Lead duplicado (email): ${cleanedLead.email} - Pulando`);
            results.failed++;
            results.errors.push({
              lead: lead,
              error: `Lead já existe com email ${cleanedLead.email}`,
              existing: existing,
            });
            continue;
          }
        }

        // Inserir lead
        const { error: insertError } = await supabase
          .from("leads")
          .insert(cleanedLead);

        if (insertError) {
          console.error(`[v0] Erro ao inserir lead ${cleanedLead.name}:`, insertError);
          results.failed++;
          results.errors.push({
            lead: lead,
            error: insertError.message,
          });
        } else {
          console.log(`[v0] Lead importado: ${cleanedLead.name}`);
          results.success++;
        }
      } catch (err: any) {
        console.error(`[v0] Erro ao processar lead:`, err);
        results.failed++;
        results.errors.push({
          lead: lead,
          error: err.message,
        });
      }
    }

    console.log(`[v0] Importação concluída: ${results.success} sucesso, ${results.failed} falhas`);

    return NextResponse.json(
      {
        success: true,
        message: `Importação concluída: ${results.success} leads importados, ${results.failed} falharam`,
        results,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[v0] Erro na importação:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
