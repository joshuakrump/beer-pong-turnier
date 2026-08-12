import { createServerSupabaseClient } from "@/lib/supabase/server";

const phaseNames: Record<string, string> = {
  quarterfinal: "Viertelfinale",
  semifinal: "Halbfinale",
  third_place: "Spiel um Platz 3",
  final: "Finale",
};

export default async function FinalrundePage() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,show_knockout,current_phase")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!tournament || (!tournament.show_knockout && tournament.current_phase === "group")) {
    return <main className="content"><h1>Finalrunde</h1><p className="muted">Die Finalrunde ist noch nicht freigeschaltet.</p></main>;
  }

  const { data: matches = [] } = await supabase
    .from("matches")
    .select("id,phase,status,scheduled_at,table_number,team1_score,team2_score,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
    .eq("tournament_id", tournament.id)
    .neq("phase", "group")
    .order("sort_order");

  const phases = ["quarterfinal", "semifinal", "third_place", "final"];

  return (
    <main className="content">
      <div className="page-heading"><p className="eyebrow">K.-O.-PHASE</p><h1>Finalrunde</h1></div>
      <div className="knockout-grid">
        {phases.map((phase) => {
          const phaseMatches = (matches ?? []).filter((match: any) => match.phase === phase);
          if (!phaseMatches.length) return null;
          return <section className="ko-column" key={phase}><h2>{phaseNames[phase]}</h2>{phaseMatches.map((match: any) => <article className="match-card" key={match.id}><div className="match-meta"><span>Tisch {match.table_number || "–"}</span><span>{match.status === "live" ? "🔴 Live" : match.status === "finished" ? "Beendet" : "Geplant"}</span></div><div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong><b>{match.team1_score ?? "–"}</b></div><div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong><b>{match.team2_score ?? "–"}</b></div></article>)}</section>;
        })}
      </div>
    </main>
  );
}
