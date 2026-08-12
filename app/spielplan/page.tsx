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

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    group: "Gruppenphase",
    quarterfinal: "Viertelfinale",
    semifinal: "Halbfinale",
    third_place: "Platz 3",
    final: "Finale",
  };
  return labels[phase] ?? phase;
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
        <span className={match.status === "live" ? "status-pill live" : "status-pill"}>{match.status === "live" ? "● LIVE" : phaseLabel(match.phase)}</span>
        <span>{formatTime(match.scheduled_at)}</span>
        <span className="table-pill">Tisch {match.table_number || "–"}</span>
      </div>
      <div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong><b>{match.team1_score ?? "–"}</b></div>
      <div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong><b>{match.team2_score ?? "–"}</b></div>
    </article>
  );

  return (
    <main className="content">
      <div className="page-heading">
        <p className="eyebrow">MATCH CENTER</p>
        <h1>Spielplan</h1>
        <p className="muted">Live-Spiele, kommende Begegnungen und alle Resultate an einem Ort.</p>
      </div>

      {live.length > 0 ? <section>
        <div className="section-heading"><div><p className="section-kicker">LIVE</p><h2>Jetzt läuft</h2></div><span className="live-badge"><span className="pulse-dot" /> LIVE</span></div>
        <div className="card-grid">{live.map((m: any) => <MatchCard key={m.id} match={m} />)}</div>
      </section> : null}

      <section>
        <div className="section-heading"><div><p className="section-kicker">UP NEXT</p><h2>Nächste Spiele</h2></div><span className="muted">{upcoming.length} geplant</span></div>
        {upcoming.length ? <div className="card-grid">{upcoming.map((m: any) => <MatchCard key={m.id} match={m} />)}</div> : <div className="empty-card"><span className="empty-icon">◷</span><div><strong>Keine weiteren Spiele geplant</strong><p>Sobald ein neues Spiel angelegt wird, erscheint es hier automatisch.</p></div></div>}
      </section>

      <section>
        <div className="section-heading"><div><p className="section-kicker">RESULTS</p><h2>Resultate</h2></div><span className="muted">{finished.length} beendet</span></div>
        {finished.length ? <div className="card-grid">{finished.map((m: any) => <MatchCard key={m.id} match={m} />)}</div> : <div className="empty-card"><span className="empty-icon">✓</span><div><strong>Noch keine Resultate</strong><p>Beendete Spiele werden hier gesammelt.</p></div></div>}
      </section>
    </main>
  );
}
