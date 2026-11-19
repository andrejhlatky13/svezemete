// SvezemeTě — jediný konfigurační soubor.
// demo musí být přesně true, jinak demo režim není. Bez platného Supabase
// a s demo:false se ukáže jen „Aplikace zatím není nastavena“.
// supabaseUrl a supabaseAnonKey jsou veřejné údaje (Settings → API).
// Nikdy sem nedávejte service_role klíč.
window.SVEZEME_CONFIG = {
  demo: false,
  supabaseUrl: "https://mhizoumxkjxsgjmahefz.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaXpvdW14a2p4c2dqbWFoZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTU2MTQsImV4cCI6MjExMDY3MTYxNH0.Ykd9MNQ1ZhE6NhupKOb5xI-uH-VT2gnLcXpDkjtDXhc",
};
