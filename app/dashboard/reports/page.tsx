import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsDashboard } from "@/components/crm/reports-dashboard";

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  // Leads com suas tags (para identificar qualificados)
  const { data: leads } = await supabase
    .from("leads")
    .select("*, lead_tags(tags(id, name, color))")
    .order("created_at", { ascending: false });

  // Colunas do pipeline
  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("*")
    .order("position", { ascending: true });

  // Fontes de leads
  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*")
    .order("created_at", { ascending: false });

  // Reuniões marcadas (para calcular calls / custo por call)
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_at", { ascending: false });

  // Campanhas cadastradas
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">
          Análise de performance por campanha — leads qualificados, custos e conversão
        </p>
      </div>

      <ReportsDashboard
        leads={leads || []}
        columns={columns || []}
        sources={sources || []}
        meetings={meetings || []}
        initialCampaigns={campaigns || []}
        userId={user.id}
      />
    </div>
  );
}
