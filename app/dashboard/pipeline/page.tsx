import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/crm/pipeline-board";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("*")
    .order("position", { ascending: true });

  const { data: leads } = await supabase
    .from("leads")
    .select("*, lead_sources(name, type), lead_tags(tags(*)), us_states(name, abbreviation), nationalities(country, nationality)")
    .neq("is_lost", true)
    .eq("is_finished", false)
    .eq("excluded_from_reports", false)
    .order("created_at", { ascending: false });

  const { data: tags } = await supabase
    .from("tags")
    .select("*");

  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*")
    .order("name", { ascending: true });

  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Carregando pipeline…</div>}>
      <PipelineBoard
        initialColumns={columns || []}
        initialLeads={leads || []}
        tags={tags || []}
        sources={sources || []}
        userId={user?.id || ""}
      />
    </Suspense>
  );
}
