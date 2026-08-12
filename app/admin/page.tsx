"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const supabase = createBrowserSupabaseClient();

type Group = { id: string; name: string };
type Team = { id: string; name: string; group_id: string | null; manual_rank_override: number | null };
type Match = { id: string; phase: string; group_id: string | null; team1_id: string | null; team2_id: string | null; team1_score: number | null; team2_score: number | null; scheduled_at: string | null; table_number: string | null; status: string };

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const { data: tournamentData } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(1).single();
    if (!tournamentData) { setLoading(false); return; }
    setTournament(tournamentData);
    const [{ data: groupData }, { data: teamData }, { data: matchData }] = await Promise.all([
      supabase.from("groups").select("id,name").eq("tournament_id", tournamentData.id).order("sort_order"),
      supabase.from("teams").select("id,name,group_id,manual_rank_override").eq("tournament_id", tournamentData.id).order("name"),
      supabase.from("matches").select("id,phase,group_id,team1_id,team2_id,team1_score,team2_score,scheduled_at,table_number,status").eq("tournament_id", tournamentData.id).order("scheduled_at", { ascending: true, nullsFirst: false }),
    ]);
    setGroups(groupData ?? []);
    setTeams(teamData ?? []);
    setMatches(matchData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) loadData(); else setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (nextSession) loadData(); });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password"));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Eingeloggt.");
  }

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password"));
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Konto erstellt. Falls E-Mail-Bestätigung aktiv ist, bestätige zuerst die Mail.");
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!tournament) return;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("teams").insert({ tournament_id: tournament.id, name: String(form.get("name")), group_id: String(form.get("group_id")) || null });
    setMessage(error ? error.message : "Team gespeichert."); if (!error) { event.currentTarget.reset(); await loadData(); }
  }

  async function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!tournament) return;
    const form = new FormData(event.currentTarget);
    const phase = String(form.get("phase")); const scheduled = String(form.get("scheduled_at"));
    const team1 = String(form.get("team1_id")); const team2 = String(form.get("team2_id"));
    if (team1 === team2) { setMessage("Ein Team kann nicht gegen sich selbst spielen."); return; }
    const { error } = await supabase.from("matches").insert({
      tournament_id: tournament.id,
      phase,
      group_id: phase === "group" ? String(form.get("group_id")) || null : null,
      team1_id: team1 || null,
      team2_id: team2 || null,
      scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
      table_number: String(form.get("table_number")) || null,
      status: "scheduled",
    });
    setMessage(error ? error.message : "Spiel angelegt."); if (!error) { event.currentTarget.reset(); await loadData(); }
  }

  async function saveMatch(match: Match, form: HTMLFormElement) {
    const data = new FormData(form);
    const score1Raw = String(data.get("team1_score")); const score2Raw = String(data.get("team2_score"));
    const score1 = score1Raw === "" ? null : Number(score1Raw); const score2 = score2Raw === "" ? null : Number(score2Raw);
    const status = String(data.get("status"));
    const winnerId = status === "finished" && score1 !== null && score2 !== null ? (score1 > score2 ? match.team1_id : score2 > score1 ? match.team2_id : null) : null;
    const { error } = await supabase.from("matches").update({ team1_score: score1, team2_score: score2, status, winner_id: winnerId, table_number: String(data.get("table_number")) || null }).eq("id", match.id);
    setMessage(error ? error.message : "Spiel aktualisiert."); if (!error) await loadData();
  }

  async function toggleKnockout() {
    if (!tournament) return;
    const next = !tournament.show_knockout;
    const { error } = await supabase.from("tournaments").update({ show_knockout: next, current_phase: next ? "quarterfinal" : "group", status: next ? "knockout" : "group_stage" }).eq("id", tournament.id);
    setMessage(error ? error.message : next ? "Finalrunde freigeschaltet." : "Finalrunde ausgeblendet."); if (!error) await loadData();
  }

  const teamName = (id: string | null) => teams.find((team) => team.id === id)?.name ?? "Noch offen";
  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "–";
  const sortedMatches = useMemo(() => [...matches].sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999")), [matches]);

  if (!session) {
    return <main className="content admin-shell"><div className="page-heading"><p className="eyebrow">ADMIN</p><h1>Turnierverwaltung</h1></div><div className="admin-login"><form onSubmit={login} className="form-card"><h2>Einloggen</h2><label>E-Mail<input name="email" type="email" required /></label><label>Passwort<input name="password" type="password" minLength={6} required /></label><button type="submit">Einloggen</button></form><form onSubmit={signup} className="form-card"><h2>Erstes Konto erstellen</h2><label>E-Mail<input name="email" type="email" required /></label><label>Passwort<input name="password" type="password" minLength={6} required /></label><button type="submit" className="secondary">Konto erstellen</button></form></div>{message ? <p className="notice">{message}</p> : null}</main>;
  }

  if (loading) return <main className="content"><p>Lade Adminbereich…</p></main>;

  return <main className="content admin-shell">
    <div className="admin-heading"><div><p className="eyebrow">ADMIN</p><h1>{tournament?.name ?? "Turnierverwaltung"}</h1></div><div className="admin-actions"><button onClick={toggleKnockout}>{tournament?.show_knockout ? "Finalrunde ausblenden" : "Finalrunde freischalten"}</button><button className="secondary" onClick={() => supabase.auth.signOut()}>Abmelden</button></div></div>
    {message ? <p className="notice">{message}</p> : null}

    <section className="admin-grid">
      <form className="form-card" onSubmit={addTeam}><h2>Team hinzufügen</h2><label>Teamname<input name="name" required placeholder="z. B. Cup Kings" /></label><label>Gruppe<select name="group_id" required><option value="">Gruppe wählen</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><button type="submit">Team speichern</button></form>
      <form className="form-card" onSubmit={addMatch}><h2>Spiel anlegen</h2><label>Phase<select name="phase" defaultValue="group"><option value="group">Gruppenphase</option><option value="quarterfinal">Viertelfinale</option><option value="semifinal">Halbfinale</option><option value="third_place">Platz 3</option><option value="final">Finale</option></select></label><label>Gruppe<select name="group_id"><option value="">Keine / K.-o.</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><div className="two-cols"><label>Team 1<select name="team1_id" required><option value="">Team wählen</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label><label>Team 2<select name="team2_id" required><option value="">Team wählen</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label></div><div className="two-cols"><label>Zeit<input name="scheduled_at" type="datetime-local" /></label><label>Tisch<input name="table_number" placeholder="1" /></label></div><button type="submit">Spiel speichern</button></form>
    </section>

    <section><h2>Teams</h2><div className="team-list">{teams.map((team) => <div className="team-pill" key={team.id}><strong>{team.name}</strong><span>{groupName(team.group_id)}</span></div>)}</div></section>

    <section><h2>Spiele & Resultate</h2><div className="admin-match-list">{sortedMatches.map((match) => <form className="admin-match" key={match.id} onSubmit={(event) => { event.preventDefault(); saveMatch(match, event.currentTarget); }}><div><small>{match.phase === "group" ? groupName(match.group_id) : match.phase}</small><strong>{teamName(match.team1_id)} vs. {teamName(match.team2_id)}</strong><span>{match.scheduled_at ? new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(match.scheduled_at)) : "Zeit offen"}</span></div><input name="team1_score" type="number" min="0" defaultValue={match.team1_score ?? ""} aria-label="Resultat Team 1" /><span>:</span><input name="team2_score" type="number" min="0" defaultValue={match.team2_score ?? ""} aria-label="Resultat Team 2" /><input name="table_number" defaultValue={match.table_number ?? ""} placeholder="Tisch" aria-label="Tisch" /><select name="status" defaultValue={match.status}><option value="scheduled">Geplant</option><option value="live">Läuft</option><option value="finished">Beendet</option></select><button type="submit">Speichern</button></form>)}</div></section>
  </main>;
}
