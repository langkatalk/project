// api/siaga.js
// Siaga Langkat: prakiraan per kecamatan (BMKG) dan peringatan dini (BMKG nowcast).
// Hasil disimpan sementara di server, supaya BMKG tidak dihubungi setiap ada pengunjung.
const RSS_URL = 'https://cuaca.bmkg.go.id/data/public/cap/feed/id/rss.xml';
const PRAKIRAAN_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=';
const MENIT = 60 * 1000;

const KECAMATAN = [
  { nama: 'Bahorok', kode: '12.05.01.1001', alias: ['BAHOROK'] },
  { nama: 'Salapian', kode: '12.05.02.1007', alias: ['SALAPIAN'] },
  { nama: 'Kuala', kode: '12.05.03.1001', alias: ['KUALA'] },
  { nama: 'Sei Bingai', kode: '12.05.04.1005', alias: ['SEI BINGAI'] },
  { nama: 'Binjai', kode: '12.05.05.1001', alias: ['BINJAI'] },
  { nama: 'Selesai', kode: '12.05.06.1001', alias: ['SELESAI'] },
  { nama: 'Stabat', kode: '12.05.07.1010', alias: ['STABAT'] },
  { nama: 'Wampu', kode: '12.05.08.1001', alias: ['WAMPU'] },
  { nama: 'Secanggang', kode: '12.05.09.1004', alias: ['SECANGGANG'] },
  { nama: 'Hinai', kode: '12.05.10.1008', alias: ['HINAI'] },
  { nama: 'Tanjung Pura', kode: '12.05.11.1005', alias: ['TANJUNG PURA'] },
  { nama: 'Padang Tualang', kode: '12.05.12.1006', alias: ['PADANG TUALANG'] },
  { nama: 'Gebang', kode: '12.05.13.1001', alias: ['GEBANG'] },
  { nama: 'Babalan', kode: '12.05.14.1001', alias: ['BABALAN'] },
  { nama: 'Pangkalan Susu', kode: '12.05.15.1009', alias: ['PANGKALAN SUSU'] },
  { nama: 'Besitang', kode: '12.05.16.1009', alias: ['BESITANG'] },
  { nama: 'Sei Lepan', kode: '12.05.17.1002', alias: ['SEI LEPAN'] },
  { nama: 'Berandan Barat', kode: '12.05.18.1001', alias: ['BERANDAN BARAT', 'BRANDAN BARAT'] },
  { nama: 'Batang Serangan', kode: '12.05.19.1001', alias: ['BATANG SERANGAN'] },
  { nama: 'Sawit Seberang', kode: '12.05.20.1001', alias: ['SAWIT SEBERANG'] },
  { nama: 'Sirapit', kode: '12.05.21.2003', alias: ['SIRAPIT'] },
  { nama: 'Kutambaru', kode: '12.05.22.2008', alias: ['KUTAMBARU'] },
  { nama: 'Pematang Jaya', kode: '12.05.23.2005', alias: ['PEMATANG JAYA'] }
];

const cache = { rss: null, cap: new Map(), cuaca: new Map() };

function ambilCache(peta, kunci, usia) {
  const e = peta.get ? peta.get(kunci) : peta;
  return e && Date.now() - e.waktu < usia ? e.data : null;
}

async function ambilTeks(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function ambilTag(blok, tag) {
  const m = blok.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
  return m ? decode(m[1].trim()) : '';
}

// Daftar peringatan dini BMKG untuk Sumatera Utara
async function peringatanSumut() {
  const hit = ambilCache(cache.rss, 'rss', 3 * MENIT);
  if (hit) return hit;
  const xml = await ambilTeks(RSS_URL);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(m => ({
      judul: ambilTag(m[1], 'title'),
      link: ambilTag(m[1], 'link'),
      deskripsi: ambilTag(m[1], 'description')
    }))
    .filter(it => /Sumatera Utara/i.test(it.judul));
  cache.rss = { data: items, waktu: Date.now() };
  return items;
}

// Detail CAP: tingkat keparahan dan waktu berakhir
async function detailCap(link) {
  const hit = ambilCache(cache.cap, link, 30 * MENIT);
  if (hit) return hit;
  const teks = await ambilTeks(link);
  const data = { keparahan: ambilTag(teks, 'severity'), berakhir: ambilTag(teks, 'expires') };
  cache.cap.set(link, { data, waktu: Date.now() });
  return data;
}

// Kecamatan Langkat yang disebut dalam deskripsi peringatan
function kecamatanTerdampak(deskripsi) {
  const m = deskripsi.match(/khususnya di ([^.]*)\./i);
  if (!m) return [];
  const daftar = m[1].split(',').map(s => s.trim().toUpperCase());
  return KECAMATAN.filter(k => k.alias.some(a => daftar.includes(a)));
}

// Prakiraan terkini: slot 3 jam terakhir yang sudah lewat
async function prakiraan(kode) {
  const hit = ambilCache(cache.cuaca, kode, 30 * MENIT);
  if (hit) return hit;
  const json = await (await fetch(PRAKIRAAN_URL + kode)).json();
  const semua = ((json.data && json.data[0] && json.data[0].cuaca) || []).flat();
  const sekarang = Date.now();
  let pilih = null;
  for (const s of semua) {
    const t = Date.parse(s.utc_datetime.replace(' ', 'T') + 'Z');
    if (t <= sekarang) pilih = s;
  }
  pilih = pilih || semua[0];
  const data = pilih ? {
    suhu: pilih.t,
    cuaca: pilih.weather_desc,
    ikon: pilih.image,
    waktu: pilih.local_datetime
  } : null;
  cache.cuaca.set(kode, { data, waktu: Date.now() });
  return data;
}

function statusDari(keparahan) {
  if (keparahan === 'Extreme' || keparahan === 'Severe') return 'merah';
  if (keparahan === 'Moderate') return 'kuning';
  return 'biru';
}

const URUTAN = { biru: 1, kuning: 2, merah: 3 };

module.exports = async function handler(req, res) {
  try {
    const sekarang = Date.now();
    let rssOk = true;
    const [peringatan, cuacaList] = await Promise.all([
      peringatanSumut().catch(() => { rssOk = false; return []; }),
      Promise.all(KECAMATAN.map(k => prakiraan(k.kode).catch(() => null)))
    ]);

    const per = new Map(KECAMATAN.map(k => [k.nama, []]));
    for (const it of peringatan) {
      const cap = await detailCap(it.link).catch(() => null);
      if (!cap) continue;
      if (cap.berakhir && Date.parse(cap.berakhir) < sekarang) continue;
      for (const k of kecamatanTerdampak(it.deskripsi)) {
        per.get(k.nama).push({ judul: it.judul, keparahan: cap.keparahan, berakhir: cap.berakhir });
      }
    }

    const kecamatan = KECAMATAN.map((k, i) => {
      const daftar = per.get(k.nama);
      const status = daftar.reduce(
        (m, p) => URUTAN[statusDari(p.keparahan)] > URUTAN[m] ? statusDari(p.keparahan) : m,
        'biru'
      );
      return { nama: k.nama, status, cuaca: cuacaList[i], peringatan: daftar };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
    res.status(200).json({
      sumber: 'BMKG',
      diperbarui: new Date().toISOString(),
      peringatanTersedia: rssOk,
      kecamatan
    });
  } catch (e) {
    res.status(502).json({ pesan: 'Data BMKG belum bisa dimuat' });
  }
}
