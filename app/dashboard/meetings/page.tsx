import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MeetingsAgendaContainer } from "@/components/crm/meetings-agenda-container";

export default async function MeetingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, leads(name, email, company)")
    .order("scheduled_at", { ascending: false });

  return (
    <MeetingsAgendaContainer
      initialMeetings={meetings || []}
      userId={user.id}
    />
  );
}
