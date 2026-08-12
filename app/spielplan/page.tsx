import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatTime(value: string | null) {
  if (!value) return "Zeit offen";
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(value));
}

export default async function SpielplanPage() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,show_knockout")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!tournament) return <main className="content"><h1>Noch kein Turnier</h1></main>;

  const { data: matches = [] } = await supabase
    .from("matches")
    .select("id,phase,status,scheduled_at,table_number,team1_score,team2_score,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
    .eq("tournament_id", tournament.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });

  const visible = (matches ?? []).filter((match: any) => tournament.show_knockout || match.phase === "group");
  const live = visible.filter((match: any) => match.status === "live");
  const upcoming = visible.filter((match: any) => match.status === "scheduled");
  const finished = visible.filter((match: any) => match.status === "finished").reverse();

  const MatchCard = ({ match }: { match: any }) => (
    <article className={`match-card ${match.status === "live" ? "is-live" : ""}`}>
      <div className="match-meta">
        <span>{match.phase === "group" ? "Gruppenphase" : match.phase}</span>
        <span>{formatTime(match.scheduled_at)}</span>
        <span>Tisch {match.table_number || "–"}</span>
      </div>
      <div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong><b>{match.team1_score ?? "–"}</b></div>
      <div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong><b>{match.team2_score ?? "–"}</b></div>
    </article>
  );

  return (
    <main className="content">
      <div className="page-heading"><p className="eyebrow">TURNIER</p><h1>Spielplan</h1></div>
      {live.length > 0 ? <section><h2>🔴 Jetzt läuft</h2><div className="card-grid">{live.map((m: any) => <MatchCard key={m.id} match={m} />)}</div></section> : null}
      <section><h2>Nächste Spiele</h2>{upcoming.length ? <div className="card-grid">{upcoming.map((m: any) => <MatchCard key={m.id} match={m} />)}</div> : <p className="muted">Aktuell sind keine weiteren Spiele geplant.</p>}</section>
      <section><h2>Resultate</h2>{finished.length ? <div className="card-grid">{finished.map((m: any) => <MatchCard key={m.id} match={m} />)}</div> : <p className="muted">Noch keine beendeten Spiele.</p>}</section>
    </main>
  );
}
