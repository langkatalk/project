// js/panduan-lpse.js
// Menyisipkan skrip Console LPSE ke halaman panduan, lengkap dengan tombol salin.
(function () {
  'use strict';

  var SKRIP = String.raw`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rapikan = s => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  async function ambilHalaman(url) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return { error: 'HTTP ' + res.status, url };
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const baris = [...doc.querySelectorAll('tr')]
        .map(tr => [...tr.children].map(td => rapikan(td.textContent)).filter(x => x !== ''))
        .filter(b => b.length);
      const tautan = [...doc.querySelectorAll('a[href]')].map(a => ({
        teks: rapikan(a.textContent),
        href: new URL(a.getAttribute('href'), url).href
      }));
      return { url, teks: rapikan(doc.body ? doc.body.textContent : ''), baris, tautan };
    } catch (e) {
      return { error: String(e), url };
    }
  }

  const jenis = location.pathname.includes('/nontender') ? 'nontender' : 'lelang';
  const info = document.body.innerText.match(/Tampilan\s+(\d+)\s+sampai/);
  const hal = info ? Math.ceil(Number(info[1]) / 100) : 1;
  const namaFile = 'lpse-' + jenis + '-hal' + String(hal).padStart(2, '0') + '.json';

  const seen = new Set();
  const paket = [];
  document.querySelectorAll('a[href]').forEach(a => {
    const m = (a.getAttribute('href') || '').match(/\/langkatkab\/(lelang|nontender)\/(\d+)/);
    if (!m || seen.has(m[2])) return;
    seen.add(m[2]);
    paket.push({ kode: m[2], jenis: m[1], href: new URL(a.getAttribute('href'), location.href).href, nama: rapikan(a.textContent) });
  });

  const TAB = ['Pengumuman', 'Peserta', 'Hasil Evaluasi', 'Pemenang', 'Pemenang Berkontrak'];
  const hasil = [];

  for (const p of paket) {
    const rec = { kode: p.kode, jenis: p.jenis, nama_tampil: p.nama, diambil_pada: new Date().toISOString(), halaman: {} };
    try {
      rec.halaman['Pengumuman'] = await ambilHalaman(p.href);
      await sleep(500);

      const doc = new DOMParser().parseFromString(await (await fetch(p.href, { credentials: 'same-origin' })).text(), 'text/html');
      const menu = [...doc.querySelectorAll('a[href]')];
      for (const nama of TAB.slice(1)) {
        const a = menu.find(x => rapikan(x.textContent).toLowerCase() === nama.toLowerCase());
        if (!a) { rec.halaman[nama] = null; continue; }
        rec.halaman[nama] = await ambilHalaman(new URL(a.getAttribute('href'), p.href).href);
        await sleep(500);
      }
      hasil.push(rec);
      console.log('Selesai: ' + p.kode);
    } catch (e) {
      rec.error = String(e);
      hasil.push(rec);
      console.warn('Gagal: ' + p.kode, e);
    }
  }

  const blob = new Blob([JSON.stringify(hasil, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log('Selesai. ' + hasil.length + ' paket. File: ' + namaFile);
})();`;

  var kotak = document.getElementById('skripLpse');
  var tombol = document.getElementById('skripSalin');
  if (kotak) kotak.textContent = SKRIP;

  if (tombol) {
    tombol.addEventListener('click', function () {
      navigator.clipboard.writeText(SKRIP).then(function () {
        tombol.textContent = 'Tersalin';
        setTimeout(function () { tombol.textContent = 'Salin skrip'; }, 1500);
      }).catch(function () {
        alert('Tidak bisa menyalin otomatis. Blok teks skrip lalu tekan Ctrl+C.');
      });
    });
  }
})();
