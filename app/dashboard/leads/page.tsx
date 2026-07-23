import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/crm/leads-table";

export default async function LeadsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  // Buscar todos os leads (incluindo perdidos)
  const { data: leads } = await supabase
    .from("leads")
    .select(`
      *,
      loss_reason:loss_reasons(id, name)
    `)
    .eq("excluded_from_reports", false)
    .order("created_at", { ascending: false });

  // Buscar colunas do pipeline
  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("*")
    .order("position", { ascending: true });

  // Buscar fontes de leads
  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*")
    .order("created_at", { ascending: false });

  // Buscar motivos de perda
  const { data: lossReasons } = await supabase
    .from("loss_reasons")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Todos os Leads</h1>
        <p className="text-muted-foreground mt-1">
          Visualize e filtre todos os leads do sistema
        </p>
      </div>

      <LeadsTable
        leads={leads || []}
        columns={columns || []}
        sources={sources || []}
        lossReasons={lossReasons || []}
      />
    </div>
  );
}
