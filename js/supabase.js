// js/supabase.js
// Tugas: menyiapkan koneksi ke Supabase satu kali saja.
// Semua halaman memakai window.LK.sb. Tidak ada kunci rahasia di sini.

(function () {
  window.LK = window.LK || {};

  var cfg = window.APP_CONFIG || {};
  var kunci = (cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();

  // Pakai jalur proxy Vercel (/supabase) supaya lebih stabil
  var alamat = cfg.USE_PROXY !== false
    ? window.location.origin + (cfg.PROXY_PATH || '/supabase')
    : (cfg.SUPABASE_URL || '');

  var siap = !!(window.supabase && alamat && kunci && kunci.length >= 20);

  if (!window.supabase) {
    console.error('[Langkatalk] Library Supabase belum dimuat. Cek script di HTML.');
  } else if (!siap) {
    console.error('[Langkatalk] config.js belum lengkap.');
  }

  window.LK.sbSiap = siap;
  window.LK.sb = siap ? window.supabase.createClient(alamat, kunci) : null;
})();
