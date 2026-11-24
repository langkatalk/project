// api/buat-akun.js
// Membuat akun pengguna baru. Hanya direktur yang sudah masuk yang boleh memakai ini.
// Butuh environment variable di Vercel: SUPABASE_SERVICE_ROLE_KEY (jangan ditulis di kode).

var SUPABASE_URL = 'https://wzobvwdsnhnuvcbtalpa.supabase.co';
var PUBLISHABLE_KEY = 'sb_publishable__pEZvRbSE9HHDKTkpEXZMg_LXrH1GXl';
var ROLE_BOLEH = ['direktur', 'pemred', 'redaktur', 'editor', 'reporter', 'kontributor'];
var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
var REGEX_USERNAME = /^[a-z0-9_.]{3,24}$/;

function kirim(res, kode, pesan, ekstra) {
  res.status(kode).json(Object.assign({ ok: kode < 300, pesan: pesan }, ekstra || {}));
}

function pesanDariSupabase(d, cadangan) {
  return (d && (d.msg || d.error_description || d.message)) || cadangan;
}

async function ambilData(kunci, path) {
  var r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: { apikey: kunci, Authorization: 'Bearer ' + kunci }
  });
  if (!r.ok) throw new Error('Gagal membaca data dari database');
  return r.json();
}

function kirimData(kunci, metode, path, isi) {
  return fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: metode,
    headers: {
      apikey: kunci,
      Authorization: 'Bearer ' + kunci,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(isi)
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return kirim(res, 405, 'Metode tidak diizinkan');

  var kunciAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!kunciAdmin) return kirim(res, 500, 'Server belum dikonfigurasi. Hubungi pengelola.');

  var token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return kirim(res, 401, 'Silakan masuk dulu.');

  // 1. Siapa yang memanggil? Dicek ke Supabase, bukan dari data yang dikirim browser.
  var siapa = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!siapa.ok) return kirim(res, 401, 'Sesi tidak valid. Masuk ulang.');
  var user = await siapa.json();

  // 2. Jabatan pemanggil diambil dari database
  var daftarMe = await ambilData(kunciAdmin,
    'profiles?id=eq.' + encodeURIComponent(user.id) + '&select=id,full_name,role,is_active');
  var me = daftarMe[0];
  if (!me || me.is_active === false) return kirim(res, 403, 'Akun tidak aktif.');
  if (me.role !== 'direktur') return kirim(res, 403, 'Hanya direktur yang boleh membuat akun.');

  // 3. Validasi isian
  var b = req.body || {};
  var nama = String(b.full_name || '').trim();
  var username = String(b.username || '').trim().toLowerCase();
  var email = String(b.email || '').trim().toLowerCase();
  var sandi = String(b.password || '');
  var role = String(b.role || '');
  var desk = String(b.desk || '').trim() || null;
  var alasan = String(b.alasan || '').trim();

  if (nama.length < 3) return kirim(res, 400, 'Nama minimal 3 karakter.');
  if (!REGEX_USERNAME.test(username)) return kirim(res, 400, 'Nama pengguna 3-24 karakter: huruf kecil, angka, titik, garis bawah.');
  if (!REGEX_EMAIL.test(email)) return kirim(res, 400, 'Email belum benar.');
  if (sandi.length < 8) return kirim(res, 400, 'Kata sandi awal minimal 8 karakter.');
  if (ROLE_BOLEH.indexOf(role) === -1) return kirim(res, 400, 'Jabatan tidak dikenal.');
  if (alasan.length < 10) return kirim(res, 400, 'Alasan minimal 10 karakter.');

  // 4. Cek email dan nama pengguna belum dipakai
  var cekEmail = await ambilData(kunciAdmin, 'profiles?email=eq.' + encodeURIComponent(email) + '&select=id');
  var cekUser = await ambilData(kunciAdmin, 'profiles?username=eq.' + encodeURIComponent(username) + '&select=id');
  if (cekEmail.length || cekUser.length) {
    return kirim(res, 409, 'Email atau nama pengguna sudah dipakai.');
  }

  // 5. Buat akun login. Email langsung dianggap terkonfirmasi, tanpa undangan.
  var buat = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: kunciAdmin,
      Authorization: 'Bearer ' + kunciAdmin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: sandi,
      email_confirm: true,
      user_metadata: { username: username, full_name: nama }
    })
  });
  var hasilBuat = await buat.json();
  if (!buat.ok) return kirim(res, 400, pesanDariSupabase(hasilBuat, 'Gagal membuat akun.'));
  var idBaru = hasilBuat.id;

  // 6. Profil dibuat otomatis oleh trigger. Di sini diisi jabatan, meja, dan status.
  var upd = await kirimData(kunciAdmin, 'PATCH', 'profiles?id=eq.' + idBaru, {
    role: role, desk: desk, is_active: true, status_akun: 'aktif'
  });
  if (!upd.ok) {
    return kirim(res, 500, 'Akun dibuat, tapi jabatan belum tersimpan. Hubungi pengelola.', { id: idBaru });
  }

  // 7. Catat di log (sandi tidak pernah dicatat)
  await kirimData(kunciAdmin, 'POST', 'audit_logs', {
    actor_id: me.id,
    actor_name: me.full_name,
    actor_role: 'direktur',
    target_type: 'profile',
    target_id: idBaru,
    action: 'buat_akun',
    detail: { username: username, role: role, desk: desk, alasan: alasan }
  });

  return kirim(res, 200, 'Akun ' + nama + ' berhasil dibuat sebagai ' + role + '.', { id: idBaru });
};
