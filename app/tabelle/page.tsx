import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateStandings } from "@/lib/standings";

export default async function TabellePage() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!tournament) return <main className="content"><h1>Noch kein Turnier</h1></main>;

  const [{ data: groups = [] }, { data: teams = [] }, { data: matches = [] }] = await Promise.all([
    supabase.from("groups").select("id,name,sort_order").eq("tournament_id", tournament.id).order("sort_order"),
    supabase.from("teams").select("id,name,group_id,manual_rank_override").eq("tournament_id", tournament.id),
    supabase.from("matches").select("id,group_id,phase,team1_id,team2_id,team1_score,team2_score,status").eq("tournament_id", tournament.id),
  ]);

  return (
    <main className="content">
      <div className="page-heading">
        <p className="eyebrow">STANDINGS</p>
        <h1>Rangliste</h1>
        <p className="muted">Sieg 2 Punkte · Unentschieden 1 Punkt · Niederlage 0 Punkte. Die ersten vier Teams jeder Gruppe ziehen ins Viertelfinale ein.</p>
      </div>

      <div className="standings-grid">
        {(groups ?? []).map((group: any) => {
          const groupTeams = (teams ?? []).filter((team: any) => team.group_id === group.id);
          const groupMatches = (matches ?? []).filter((match: any) => match.group_id === group.id);
          const rows = calculateStandings(groupTeams, groupMatches);
          const playedGames = groupMatches.filter((match: any) => match.status === "finished").length;

          return (
            <section className="table-card" key={group.id}>
              <div className="table-card-heading">
                <div><p className="section-kicker">GRUPPE</p><h2>{group.name}</h2></div>
                <span className="table-summary">{playedGames} Spiele beendet</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>#</th><th>Team</th><th>Sp.</th><th>S</th><th>U</th><th>N</th><th>Becher</th><th>Diff.</th><th>Pkt.</th></tr></thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.teamId} className={index < 4 ? "qualified" : ""}>
                        <td>{index + 1}</td>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.draws}</td>
                        <td>{row.losses}</td>
                        <td>{row.scored}:{row.conceded}</td>
                        <td>{row.difference > 0 ? `+${row.difference}` : row.difference}</td>
                        <td><strong>{row.points}</strong></td>
                      </tr>
                    ))}
                    {rows.length === 0 ? <tr><td colSpan={9} className="muted">Noch keine Teams in dieser Gruppe.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <p className="table-note"><span className="qualification-dot" /> Grün markierte Plätze sind aktuell für das Viertelfinale qualifiziert.</p>
            </section>
          );
        })}
      </div>
    </main>
  );
}
