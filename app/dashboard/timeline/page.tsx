import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgendaContainer } from "@/components/crm/agenda-container";

export default async function TimelinePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, leads(name, email, company)")
    .eq("assigned_to", user.id)
    .order("due_date", { ascending: true, nullsLast: true })
    .order("scheduled_at", { ascending: true, nullsLast: true })
    .order("start_time", { ascending: true, nullsLast: true });

  // Remover duplicatas baseado no ID
  const uniqueTasks = tasks?.filter((task, index, self) => 
    index === self.findIndex((t) => t.id === task.id)
  ) || [];

  return (
    <AgendaContainer
      initialTasks={uniqueTasks}
      userId={user.id}
    />
  );
}
