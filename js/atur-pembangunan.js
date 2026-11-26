// js/atur-pembangunan.js
// Halaman khusus Direktur: unggah CSV SIRUP, LPSE, dan APBD ke Pantau Pembangunan.
(function () {
  'use strict';

  var sb = window.LK && window.LK.sb;

  var SKEMA = {
    rup: {
      tabel: 'pembangunan_rup', kunci: 'kode_rup',
      kolom: ['tahun','bulan','kode_rup','nama_paket','instansi','pagu','metode','sumber_dana'],
      wajib: ['tahun','kode_rup','nama_paket','pagu']
    },
    lelang: {
      tabel: 'pembangunan_lelang', kunci: 'kode_lelang',
      kolom: ['tahun','bulan','jenis','kode_lelang','nama_paket','instansi','pagu','hps','status','pemenang','alamat_pemenang','nilai_kontrak','tanggal_kontrak'],
      wajib: ['tahun','jenis','kode_lelang','nama_paket']
    },
    apbd: {
      tabel: 'pembangunan_apbd', kunci: 'tahun,jenis',
      kolom: ['tahun','jenis','total','keterangan'],
      wajib: ['tahun','jenis','total']
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var hasil = [];

  // Membaca CSV. Mendukung pemisah koma atau titik koma, dan teks dalam tanda kutip.
  function bacaCsv(teks) {
    teks = teks.replace(/^\uFEFF/, '');
    var baris1 = teks.split(/\r?\n/)[0] || '';
    var pemisah = (baris1.indexOf(';') !== -1 && baris1.indexOf(',') === -1) ? ';' : ',';
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < teks.length; i++) {
      var c = teks[i];
      if (q) {
        if (c === '"') { if (teks[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === pemisah) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && teks[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }

  function angka(x) {
    var s = String(x == null ? '' : x).replace(/[^0-9-]/g, '');
    return s === '' || s === '-' ? null : Number(s);
  }

  function tanggal(x) {
    var s = String(x || '').trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function validasi(jenis, rows) {
    var sk = SKEMA[jenis];
    var judul = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var hilang = sk.wajib.filter(function (k) { return judul.indexOf(k) === -1; });
    if (hilang.length) return { error: 'Judul kolom belum lengkap. Kurang: ' + hilang.join(', ') };

    var data = [], salah = [];
    rows.slice(1).forEach(function (r, idx) {
      var o = {};
      judul.forEach(function (k, i) { o[k] = (r[i] || '').trim(); });

      var baris = idx + 2;
      if (sk.wajib.some(function (k) { return !o[k]; })) { salah.push('Baris ' + baris + ': ada kolom wajib yang kosong.'); return; }

      var out = {};
      sk.kolom.forEach(function (k) { if (k in o) out[k] = o[k] === '' ? null : o[k]; });
      ['tahun', 'bulan', 'pagu', 'hps', 'nilai_kontrak', 'total'].forEach(function (k) {
        if (k in out) out[k] = angka(out[k]);
      });
      if ('tanggal_kontrak' in out) out.tanggal_kontrak = tanggal(out.tanggal_kontrak);
      if (out.jenis) out.jenis = String(out.jenis).toLowerCase();
      if (jenis === 'apbd' && ['rapbd','apbd','papbd'].indexOf(out.jenis) === -1) {
        salah.push('Baris ' + baris + ': jenis harus rapbd, apbd, atau papbd.'); return;
      }
      if (jenis === 'lelang' && ['tender','nontender'].indexOf(out.jenis) === -1) {
        salah.push('Baris ' + baris + ': jenis harus tender atau nontender.'); return;
      }
      if (!out.tahun) { salah.push('Baris ' + baris + ': tahun tidak valid.'); return; }
      data.push(out);
    });
    return { data: data, salah: salah };
  }

  function tampilPratinjau(data, salah) {
    var box = $('apPratinjau');
    if (!data.length) { box.innerHTML = ''; return; }
    var kolom = Object.keys(data[0]).slice(0, 5);
    var isi = data.slice(0, 5).map(function (r) {
      return '<tr>' + kolom.map(function (k) { return '<td>' + (r[k] == null ? '–' : String(r[k]).replace(/</g, '&lt;')) + '</td>'; }).join('') + '</tr>';
    }).join('');
    box.innerHTML = '<p><b>' + data.length + ' baris siap disimpan.</b> Pratinjau 5 baris pertama:</p>' +
      '<div style="overflow-x:auto"><table class="ap-tabel"><thead><tr>' +
      kolom.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr></thead><tbody>' + isi + '</tbody></table></div>' +
      (salah.length ? '<p class="ap-err">' + salah.slice(0, 5).join(' ') + (salah.length > 5 ? ' …' : '') + '</p>' : '');
  }

  async function saatFileDipilih() {
    var f = $('apFile').files[0];
    $('apErr').textContent = ''; $('apOk').textContent = '';
    hasil = [];
    $('apSimpan').disabled = true;
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { $('apErr').textContent = 'Pilih file berformat .csv'; return; }
    var rows = bacaCsv(await f.text());
    if (rows.length < 2) { $('apErr').textContent = 'File kosong atau hanya berisi judul kolom.'; return; }

    var jenis = $('apJenis').value;
    var v = validasi(jenis, rows);
    if (v.error) { $('apErr').textContent = v.error; return; }
    if (!v.data.length) { $('apErr').textContent = 'Tidak ada baris yang bisa dibaca.'; return; }

    hasil = v.data;
    tampilPratinjau(v.data, v.salah);
    $('apSimpan').disabled = false;
  }

  async function simpan() {
    var jenis = $('apJenis').value;
    var sk = SKEMA[jenis];
    $('apSimpan').disabled = true;
    $('apErr').textContent = ''; $('apOk').textContent = 'Menyimpan…';
    try {
      // Dikirim per 500 baris supaya tidak terlalu berat
      for (var i = 0; i < hasil.length; i += 500) {
        var potong = hasil.slice(i, i + 500);
        var r = await sb.from(sk.tabel).upsert(potong, { onConflict: sk.kunci });
        if (r.error) throw new Error(r.error.message);
      }
      $('apOk').textContent = hasil.length + ' baris tersimpan. Pantau Pembangunan akan menampilkan data ini.';
      $('apFile').value = '';
      hasil = [];
      $('apPratinjau').innerHTML = '';
    } catch (e) {
      $('apErr').textContent = 'Gagal menyimpan: ' + e.message;
      $('apSimpan').disabled = false;
      $('apOk').textContent = '';
    }
  }

  async function cekDirektur() {
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) return { masuk: false };
    var p = await sb.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    return { masuk: true, direktur: !!(p.data && p.data.role === 'direktur' && p.data.is_active !== false) };
  }

  async function mulai() {
    if (!sb) { $('apAkses').innerHTML = '<p>Koneksi belum siap.</p>'; return; }
    var c = await cekDirektur();
    if (!c.masuk) { $('apAkses').innerHTML = '<p>Masuk dulu lewat <a href="redaksi.html">Ruang Redaksi</a>.</p>'; return; }
    if (!c.direktur) { $('apAkses').innerHTML = '<p>Halaman ini hanya untuk direktur.</p>'; return; }

    $('apAkses').hidden = true;
    $('apPanel').hidden = false;
    $('apFile').addEventListener('change', saatFileDipilih);
    $('apJenis').addEventListener('change', saatFileDipilih);
    $('apSimpan').addEventListener('click', simpan);
  }

  mulai();
})();
