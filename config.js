// Isi dua nilai ini dari Supabase: Project Settings > API.
// Anon key memang boleh publik. Keamanan dijaga aturan RLS di database, bukan dengan menyembunyikan key ini.
// JANGAN PERNAH menaruh "service_role" key di sini.
window.LANGKATALK_CONFIG = {
  SUPABASE_URL: 'GANTI_DENGAN_PROJECT_URL',
  SUPABASE_ANON_KEY: 'GANTI_DENGAN_ANON_KEY',
  // true = semua permintaan ke Supabase lewat jembatan di domain Vercel-mu (/supabase).
  // Wajib true jika provider internet memblokir supabase.co. Alamat tujuan jembatan diatur di vercel.json.
  USE_PROXY: true
};
