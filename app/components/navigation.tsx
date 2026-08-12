import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function Navigation() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("show_knockout,current_phase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const showKnockout = Boolean(tournament?.show_knockout) || tournament?.current_phase !== "group";

  return (
    <header className="topbar">
      <Link href="/" className="brand">🍺 BEER PONG</Link>
      <nav className="nav-links" aria-label="Hauptnavigation">
        <Link href="/spielplan">Spielplan</Link>
        <Link href="/tabelle">Tabelle</Link>
        {showKnockout ? <Link href="/finalrunde">Finalrunde</Link> : null}
      </nav>
    </header>
  );
}
