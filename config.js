// SvezemeTě — jediný konfigurační soubor.
// demo musí být přesně true, jinak demo režim není. Bez platného Supabase
// a s demo:false se ukáže jen „Aplikace zatím není nastavena“.
// supabaseUrl a supabaseAnonKey jsou veřejné údaje (Settings → API).
// Nikdy sem nedávejte service_role klíč.
window.SVEZEME_CONFIG = {
  demo: false,
  supabaseUrl: "__SB_URL__",
  supabaseAnonKey: "__SB_ANON_KEY__",
};
