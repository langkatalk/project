// js/import-lpse.js
// Direktur memasukkan JSON hasil Console LPSE. Hanya paket yang sudah selesai.
// Yang sudah ada di database tidak diubah.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var box = document.getElementById('impLpse');
  if (!sb || !box) return;

  var SELESAI = /sudah selesai|penandatanganan kontrak/i;
  var hasilSiap = [];

  box.innerHTML =
    '<h3 class="ap-label">Masukkan data LPSE (file JSON dari Console)</h3>' +
    '<p>Hanya paket yang tahapnya <b>sudah selesai</b> atau <b>penandatanganan kontrak</b> yang dimasukkan. ' +
    'Paket yang sudah ada di database tidak diubah.</p>' +
    '<input class="ap-input" type="file" id="impFile" accept=".json,application/json">' +
    '<div id="impInfo"></div>' +
    '<p class="ap-err" id="impErr"></p>' +
    '<p class="ap-ok" id="impOk"></p>' +
    '<button class="ap-tombol" id="impSimpan" disabled>Masukkan yang sudah selesai</button>';

  function ambilBaris(rec, label) {
    var b = (rec.halaman && rec.halaman.Pengumuman && rec.halaman.Pengumuman.baris) || [];
    var hit = b.find(function (r) { return r[0] === label; });
    return hit ? hit[1] : '';
  }

  function tahapOf(rec) {
    return ambilBaris(rec, 'Tahap Tender Saat Ini') || ambilBaris(rec, 'Tahap Paket Saat Ini') || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function saatFile() {
    var f = document.getElementById('impFile').files[0];
    hasilSiap = [];
    document.getElementById('impSimpan').disabled = true;
    document.getElementById('impErr').textContent = '';
    document.getElementById('impOk').textContent = '';
    document.getElementById('impInfo').innerHTML = '';
    if (!f) return;

    var data;
    try { data = JSON.parse(await f.text()); }
    catch (e) { document.getElementById('impErr').textContent = 'File bukan JSON yang valid.'; return; }
    if (!Array.isArray(data)) { document.getElementById('impErr').textContent = 'Isi file tidak sesuai (bukan daftar paket).'; return; }

    // Ringkasan semua tahap yang ada di file, supaya bisa dicek
    var dist = {};
    data.forEach(function (r) {
      var t = tahapOf(r) || '(kosong)';
      dist[t] = (dist[t] || 0) + 1;
    });
    var baris = Object.keys(dist)
      .sort(function (a, b) { return dist[b] - dist[a]; })
      .map(function (t) { return '<tr><td>' + esc(t) + '</td><td>' + dist[t] + '</td></tr>'; })
      .join('');

    // Hanya yang sudah selesai, tanpa kode ganda di dalam file
    var unik = new Map();
    data.forEach(function (r) {
      if (SELESAI.test(tahapOf(r)) && !unik.has(String(r.kode))) unik.set(String(r.kode), r);
    });
    var selesai = Array.from(unik.values());

    // Cek yang sudah ada di database
    var kodes = selesai.map(function (r) { return String(r.kode); });
    var ada = new Set();
    for (var i = 0; i < kodes.length; i += 200) {
      var r = await sb.from('lpse_paket').select('kode').in('kode', kodes.slice(i, i + 200));
      if (r.error) { document.getElementById('impErr').textContent = 'Gagal cek database: ' + r.error.message; return; }
      (r.data || []).forEach(function (x) { ada.add(x.kode); });
    }

    hasilSiap = selesai.filter(function (r) { return !ada.has(String(r.kode)); }).map(function (r) {
      return {
        kode: String(r.kode),
        jenis: r.jenis,
        nama_tampil: r.nama_tampil || '',
        tahap: tahapOf(r),
        satuan_kerja: ambilBaris(r, 'Satuan Kerja'),
        halaman: r.halaman || {},
        diambil_pada: r.diambil_pada || null
      };
    });

    document.getElementById('impInfo').innerHTML =
      '<p><b>Total paket di file:</b> ' + data.length + '<br>' +
      '<b>Tahap selesai:</b> ' + selesai.length + '<br>' +
      '<b>Sudah ada di database (dilewati):</b> ' + (selesai.length - hasilSiap.length) + '<br>' +
      '<b>Baru yang akan dimasukkan:</b> ' + hasilSiap.length + '</p>' +
      '<details><summary>Lihat semua tahap yang ada di file</summary>' +
      '<div style="overflow-x:auto"><table class="ap-tabel"><thead><tr><th>Tahap</th><th>Jumlah</th></tr></thead><tbody>' +
      baris + '</tbody></table></div></details>';

    document.getElementById('impSimpan').disabled = hasilSiap.length === 0;
  }

  async function simpan() {
    var tombol = document.getElementById('impSimpan');
    tombol.disabled = true;
    document.getElementById('impErr').textContent = '';
    document.getElementById('impOk').textContent = 'Menyimpan…';
    try {
      for (var i = 0; i < hasilSiap.length; i += 20) {
        var r = await sb.from('lpse_paket').upsert(hasilSiap.slice(i, i + 20), { onConflict: 'kode', ignoreDuplicates: true });
        if (r.error) throw new Error(r.error.message);
      }
      document.getElementById('impOk').textContent = hasilSiap.length + ' paket berhasil dimasukkan. Yang sudah ada tidak diubah.';
      document.getElementById('impFile').value = '';
      document.getElementById('impInfo').innerHTML = '';
      hasilSiap = [];
    } catch (e) {
      document.getElementById('impErr').textContent = 'Gagal menyimpan: ' + e.message;
      document.getElementById('impOk').textContent = '';
      tombol.disabled = false;
    }
  }

  document.getElementById('impFile').addEventListener('change', saatFile);
  document.getElementById('impSimpan').addEventListener('click', simpan);
})();
