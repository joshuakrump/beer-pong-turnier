import Link from "next/link";
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

export default async function Home() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,show_knockout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let liveMatches: any[] = [];
  let upcomingMatches: any[] = [];
  let teamCount = 0;
  let finishedCount = 0;

  if (tournament) {
    const [{ data: matchData }, { count }] = await Promise.all([
      supabase
        .from("matches")
        .select("id,phase,status,scheduled_at,table_number,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
        .eq("tournament_id", tournament.id)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id),
    ]);

    teamCount = count ?? 0;
    const visible = (matchData ?? []).filter((match: any) => tournament.show_knockout || match.phase === "group");
    liveMatches = visible.filter((match: any) => match.status === "live");
    upcomingMatches = visible.filter((match: any) => match.status === "scheduled").slice(0, 6);
    finishedCount = visible.filter((match: any) => match.status === "finished").length;
  }

  const MatchCard = ({ match, live = false }: { match: any; live?: boolean }) => (
    <article className={`match-card ${live ? "is-live" : ""}`}>
      <div className="match-meta">
        <span className={live ? "status-pill live" : "status-pill"}>{live ? "● LIVE" : phaseLabel(match.phase)}</span>
        <span>{live ? formatTime(match.scheduled_at) : formatTime(match.scheduled_at)}</span>
        <span className="table-pill">Tisch {match.table_number || "–"}</span>
      </div>
      <div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong></div>
      <div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong></div>
    </article>
  );

  return (
    <main className="page-shell">
      <section className="hero hero-panel">
        <div className="hero-copy">
          <div className="hero-status"><span className="pulse-dot" /> TURNIER LIVE</div>
          <p className="eyebrow">BEER PONG TOURNAMENT</p>
          <h1>{tournament?.name ?? "Turnier 2026"}</h1>
          <p className="lead">Alle Spiele, Live-Resultate und die aktuelle Rangliste – direkt auf deinem Handy.</p>
          <div className="hero-actions">
            <Link href="/spielplan" className="button-link">Spielplan öffnen <span>→</span></Link>
            <Link href="/tabelle" className="button-link secondary-link">Rangliste ansehen</Link>
          </div>
        </div>

        <div className="hero-stats" aria-label="Turnierübersicht">
          <div className="stat-card"><span>Teams</span><strong>{teamCount}</strong></div>
          <div className="stat-card"><span>Beendet</span><strong>{finishedCount}</strong></div>
          <div className="stat-card"><span>Live</span><strong>{liveMatches.length}</strong></div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div><p className="section-kicker">LIVE CENTER</p><h2>Jetzt läuft</h2></div>
          {liveMatches.length ? <span className="live-badge"><span className="pulse-dot" /> LIVE</span> : null}
        </div>
        {liveMatches.length ? <div className="card-grid">{liveMatches.map((match: any) => <MatchCard key={match.id} match={match} live />)}</div> : <div className="empty-card"><span className="empty-icon">◷</span><div><strong>Gerade läuft kein Spiel</strong><p>Die nächsten Begegnungen findest du direkt darunter.</p></div></div>}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div><p className="section-kicker">UP NEXT</p><h2>Als Nächstes</h2></div>
          <Link href="/spielplan" className="text-link">Alle Spiele <span>→</span></Link>
        </div>
        {upcomingMatches.length ? <div className="card-grid">{upcomingMatches.map((match: any) => <MatchCard key={match.id} match={match} />)}</div> : <div className="empty-card"><span className="empty-icon">＋</span><div><strong>Noch keine Spiele geplant</strong><p>Sobald die Turnierleitung Spiele anlegt, erscheinen sie hier automatisch.</p></div></div>}
      </section>
    </main>
  );
}
