"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const supabase = createBrowserSupabaseClient();

type Group = { id: string; name: string };
type Team = { id: string; name: string; group_id: string | null; manual_rank_override: number | null };
type Match = { id: string; phase: string; group_id: string | null; team1_id: string | null; team2_id: string | null; team1_score: number | null; team2_score: number | null; scheduled_at: string | null; table_number: string | null; status: string };
type BusyAction = string | null;

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [matchPhase, setMatchPhase] = useState("group");
  const [matchGroupId, setMatchGroupId] = useState("");
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadData(); else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_IN" && nextSession) loadData();
      if (event === "SIGNED_OUT") {
        setTournament(null); setGroups([]); setTeams([]); setMatches([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusyAction("login");
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setMessage(error ? error.message : "Eingeloggt.");
    setBusyAction(null);
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!tournament) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const groupId = String(form.get("group_id"));
    if (!name || !groupId) { setMessage("Bitte Teamname und Gruppe ausfüllen."); return; }
    setBusyAction("add-team");
    const { data, error } = await supabase.from("teams").insert({ tournament_id: tournament.id, name, group_id: groupId }).select("id,name,group_id,manual_rank_override").single();
    setMessage(error ? error.message : "Team gespeichert.");
    if (!error && data) {
      setTeams((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name, "de")));
      event.currentTarget.reset();
    }
    setBusyAction(null);
  }

  async function deleteTeam(team: Team) {
    const isUsed = matches.some((match) => match.team1_id === team.id || match.team2_id === team.id);
    if (isUsed) { setMessage(`Team \"${team.name}\" wird noch in einem Spiel verwendet. Lösche zuerst dieses Spiel.`); return; }
    if (!window.confirm(`Team \"${team.name}\" wirklich löschen?`)) return;
    setBusyAction(`delete-team-${team.id}`);
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    setMessage(error ? error.message : "Team gelöscht.");
    if (!error) setTeams((current) => current.filter((item) => item.id !== team.id));
    setBusyAction(null);
  }

  async function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!tournament) return;
    const form = new FormData(event.currentTarget);
    const phase = String(form.get("phase"));
    const groupId = String(form.get("group_id") ?? "");
    const scheduled = String(form.get("scheduled_at"));
    const team1 = String(form.get("team1_id"));
    const team2 = String(form.get("team2_id"));
    const tableNumber = String(form.get("table_number")).trim();

    if (!phase || !team1 || !team2 || !scheduled || !tableNumber || (phase === "group" && !groupId)) {
      setMessage("Bitte alle Pflichtfelder des Spiels ausfüllen."); return;
    }
    if (team1 === team2) { setMessage("Ein Team kann nicht gegen sich selbst spielen."); return; }
    if (phase === "group") {
      const team1Group = teams.find((team) => team.id === team1)?.group_id;
      const team2Group = teams.find((team) => team.id === team2)?.group_id;
      if (team1Group !== groupId || team2Group !== groupId) { setMessage("Beide Teams müssen zur gewählten Gruppe gehören."); return; }
    }

    setBusyAction("add-match");
    const { data, error } = await supabase.from("matches").insert({
      tournament_id: tournament.id,
      phase,
      group_id: phase === "group" ? groupId : null,
      team1_id: team1,
      team2_id: team2,
      scheduled_at: new Date(scheduled).toISOString(),
      table_number: tableNumber,
      status: "scheduled",
    }).select("id,phase,group_id,team1_id,team2_id,team1_score,team2_score,scheduled_at,table_number,status").single();

    setMessage(error ? error.message : "Spiel angelegt.");
    if (!error && data) {
      setMatches((current) => [...current, data]);
      event.currentTarget.reset();
      setMatchPhase("group"); setMatchGroupId(""); setTeam1Id(""); setTeam2Id("");
    }
    setBusyAction(null);
  }

  async function saveMatch(match: Match, form: HTMLFormElement) {
    const data = new FormData(form);
    const score1Raw = String(data.get("team1_score"));
    const score2Raw = String(data.get("team2_score"));
    const score1 = score1Raw === "" ? null : Number(score1Raw);
    const score2 = score2Raw === "" ? null : Number(score2Raw);
    const status = String(data.get("status"));
    const tableNumber = String(data.get("table_number")).trim();
    if (!tableNumber || !status) { setMessage("Tisch und Status sind Pflichtfelder."); return; }
    if (status === "finished" && (score1 === null || score2 === null)) { setMessage("Bei einem beendeten Spiel müssen beide Resultate eingetragen sein."); return; }
    setBusyAction(`save-match-${match.id}`);
    const winnerId = status === "finished" && score1 !== null && score2 !== null ? (score1 > score2 ? match.team1_id : score2 > score1 ? match.team2_id : null) : null;
    const { data: updated, error } = await supabase.from("matches").update({ team1_score: score1, team2_score: score2, status, winner_id: winnerId, table_number: tableNumber }).eq("id", match.id).select("id,phase,group_id,team1_id,team2_id,team1_score,team2_score,scheduled_at,table_number,status").single();
    setMessage(error ? error.message : "Spiel aktualisiert.");
    if (!error && updated) setMatches((current) => current.map((item) => item.id === match.id ? updated : item));
    setBusyAction(null);
  }

  async function deleteMatch(match: Match) {
    const label = `${teamName(match.team1_id)} vs. ${teamName(match.team2_id)}`;
    if (!window.confirm(`Spiel \"${label}\" wirklich löschen?`)) return;
    setBusyAction(`delete-match-${match.id}`);
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    setMessage(error ? error.message : "Spiel gelöscht.");
    if (!error) setMatches((current) => current.filter((item) => item.id !== match.id));
    setBusyAction(null);
  }

  async function toggleKnockout() {
    if (!tournament) return;
    setBusyAction("toggle-knockout");
    const next = !tournament.show_knockout;
    const changes = { show_knockout: next, current_phase: next ? "quarterfinal" : "group", status: next ? "knockout" : "group_stage" };
    const { error } = await supabase.from("tournaments").update(changes).eq("id", tournament.id);
    setMessage(error ? error.message : next ? "Finalrunde freigeschaltet." : "Finalrunde ausgeblendet.");
    if (!error) setTournament((current: any) => ({ ...current, ...changes }));
    setBusyAction(null);
  }

  const teamName = (id: string | null) => teams.find((team) => team.id === id)?.name ?? "Noch offen";
  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "–";
  const sortedMatches = useMemo(() => [...matches].sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999")), [matches]);
  const availableTeams = useMemo(() => matchPhase === "group" ? (matchGroupId ? teams.filter((team) => team.group_id === matchGroupId) : []) : teams, [matchPhase, matchGroupId, teams]);
  const busy = (key: string) => busyAction === key;

  if (!session) {
    return <main className="content admin-shell"><div className="admin-heading"><div><p className="eyebrow">ADMIN</p><h1>Turnierverwaltung</h1></div><Link href="/" className="button-link secondary-link">Zur Webseite</Link></div><div className="admin-login single-login"><form onSubmit={login} className="form-card"><h2>Einloggen</h2><p className="muted">Nur für die Turnierleitung.</p><label>E-Mail<input name="email" type="email" required /></label><label>Passwort<input name="password" type="password" minLength={6} required /></label><button type="submit" disabled={busy("login")} className={busy("login") ? "is-loading" : ""}>{busy("login") ? "Einloggen…" : "Einloggen"}</button></form></div>{message ? <p className="notice">{message}</p> : null}</main>;
  }

  if (loading) return <main className="content"><p>Lade Adminbereich…</p></main>;

  return <main className="content admin-shell">
    <div className="admin-heading"><div><p className="eyebrow">ADMIN</p><h1>{tournament?.name ?? "Turnierverwaltung"}</h1></div><div className="admin-actions"><Link href="/" className="button-link secondary-link">Zur Webseite</Link><button onClick={toggleKnockout} disabled={busy("toggle-knockout")} className={busy("toggle-knockout") ? "is-loading" : ""}>{busy("toggle-knockout") ? "Speichert…" : tournament?.show_knockout ? "Finalrunde ausblenden" : "Finalrunde freischalten"}</button><button className="secondary" onClick={() => supabase.auth.signOut()}>Abmelden</button></div></div>
    {message ? <p className="notice notice-feedback">{message}</p> : null}

    <section className="admin-grid">
      <form className="form-card" onSubmit={addTeam}>
        <h2>Team hinzufügen</h2>
        <label>Teamname *<input name="name" required placeholder="z. B. Cup Kings" /></label>
        <label>Gruppe *<select name="group_id" required><option value="">Gruppe wählen</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
        <button type="submit" disabled={busy("add-team")} className={busy("add-team") ? "is-loading" : ""}>{busy("add-team") ? "Speichert…" : "Team speichern"}</button>
      </form>

      <form className="form-card" onSubmit={addMatch}>
        <h2>Spiel anlegen</h2>
        <label>Phase *<select name="phase" value={matchPhase} required onChange={(event) => { const next = event.target.value; setMatchPhase(next); setMatchGroupId(""); setTeam1Id(""); setTeam2Id(""); }}><option value="group">Gruppenphase</option><option value="quarterfinal">Viertelfinale</option><option value="semifinal">Halbfinale</option><option value="third_place">Platz 3</option><option value="final">Finale</option></select></label>
        {matchPhase === "group" ? <label>Gruppe *<select name="group_id" value={matchGroupId} required onChange={(event) => { setMatchGroupId(event.target.value); setTeam1Id(""); setTeam2Id(""); }}><option value="">Gruppe wählen</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label> : null}
        <div className="two-cols">
          <label>Team 1 *<select name="team1_id" value={team1Id} required disabled={matchPhase === "group" && !matchGroupId} onChange={(event) => setTeam1Id(event.target.value)}><option value="">{matchPhase === "group" && !matchGroupId ? "Zuerst Gruppe wählen" : "Team wählen"}</option>{availableTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <label>Team 2 *<select name="team2_id" value={team2Id} required disabled={matchPhase === "group" && !matchGroupId} onChange={(event) => setTeam2Id(event.target.value)}><option value="">{matchPhase === "group" && !matchGroupId ? "Zuerst Gruppe wählen" : "Team wählen"}</option>{availableTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        </div>
        <div className="two-cols"><label>Zeit *<input name="scheduled_at" type="datetime-local" required /></label><label>Tisch *<input name="table_number" required placeholder="1" /></label></div>
        <button type="submit" disabled={busy("add-match")} className={busy("add-match") ? "is-loading" : ""}>{busy("add-match") ? "Spiel wird gespeichert…" : "Spiel speichern"}</button>
      </form>
    </section>

    <section><h2>Teams</h2><div className="team-list">{teams.map((team) => <div className="team-pill" key={team.id}><strong>{team.name}</strong><span>{groupName(team.group_id)}</span><button type="button" className={`team-delete ${busy(`delete-team-${team.id}`) ? "is-loading" : ""}`} disabled={busy(`delete-team-${team.id}`)} aria-label={`${team.name} löschen`} title="Team löschen" onClick={() => deleteTeam(team)}>{busy(`delete-team-${team.id}`) ? "…" : "×"}</button></div>)}</div></section>

    <section><h2>Spiele & Resultate</h2><div className="admin-match-list">{sortedMatches.map((match) => <form className="admin-match" key={match.id} onSubmit={(event) => { event.preventDefault(); saveMatch(match, event.currentTarget); }}><div><small>{match.phase === "group" ? groupName(match.group_id) : match.phase}</small><strong>{teamName(match.team1_id)} vs. {teamName(match.team2_id)}</strong><span>{match.scheduled_at ? new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(match.scheduled_at)) : "Zeit offen"}</span></div><input name="team1_score" type="number" min="0" defaultValue={match.team1_score ?? ""} aria-label="Resultat Team 1" /><span>:</span><input name="team2_score" type="number" min="0" defaultValue={match.team2_score ?? ""} aria-label="Resultat Team 2" /><input name="table_number" required defaultValue={match.table_number ?? ""} placeholder="Tisch" aria-label="Tisch" /><select name="status" required defaultValue={match.status}><option value="scheduled">Geplant</option><option value="live">Läuft</option><option value="finished">Beendet</option></select><div className="match-actions"><button type="submit" disabled={busy(`save-match-${match.id}`)} className={busy(`save-match-${match.id}`) ? "is-loading" : ""}>{busy(`save-match-${match.id}`) ? "Speichert…" : "Speichern"}</button><button type="button" className={`danger-button ${busy(`delete-match-${match.id}`) ? "is-loading" : ""}`} disabled={busy(`delete-match-${match.id}`)} onClick={() => deleteMatch(match)}>{busy(`delete-match-${match.id}`) ? "Löscht…" : "Löschen"}</button></div></form>)}</div></section>
  </main>;
}
