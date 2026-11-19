// SvezemeTě — jediný konfigurační soubor.
// Dokud tu jsou zástupné hodnoty (nebo prázdné řetězce), aplikace běží v demo režimu
// a data zůstávají jen v prohlížeči. Po nasazení sem vložte údaje z Supabase
// (Settings → API). Použijte veřejný anon klíč, nikdy ne service_role.
//
// window.SVEZEME_CONFIG = {
//   supabaseUrl: "https://xxxx.supabase.co",
//   supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
// };
window.SVEZEME_CONFIG = {
  supabaseUrl: "__SB_URL__",
  supabaseAnonKey: "__SB_ANON_KEY__",
};
