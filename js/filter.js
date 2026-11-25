// js/filter.js
// Filter berita: kategori, urutan, dan tanggal. Hasilnya dikirim sebagai event 'lk:filter'.
(function () {
  'use strict';

  var btn = document.getElementById('filterBtn');
  if (!btn) return;
  var sb = window.LK && window.LK.sb;

  var TAHUN_MULAI = 2020;
  var URUTAN = [
    { nilai: 'terbaru', nama: 'Terbaru' },
    { nilai: 'terlama', nama: 'Terlama' },
    { nilai: 'az', nama: 'A-Z' },
    { nilai: 'za', nama: 'Z-A' },
    { nilai: 'populer', nama: 'Terpopuler' }
  ];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BAWAAN = { kategori: '', urutan: 'terbaru', tahun: '', bulan: '', tanggal: '' };

  var aktif = Object.assign({}, BAWAAN);
  var tmp = Object.assign({}, BAWAAN);
  var daftarKategori = [];

  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';

  var panel = document.createElement('div');
  panel.id = 'filterPanel';
  panel.className = 'filter-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Filter berita');
  panel.innerHTML =
    '<div class="filter-kaca">' +
      '<div class="fk-baris">' +
        '<h3 class="fk-judul">Filter berita</h3>' +
        '<button type="button" class="fk-tutup" id="fTutup" aria-label="Tutup">✕</button>' +
      '</div>' +
      '<div class="fk-blok"><p class="fk-label">Kategori</p><div class="fk-chips" id="fKat"></div></div>' +
      '<div class="fk-blok"><p class="fk-label">Urutan</p><div class="fk-chips" id="fUrut"></div></div>' +
      '<div class="fk-blok"><p class="fk-label">Tanggal terbit</p>' +
        '<div class="fk-tgl">' +
          '<select id="fTahun" aria-label="Tahun"></select>' +
          '<select id="fBulan" aria-label="Bulan"></select>' +
          '<select id="fTanggal" aria-label="Tanggal"></select>' +
        '</div>' +
      '</div>' +
      '<p class="fk-err" id="fErr"></p>' +
      '<div class="fk-tombol">' +
        '<button type="button" class="fk-btn-reset" id="fReset">Reset</button>' +
        '<button type="button" class="fk-btn-terapkan" id="fTerapkan">Terapkan</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);

  var elKat = document.getElementById('fKat');
  var elUrut = document.getElementById('fUrut');
  var elTahun = document.getElementById('fTahun');
  var elBulan = document.getElementById('fBulan');
  var elTanggal = document.getElementById('fTanggal');
  var elErr = document.getElementById('fErr');

  function isiPilihan() {
    var tahunIni = new Date().getFullYear();
    var opsiTahun = '<option value="">Tahun</option>';
    for (var y = tahunIni; y >= TAHUN_MULAI; y--) {
      opsiTahun += '<option value="' + y + '">' + y + '</option>';
    }
    elTahun.innerHTML = opsiTahun;

    elBulan.innerHTML = '<option value="">Bulan</option>' + BULAN.map(function (n, i) {
      return '<option value="' + (i + 1) + '">' + n + '</option>';
    }).join('');

    var opsiTgl = '<option value="">Tanggal</option>';
    for (var d = 1; d <= 31; d++) opsiTgl += '<option value="' + d + '">' + d + '</option>';
    elTanggal.innerHTML = opsiTgl;
  }

  function render() {
    var kat = [{ nama: 'Semua', nilai: '' }].concat(
      daftarKategori.map(function (n) { return { nama: n, nilai: n }; })
    );
    elKat.innerHTML = kat.map(function (k) {
      return '<button type="button" class="fk-chip' + (k.nilai === tmp.kategori ? ' on' : '') +
        '" data-kat="' + k.nilai.replace(/"/g, '&quot;') + '">' + k.nama + '</button>';
    }).join('');

    elUrut.innerHTML = URUTAN.map(function (u) {
      return '<button type="button" class="fk-chip' + (u.nilai === tmp.urutan ? ' on' : '') +
        '" data-urut="' + u.nilai + '">' + u.nama + '</button>';
    }).join('');

    elTahun.value = tmp.tahun;
    elBulan.value = tmp.bulan;
    elTanggal.value = tmp.tanggal;
  }

  function validasi(t) {
    if (t.tanggal && !t.bulan) return 'Pilih bulan dulu sebelum tanggal.';
    if ((t.bulan || t.tanggal) && !t.tahun) return 'Pilih tahun dulu.';
    if (t.tanggal && t.bulan && t.tahun) {
      var maks = new Date(Number(t.tahun), Number(t.bulan), 0).getDate();
      if (Number(t.tanggal) > maks) return 'Tanggal itu tidak ada di bulan tersebut.';
    }
    return '';
  }

  // Rentang waktu dalam ISO (zona waktu browser, untuk pembaca di Indonesia itu WIB)
  function rentang(t) {
    if (!t.tahun) return null;
    var y = Number(t.tahun);
    var dari, sampai;
    if (t.tanggal) {
      dari = new Date(y, Number(t.bulan) - 1, Number(t.tanggal));
      sampai = new Date(y, Number(t.bulan) - 1, Number(t.tanggal) + 1);
    } else if (t.bulan) {
      dari = new Date(y, Number(t.bulan) - 1, 1);
      sampai = new Date(y, Number(t.bulan), 1);
    } else {
      dari = new Date(y, 0, 1);
      sampai = new Date(y + 1, 0, 1);
    }
    return { dari: dari.toISOString(), sampai: sampai.toISOString() };
  }

  function sudahDiubah(t) {
    return !!(t.kategori || t.urutan !== 'terbaru' || t.tahun || t.bulan || t.tanggal);
  }

  function kirim() {
    var payload = {
      kategori: aktif.kategori,
      urutan: aktif.urutan,
      rentang: rentang(aktif)
    };
    window.LK = window.LK || {};
    window.LK.filterAktif = payload;
    btn.classList.toggle('aktif', sudahDiubah(aktif));
    document.dispatchEvent(new CustomEvent('lk:filter', { detail: payload }));
  }

  function buka() {
    tmp = Object.assign({}, aktif);
    elErr.textContent = '';
    render();
    panel.classList.add('on');
  }

  function tutup() {
    panel.classList.remove('on');
  }

  function terapkan() {
    tmp.tahun = elTahun.value;
    tmp.bulan = elBulan.value;
    tmp.tanggal = elTanggal.value;

    var salah = validasi(tmp);
    elErr.textContent = salah;
    if (salah) return;

    aktif = Object.assign({}, tmp);
    kirim();
    tutup();
  }

  function reset() {
    tmp = Object.assign({}, BAWAAN);
    aktif = Object.assign({}, BAWAAN);
    elErr.textContent = '';
    kirim();
    render();
    tutup();
  }

  btn.addEventListener('click', buka);
  document.getElementById('fTutup').addEventListener('click', tutup);
  document.getElementById('fTerapkan').addEventListener('click', terapkan);
  document.getElementById('fReset').addEventListener('click', reset);
  panel.addEventListener('click', function (e) {
    if (e.target === panel) return tutup();
    var k = e.target.closest('[data-kat]');
    if (k) { tmp.kategori = k.dataset.kat; render(); return; }
    var u = e.target.closest('[data-urut]');
    if (u) { tmp.urutan = u.dataset.urut; render(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('on')) tutup();
  });

  async function muatKategori() {
    if (!sb) return;
    var r = await sb.from('categories').select('name').order('sort', { ascending: true });
    if (!r.error && r.data) daftarKategori = r.data.map(function (x) { return x.name; });
    render();
  }

  isiPilihan();
  render();
  muatKategori();
})();
