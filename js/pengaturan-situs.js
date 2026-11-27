// js/pengaturan-situs.js
// Pengaturan Situs: nama, tagline, alamat, telepon, email, Instagram, dan badan hukum.
// Hanya direktur yang bisa menyimpan (dijaga di database, tabel site_settings).
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var $ = function (id) { return document.getElementById(id); };

  var KUNCI = ['nama_situs', 'tagline', 'badan_hukum', 'alamat', 'telepon', 'email', 'instagram'];
  var REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  async function cekDirektur() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return { masuk: false };
    var p = await sb.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    return { masuk: true, direktur: !!(p.data && p.data.role === 'direktur' && p.data.is_active !== false) };
  }

  async function muat() {
    var r = await sb.from('site_settings').select('key,value').in('key', KUNCI);
    if (r.error) { $('psErr').textContent = 'Gagal memuat: ' + r.error.message; return; }
    var nilai = {};
    (r.data || []).forEach(function (x) { nilai[x.key] = x.value || ''; });
    KUNCI.forEach(function (k) {
      var el = $('ps_' + k);
      if (el) el.value = nilai[k] || '';
    });
  }

  function validasi() {
    var email = $('ps_email').value.trim();
    var ig = $('ps_instagram').value.trim();
    var telp = $('ps_telepon').value.trim();
    if (email && !REGEX_EMAIL.test(email)) return 'Format email belum benar.';
    if (ig && !/^https:\/\//i.test(ig)) return 'Tautan Instagram harus mulai dengan https://';
    if (telp && !/^[0-9+()\-\s]{6,30}$/.test(telp)) return 'Nomor telepon hanya boleh berisi angka, +, -, spasi, atau tanda kurung.';
    return '';
  }

  async function simpan(e) {
    e.preventDefault();
    $('psErr').textContent = '';
    $('psOk').textContent = '';

    var salah = validasi();
    if (salah) { $('psErr').textContent = salah; return; }

    var baris = KUNCI.map(function (k) {
      return { key: k, value: $('ps_' + k).value.trim(), updated_at: new Date().toISOString() };
    });

    $('psSimpan').disabled = true;
    var r = await sb.from('site_settings').upsert(baris, { onConflict: 'key' });
    $('psSimpan').disabled = false;

    if (r.error) { $('psErr').textContent = 'Gagal menyimpan: ' + r.error.message; return; }
    $('psOk').textContent = 'Pengaturan tersimpan. Footer situs akan mengikuti isian ini.';
  }

  async function mulai() {
    if (!sb) { $('psAkses').innerHTML = '<p>Koneksi belum siap.</p>'; return; }
    var c = await cekDirektur();
    if (!c.masuk) { $('psAkses').innerHTML = '<p>Masuk dulu lewat <a href="redaksi.html">Ruang Redaksi</a>.</p>'; return; }
    if (!c.direktur) { $('psAkses').innerHTML = '<p>Halaman ini hanya untuk direktur.</p>'; return; }

    $('psAkses').hidden = true;
    $('psPanel').hidden = false;
    $('psForm').addEventListener('submit', simpan);
    muat();
  }

  mulai();
})();
