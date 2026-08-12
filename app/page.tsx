import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,current_phase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let liveMatches: any[] = [];
  if (tournament) {
    const { data } = await supabase
      .from("matches")
      .select("id,table_number,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
      .eq("tournament_id", tournament.id)
      .eq("status", "live")
      .order("sort_order");
    liveMatches = data ?? [];
  }

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
        <div className="section-heading"><h2>Jetzt läuft</h2><span className="live-badge">LIVE</span></div>
        {liveMatches.length ? <div className="card-grid">{liveMatches.map((match: any) => <article className="match-card is-live" key={match.id}><div className="match-meta"><span>Tisch {match.table_number || "–"}</span></div><div className="match-row"><strong>{match.team1?.name ?? "Noch offen"}</strong></div><div className="match-row"><strong>{match.team2?.name ?? "Noch offen"}</strong></div></article>)}</div> : <div className="empty-card">Aktuell läuft noch kein Spiel.</div>}
      </section>
    </main>
  );
}
