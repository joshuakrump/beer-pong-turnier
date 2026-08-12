export type TeamRow = {
  id: string;
  name: string;
  group_id: string | null;
  manual_rank_override?: number | null;
};

export type MatchRow = {
  id: string;
  group_id: string | null;
  phase: string;
  team1_id: string | null;
  team2_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
};

export type Standing = {
  teamId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
  manualRank: number | null;
};

export function calculateStandings(teams: TeamRow[], matches: MatchRow[]) {
  const table = new Map<string, Standing>();

  for (const team of teams) {
    table.set(team.id, {
      teamId: team.id,
      name: team.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scored: 0,
      conceded: 0,
      difference: 0,
      points: 0,
      manualRank: team.manual_rank_override ?? null,
    });
  }

  const finished = matches.filter(
    (match) =>
      match.phase === "group" &&
      match.status === "finished" &&
      match.team1_id &&
      match.team2_id &&
      match.team1_score !== null &&
      match.team2_score !== null,
  );

  for (const match of finished) {
    const a = table.get(match.team1_id!);
    const b = table.get(match.team2_id!);
    if (!a || !b) continue;

    const scoreA = match.team1_score!;
    const scoreB = match.team2_score!;
    a.played += 1;
    b.played += 1;
    a.scored += scoreA;
    a.conceded += scoreB;
    b.scored += scoreB;
    b.conceded += scoreA;

    if (scoreA > scoreB) {
      a.wins += 1;
      b.losses += 1;
      a.points += 2;
    } else if (scoreB > scoreA) {
      b.wins += 1;
      a.losses += 1;
      b.points += 2;
    } else {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  for (const row of table.values()) {
    row.difference = row.scored - row.conceded;
  }

  const directPoints = (teamId: string, tiedIds: Set<string>) => {
    let points = 0;
    for (const match of finished) {
      if (!match.team1_id || !match.team2_id) continue;
      if (!tiedIds.has(match.team1_id) || !tiedIds.has(match.team2_id)) continue;
      if (match.team1_id !== teamId && match.team2_id !== teamId) continue;
      const isA = match.team1_id === teamId;
      const own = isA ? match.team1_score! : match.team2_score!;
      const opp = isA ? match.team2_score! : match.team1_score!;
      points += own > opp ? 2 : own === opp ? 1 : 0;
    }
    return points;
  };

  const rows = Array.from(table.values());
  rows.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.difference !== b.difference) return b.difference - a.difference;

    const tiedIds = new Set(
      rows
        .filter((row) => row.points === a.points && row.difference === a.difference)
        .map((row) => row.teamId),
    );
    const directA = directPoints(a.teamId, tiedIds);
    const directB = directPoints(b.teamId, tiedIds);
    if (directA !== directB) return directB - directA;
    if (a.scored !== b.scored) return b.scored - a.scored;
    if (a.manualRank !== null || b.manualRank !== null) {
      return (a.manualRank ?? 999) - (b.manualRank ?? 999);
    }
    return a.name.localeCompare(b.name, "de");
  });

  return rows;
}
