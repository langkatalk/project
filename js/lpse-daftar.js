// js/lpse-daftar.js
// Daftar paket LPSE (sudah selesai) di halaman Pantau Pembangunan.
// Isinya persis seperti tab di LPSE. Paket dibuka satu per satu.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var box = document.getElementById('lpseDaftar');
  if (!sb || !box) return;

  var URUTAN_TAB = ['Pengumuman', 'Peserta', 'Hasil Evaluasi', 'Pemenang', 'Pemenang Berkontrak'];
  var DOKUMEN = /\.(pdf|xlsx?|docx?|zip|rar)$/i;
  var semua = [];

  var gaya = document.createElement('style');
  gaya.textContent =
    '.lpse-item { border: 1px solid #ECE8FF; border-radius: 16px; padding: 12px 14px; margin-bottom: 10px; background: rgba(255,255,255,.85); }' +
    '.lpse-item summary { cursor: pointer; font-size: 14px; line-height: 1.5; }' +
    '.lpse-item summary span { color: #5b5478; font-size: 12px; }' +
    '.lpse-isi { margin-top: 10px; font-size: 13px; }' +
    '.lpse-isi ul { padding-left: 18px; }';
  document.head.appendChild(gaya);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  box.innerHTML =
    '<h2 class="pb-h">Paket LPSE Kabupaten Langkat (sudah selesai)</h2>' +
    '<p class="pb-penjelasan">Data di bawah ini disalin dari halaman LPSE, sama seperti yang tampil di sana. ' +
    'Sumber: <a href="https://spse.inaproc.id/langkatkab" target="_blank" rel="noopener">spse.inaproc.id/langkatkab</a></p>' +
    '<input type="search" id="lpseCari" placeholder="Cari nama paket, kode, satuan kerja, atau tahap" ' +
    'style="width:100%;min-height:44px;padding:0 12px;border-radius:12px;border:1.5px solid #E4DEFF;font:inherit;margin-bottom:10px">' +
    '<p id="lpseInfo" class="pb-diperbarui"></p>' +
    '<div id="lpseList"></div>';

  async function ambilRingkas() {
    var out = [], dari = 0;
    for (;;) {
      var r = await sb.from('lpse_paket')
        .select('kode,jenis,nama_tampil,tahap,satuan_kerja')
        .order('kode')
        .range(dari, dari + 999);
      if (r.error) throw new Error(r.error.message);
      var d = r.data || [];
      out = out.concat(d);
      if (d.length < 1000) break;
      dari += 1000;
    }
    return out;
  }

  function tabHtml(h) {
    return URUTAN_TAB.map(function (nama) {
      var t = h && h[nama];
      if (!t || t.error) return '';
      var baris = (t.baris || []).map(function (b) {
        return '<tr>' + b.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('');
      var file = (t.tautan || []).filter(function (a) {
        return DOKUMEN.test(a.teks) || DOKUMEN.test(a.href);
      }).map(function (a) {
        return '<li><a href="' + esc(a.href) + '" target="_blank" rel="noopener">' + esc(a.teks) + '</a></li>';
      }).join('');
      return '<h4 class="pb-sub">' + esc(nama) + '</h4>' +
        (baris ? '<div class="pb-tabel-wrap"><table class="pb-tabel"><tbody>' + baris + '</tbody></table></div>' : '') +
        (file ? '<ul>' + file + '</ul>' : '');
    }).join('');
  }

  function render() {
    var q = document.getElementById('lpseCari').value.trim().toLowerCase();
    var hasil = semua.filter(function (r) {
      return !q || [r.kode, r.nama_tampil, r.satuan_kerja, r.tahap].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById('lpseInfo').textContent = hasil.length.toLocaleString('id-ID') + ' paket';
    document.getElementById('lpseList').innerHTML = hasil.map(function (r) {
      return '<details class="lpse-item" data-kode="' + esc(r.kode) + '"><summary>' +
        '<b>' + esc(r.nama_tampil) + '</b><br>' +
        '<span>Kode ' + esc(r.kode) + ' · ' + esc(r.satuan_kerja) + ' · ' + esc(r.tahap) + '</span>' +
        '</summary><div class="lpse-isi">Memuat…</div></details>';
    }).join('');
  }

  // Isi tab diambil dari database saat paket dibuka
  document.getElementById('lpseList').addEventListener('toggle', async function (e) {
    var d = e.target;
    if (!d.open || d.dataset.sudah) return;
    d.dataset.sudah = '1';
    var isi = d.querySelector('.lpse-isi');
    var r = await sb.from('lpse_paket').select('halaman').eq('kode', d.dataset.kode).maybeSingle();
    if (r.error || !r.data) { isi.textContent = 'Data belum bisa dimuat.'; return; }
    isi.innerHTML = tabHtml(r.data.halaman);
  }, true);

  document.getElementById('lpseCari').addEventListener('input', render);

  ambilRingkas().then(function (data) {
    semua = data;
    render();
  }).catch(function () {
    document.getElementById('lpseList').textContent = 'Data LPSE belum bisa dimuat. Coba lagi sebentar lagi.';
  });
})();
