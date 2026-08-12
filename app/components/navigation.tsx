import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function Navigation() {
  const supabase = createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("show_knockout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const showKnockout = Boolean(tournament?.show_knockout);

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Beer Pong Turnier Startseite">
        <span className="brand-mark">🍺</span>
        <span className="brand-copy"><strong>BEER PONG</strong><small>TOURNAMENT</small></span>
      </Link>
      <nav className="nav-links" aria-label="Hauptnavigation">
        <Link href="/" className="mobile-home-link"><span className="nav-icon">⌂</span><span>Start</span></Link>
        <Link href="/spielplan"><span className="nav-icon">◷</span><span>Spielplan</span></Link>
        <Link href="/tabelle"><span className="nav-icon">▤</span><span>Tabelle</span></Link>
        {showKnockout ? <Link href="/finalrunde"><span className="nav-icon">♛</span><span>Finalrunde</span></Link> : null}
        <Link href="/admin" className="admin-nav-link"><span className="nav-icon">⚙</span><span>Admin</span></Link>
      </nav>
    </header>
  );
}
