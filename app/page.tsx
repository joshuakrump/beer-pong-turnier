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

export default async function Home() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,current_phase,show_knockout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let liveMatches: any[] = [];
  let upcomingMatches: any[] = [];

  if (tournament) {
    const { data } = await supabase
      .from("matches")
      .select("id,phase,status,scheduled_at,table_number,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
      .eq("tournament_id", tournament.id)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true });

    const visible = (data ?? []).filter((match: any) =>
      tournament.show_knockout || tournament.current_phase !== "group" ? true : match.phase === "group",
    );

    liveMatches = visible.filter((match: any) => match.status === "live");
    upcomingMatches = visible.filter((match: any) => match.status === "scheduled").slice(0, 6);
  }

  const MatchCard = ({ match, live = false }: { match: any; live?: boolean }) => (
    <article className={`match-card ${live ? "is-live" : ""}`}>
      <div className="match-meta">
        <span>{live ? "LIVE" : formatTime(match.scheduled_at)}</span>
        <span>Tisch {match.table_number || "–"}</span>
      </div>
      <div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong></div>
      <div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong></div>
    </article>
  );

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">BEER PONG</p>
        <h1>{tournament?.name ?? "Turnier 2026"}</h1>
        <p className="lead">Spielplan, aktuelle Spiele, Resultate und automatische Gruppenwertung an einem Ort.</p>
        <div className="hero-actions">
          <Link href="/spielplan" className="button-link">Zum Spielplan</Link>
          <Link href="/tabelle" className="button-link secondary-link">Zur Tabelle</Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading"><h2>Jetzt läuft</h2>{liveMatches.length ? <span className="live-badge">LIVE</span> : null}</div>
        {liveMatches.length ? <div className="card-grid">{liveMatches.map((match: any) => <MatchCard key={match.id} match={match} live />)}</div> : <div className="empty-card">Aktuell läuft noch kein Spiel.</div>}
      </section>

      <section className="home-section">
        <div className="section-heading"><h2>Als Nächstes</h2><Link href="/spielplan" className="muted">Alle Spiele →</Link></div>
        {upcomingMatches.length ? <div className="card-grid">{upcomingMatches.map((match: any) => <MatchCard key={match.id} match={match} />)}</div> : <div className="empty-card">Noch keine Spiele geplant.</div>}
      </section>
    </main>
  );
}
