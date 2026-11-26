// js/pantau-pembangunan.js
// Halaman publik Pantau Pembangunan. Membaca tabel pembangunan_* dan menampilkannya sederhana.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var WARNA = ['#5A2FCF','#2D5CF0','#1CC8C8','#FFA257','#7C3FE0','#5B78F2','#20CDCB','#A78BFA','#F43F5E','#0D0A2C'];
  var D = { apbd: [], rup: [], lelang: [] };
  var charts = {};

  function rp(n) {
    n = Number(n) || 0;
    if (n >= 1e12) return 'Rp ' + (n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' triliun';
    if (n >= 1e9) return 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' miliar';
    if (n >= 1e6) return 'Rp ' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' juta';
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  // Format untuk animasi angka
  var FMT = {
    rp: rp,
    angka: function (n) { return Math.round(n).toLocaleString('id-ID'); },
    paket: function (n) { return Math.round(n).toLocaleString('id-ID') + ' paket'; }
  };

  // Angka naik dari 0 ke nilai sebenarnya dalam sekitar 0,9 detik
  function animasi(el, target, fmt) {
    var dur = 900, mulai = null;
    function frame(t) {
      if (mulai === null) mulai = t;
      var p = Math.min((t - mulai) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(frame);
  }

  function animasiSemua() {
    document.querySelectorAll('[data-nilai]').forEach(function (el) {
      animasi(el, Number(el.dataset.nilai), FMT[el.dataset.fmt] || FMT.rp);
    });
  }

  function persen(a, b) { return b ? Math.round(a / b * 1000) / 10 + '%' : '0%'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Mengambil semua baris dalam potongan 1000
  async function semua(tabel, sel) {
    var out = [], dari = 0;
    for (;;) {
      var r = await sb.from(tabel).select(sel).order('id').range(dari, dari + 999);
      if (r.error) throw new Error(r.error.message);
      var d = r.data || [];
      out = out.concat(d);
      if (d.length < 1000) break;
      dari += 1000;
    }
    return out;
  }

  function isiPilihan() {
    var tahun = {};
    D.rup.concat(D.lelang, D.apbd).forEach(function (r) { if (r.tahun) tahun[r.tahun] = 1; });
    var list = Object.keys(tahun).map(Number).sort(function (a, b) { return b - a; });
    if (!list.length) list = [new Date().getFullYear()];
    $('pbTahun').innerHTML = list.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
    $('pbBulan').innerHTML = '<option value="">Semua bulan</option>' +
      BULAN.map(function (n, i) { return '<option value="' + (i + 1) + '">' + n + '</option>'; }).join('');
  }

  function cocokBulan(r) {
    var B = $('pbBulan').value;
    return r.tahun === Number($('pbTahun').value) && (B === '' || Number(r.bulan) === Number(B));
  }
  function cocokTahun(r) { return r.tahun === Number($('pbTahun').value); }

  function gambar(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart($(id), cfg);
  }

  function terakhirDiperbarui() {
    var t = D.rup.concat(D.lelang).map(function (r) { return r.dibuat_pada; }).filter(Boolean).sort().pop();
    if (!t) return 'belum ada data';
    return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  }

  function render() {
    var rup = D.rup.filter(cocokBulan);
    var lelang = D.lelang.filter(cocokBulan);
    var apbd = D.apbd.filter(cocokTahun);
    $('pbKosong').hidden = !!(rup.length || lelang.length || apbd.length);

    // 1. Anggaran
    var urut = ['rapbd', 'apbd', 'papbd'];
    var nama = { rapbd: 'Rancangan (R-APBD)', apbd: 'Disahkan (APBD)', papbd: 'Perubahan (P-APBD)' };
    var nilai = urut.map(function (j) {
      var x = apbd.find(function (a) { return a.jenis === j; });
      return x ? Number(x.total) : 0;
    });
    $('pbApbd').innerHTML = urut.map(function (j, i) {
      var ada = nilai[i] > 0;
      return '<div class="pb-kartu"><p>' + nama[j] + '</p><b' +
        (ada ? ' data-nilai="' + nilai[i] + '" data-fmt="rp"' : '') + '>' +
        (ada ? 'Rp 0' : 'Belum ada data') + '</b></div>';
    }).join('');
    gambar('pbGrafApbd', {
      type: 'bar',
      data: { labels: urut.map(function (j) { return nama[j]; }), datasets: [{ data: nilai, backgroundColor: ['#A78BFA', '#2D5CF0', '#1CC8C8'], borderRadius: 8 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function (v) { return rp(v); } } } } }
    });

    // 2. Rencana (SIRUP)
    var totalRup = rup.reduce(function (s, r) { return s + (Number(r.pagu) || 0); }, 0);
    $('pbRencanaTotal').dataset.nilai = totalRup;
    $('pbRencanaTotal').dataset.fmt = 'rp';
    $('pbRencanaJumlah').dataset.nilai = rup.length;
    $('pbRencanaJumlah').dataset.fmt = 'angka';

    var perInstansi = {};
    rup.forEach(function (r) {
      var k = r.instansi || 'Lainnya';
      perInstansi[k] = (perInstansi[k] || 0) + (Number(r.pagu) || 0);
    });
    var top = Object.keys(perInstansi).map(function (k) { return { n: k, v: perInstansi[k] }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 10);
    gambar('pbGrafInstansi', {
      type: 'bar',
      data: { labels: top.map(function (x) { return x.n; }), datasets: [{ data: top.map(function (x) { return x.v; }), backgroundColor: '#5A2FCF', borderRadius: 8 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: function (v) { return rp(v); } } } } }
    });

    var perSumber = {};
    rup.forEach(function (r) {
      var k = r.sumber_dana || 'Lainnya';
      perSumber[k] = (perSumber[k] || 0) + (Number(r.pagu) || 0);
    });
    var sumber = Object.keys(perSumber);
    gambar('pbGrafSumber', {
      type: 'doughnut',
      data: { labels: sumber, datasets: [{ data: sumber.map(function (k) { return perSumber[k]; }), backgroundColor: WARNA }] },
      options: { plugins: { tooltip: { callbacks: { label: function (c) { return c.label + ': ' + rp(c.raw); } } } } }
    });

    // 3. Lelang
    var tender = lelang.filter(function (r) { return r.jenis === 'tender'; }).length;
    var nontender = lelang.filter(function (r) { return r.jenis === 'nontender'; }).length;
    var nilaiKontrak = lelang.reduce(function (s, r) { return s + (Number(r.nilai_kontrak) || 0); }, 0);
    $('pbTender').dataset.nilai = tender;
    $('pbTender').dataset.fmt = 'paket';
    $('pbNontender').dataset.nilai = nontender;
    $('pbNontender').dataset.fmt = 'paket';
    $('pbNilaiKontrak').dataset.nilai = nilaiKontrak;
    $('pbNilaiKontrak').dataset.fmt = 'rp';

    var terbaru = lelang.slice()
      .sort(function (a, b) { return String(b.tanggal_kontrak || '').localeCompare(String(a.tanggal_kontrak || '')); })
      .slice(0, 15);
    $('pbTabelLelang').innerHTML =
      '<thead><tr><th>Jenis</th><th>Nama paket</th><th>Pemenang</th><th>Nilai kontrak</th><th>Status</th></tr></thead><tbody>' +
      (terbaru.length ? terbaru.map(function (r) {
        return '<tr><td>' + (r.jenis === 'tender' ? 'Tender' : 'Nontender') + '</td><td>' + esc(r.nama_paket) +
          '</td><td>' + esc(r.pemenang || '–') + '</td><td>' + (r.nilai_kontrak ? rp(r.nilai_kontrak) : '–') +
          '</td><td>' + esc(r.status || '–') + '</td></tr>';
      }).join('') : '<tr><td colspan="5">Belum ada data lelang untuk pilihan ini.</td></tr>') +
      '</tbody>';

    // 4. Realisasi
    var sudah = nilaiKontrak;
    var belum = Math.max(totalRup - sudah, 0);
    $('pbRealisasi').textContent = totalRup
      ? 'Dari rencana belanja ' + rp(totalRup) + ', yang sudah ada kontraknya ' + rp(sudah) + ' (' + persen(sudah, totalRup) + '). Sisanya ' + rp(belum) + ' belum masuk kontrak.'
      : 'Belum ada rencana belanja untuk pilihan ini, jadi persentasenya belum bisa dihitung.';
    gambar('pbGrafRealisasi', {
      type: 'doughnut',
      data: { labels: ['Sudah ada kontrak', 'Belum ada kontrak'], datasets: [{ data: [sudah, belum], backgroundColor: ['#1CC8C8', '#E4DEFF'] }] },
      options: { plugins: { tooltip: { callbacks: { label: function (c) { return c.label + ': ' + rp(c.raw); } } } } }
    });

    $('pbDiperbarui').textContent = 'Terakhir diperbarui: ' + terakhirDiperbarui();

    animasiSemua();
  }

  async function muat() {
    try {
      var hasil = await Promise.all([
        semua('pembangunan_apbd', 'id,tahun,jenis,total,keterangan'),
        semua('pembangunan_rup', 'id,tahun,bulan,kode_rup,nama_paket,instansi,pagu,sumber_dana,dibuat_pada'),
        semua('pembangunan_lelang', 'id,tahun,bulan,jenis,kode_lelang,nama_paket,instansi,pagu,status,pemenang,nilai_kontrak,tanggal_kontrak,dibuat_pada')
      ]);
      D.apbd = hasil[0];
      D.rup = hasil[1];
      D.lelang = hasil[2];
      isiPilihan();
      render();
    } catch (e) {
      $('pbKosong').hidden = false;
      $('pbKosong').querySelector('p').textContent = 'Data belum bisa dimuat. Coba lagi sebentar lagi.';
    }
  }

  function bagikan() {
    var data = { title: 'Pantau Pembangunan Langkat', url: location.href };
    if (navigator.share) navigator.share(data).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { alert('Tautan disalin'); });
  }

  $('pbTahun').addEventListener('change', render);
  $('pbBulan').addEventListener('change', render);
  $('pbBagi').addEventListener('click', bagikan);

  if (!sb) {
    $('pbKosong').hidden = false;
    $('pbKosong').querySelector('p').textContent = 'Koneksi belum siap.';
    return;
  }
  isiPilihan();
  muat();
})();
