// js/halaman.js
// Halaman legal publik: Kebijakan Privasi dan Pedoman Pemberitaan.
// Teks awal ada di sini. Jika direktur sudah menyimpan versi baru di dashboard
// (menu Halaman Legal), versi itu yang tampil.
(function () {
  'use strict';

  var HALAMAN = {
        tentang: {
      judul: 'Tentang Kami',
      teks: [
        '## Tentang Langkatalk',
        'Langkatalk adalah portal berita investigasi, cerita lokal, dan jurnalisme sosial dari Langkat, Sumatera Utara.',
        '',
        '## Misi',
        'Menjadi ruang temu digital yang mengangkat, mendokumentasikan, dan menyebarkan cerita Langkat kepada dunia.',
        '',
        '## Makna nama dan logo',
        'Langkatalk berarti “Langkat yang berbicara”: tentang manusianya, alamnya, peristiwanya, dan harapannya.',
        '',
        '- Huruf L: Kabupaten Langkat',
        '- Aliran sungai: Sungai Wampu',
        '- Siluet perbukitan: Bukit Barisan',
        '- Tombol play: media dan dunia digital',
        '',
        '## Kontak',
        'Email: langkatalk@gmail.com',
        'WhatsApp: 082261275447',
        'Alamat: sedang dalam proses pengurusan'
      ].join('\n')
    },
    masthead: {
      judul: 'Susunan Redaksi',
      teks: [
        '## Susunan Redaksi',
        '- Direktur: M Fakhri',
        '- Pemimpin Redaksi: [isi di dashboard]',
        '- Redaktur: [isi di dashboard]',
        '- Editor: [isi di dashboard]',
        '- Reporter: [isi di dashboard]',
        '',
        '## Kontak redaksi',
        'Email: langkatalk@gmail.com',
        'WhatsApp: 082261275447'
      ].join('\n')
    },
    privasi: {
      judul: 'Kebijakan Privasi',
      teks: [
        'Terakhir diperbarui: 25 November 2026',
        '',
        'Langkatalk (“kami”) menghargai privasi setiap pembaca. Halaman ini menjelaskan data apa yang kami kumpulkan, untuk apa digunakan, dan bagaimana Anda bisa mengendalikannya.',
        '',
        '## 1. Data yang kami kumpulkan',
        '- Saat menyukai berita: nama dan alamat email. Keduanya tidak ditampilkan kepada publik.',
        '- Saat berkomentar: nama, alamat email, dan nomor HP (jika diisi). Hanya nama dan isi komentar yang tampil, setelah disetujui redaksi. Email dan nomor HP tidak pernah ditampilkan.',
        '- Pengenal perangkat: kode acak yang disimpan di peramban Anda. Dipakai untuk mencegah suka dan komentar berulang, bukan untuk mengenali identitas Anda.',
        '- Penyimpanan lokal: daftar berita yang Anda simpan atau sukai, serta draf bagi penulis. Data ini hanya tersimpan di perangkat Anda.',
        '- Statistik kunjungan: jumlah kunjungan per berita, tanpa data pribadi.',
        '',
        '## 2. Untuk apa data digunakan',
        '- Memoderasi komentar, dan menghubungi pengirim jika redaksi perlu memastikan sesuatu.',
        '- Menghitung jumlah suka, komentar, dan kunjungan.',
        '- Mencegah penyalahgunaan, seperti spam dan komentar berulang.',
        '',
        'Kami tidak menjual data pribadi Anda kepada siapa pun.',
        '',
        '## 3. Iklan dan pihak ketiga',
        'Kami menampilkan iklan, termasuk iklan dari Google AdSense. Google dan mitra iklannya dapat menggunakan cookie untuk menampilkan iklan berdasarkan kunjungan Anda ke situs ini dan situs lain. Anda dapat mengatur preferensi iklan melalui pengaturan Google, atau mengunjungi www.aboutads.info.',
        '',
        '## 4. Lama penyimpanan',
        'Data komentar dan suka disimpan selama redaksi memerlukannya untuk moderasi dan arsip, atau sampai Anda meminta penghapusan.',
        '',
        '## 5. Hak Anda',
        'Anda dapat meminta untuk melihat, memperbaiki, atau menghapus data pribadi Anda. Hak ini mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
        '',
        'Ajukan permintaan melalui email langkatalk@gmail.com, dari alamat email yang sama dengan yang Anda gunakan saat berkomentar atau menyukai berita.',
        '',
        '## 6. Keamanan',
        'Situs ini menggunakan koneksi terenkripsi (HTTPS). Akses ke data pribadi dibatasi hanya untuk pengelola yang berwenang.',
        '',
        '## 7. Perubahan kebijakan',
        'Jika kebijakan ini berubah, tanggal pembaruan di atas akan diperbarui.',
        '',
        '## 8. Kontak',
        'Langkatalk',
        'Alamat: sedang dalam proses pengurusan',
        'Email: langkatalk@gmail.com',
        'WhatsApp: 082261275447'
      ].join('\n')
    },

    pedoman: {
      judul: 'Pedoman Pemberitaan',
      teks: [
        'Terakhir diperbarui: 25 November 2026',
        '',
        '## 1. Prinsip dasar',
        'Langkatalk berkomitmen pada jurnalisme yang akurat, berimbang, dan bertanggung jawab. Kami berpegang pada Kode Etik Jurnalistik yang ditetapkan Dewan Pers.',
        '',
        '## 2. Verifikasi',
        '- Setiap fakta penting diperiksa ulang dengan sumber yang berbeda.',
        '- Dokumen atau data yang dijadikan rujukan dicantumkan sumbernya, bila memungkinkan.',
        '- Berita investigasi wajib melalui tahap konfirmasi kepada pihak yang disebut.',
        '',
        '## 3. Keberimbangan',
        'Pihak yang diberitakan diberi kesempatan memberikan tanggapan sebelum berita terbit. Bila tanggapan tidak diperoleh, redaksi mencantumkan bahwa upaya konfirmasi telah dilakukan.',
        '',
        '## 4. Pemisahan fakta dan opini',
        'Tulisan opini diberi label “Opini” dan tidak mewakili sikap resmi redaksi.',
        '',
        '## 5. Narasumber dan identitas',
        'Narasumber yang meminta identitasnya dirahasiakan dilindungi, selama hal itu tidak melanggar hukum. Redaksi menjelaskan alasan merahasiakan identitas bila relevan dengan kepentingan publik.',
        '',
        '## 6. Hak jawab dan koreksi',
        'Sesuai Undang-Undang Nomor 40 Tahun 1999 tentang Pers:',
        '- Pihak yang merasa dirugikan berhak mengajukan hak jawab.',
        '- Hak jawab dimuat tanpa dipungut biaya, dan ditampilkan di halaman berita yang bersangkutan.',
        '- Kesalahan fakta diralat secara terbuka, dengan menyebutkan bagian yang diperbaiki dan waktu perbaikannya.',
        '',
        'Pengajuan hak jawab atau koreksi dapat dikirim ke langkatalk@gmail.com.',
        '',
        '## 7. Label EKSKLUSIF dan BREAKING',
        '- EKSKLUSIF: berita yang diperoleh dan diterbitkan pertama kali oleh Langkatalk.',
        '- BREAKING: berita yang dipilih redaksi karena menyangkut peristiwa yang sedang berlangsung dan penting bagi publik.',
        '',
        '## 8. Pemisahan redaksi dan iklan',
        'Iklan tidak memengaruhi isi pemberitaan. Konten iklan diberi label “Iklan” dan selalu dibedakan dari berita.',
        '',
        '## 9. Komentar pembaca',
        '- Komentar ditinjau sebelum tampil.',
        '- Komentar yang mengandung ujaran kebencian, fitnah, SARA, atau data pribadi orang lain tidak akan disetujui.',
        '- Email dan nomor HP pengirim tidak pernah ditampilkan.',
        '',
        '## 10. Alur penerbitan',
        'Setiap naskah melalui tahapan: draf, diajukan, disunting, ditinjau, lalu terbit. Keputusan penerbitan diambil oleh Pemimpin Redaksi atau Direktur.',
        '',
        '## 11. Ralat dan penarikan berita',
        'Berita yang terbukti keliru akan diralat. Jika berita perlu ditarik, redaksi mencantumkan alasan penarikan di tempat berita tersebut.',
        '',
        '## 12. Kontak',
        'Email: langkatalk@gmail.com',
        'WhatsApp: 082261275447'
      ].join('\n')
    }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Baris berawalan "- " menjadi daftar; baris lain menjadi paragraf
  function blokBiasa(baris) {
    var semuaDaftar = baris.every(function (l) { return l.indexOf('- ') === 0; });
    if (semuaDaftar) {
      return '<ul>' + baris.map(function (l) { return '<li>' + esc(l.slice(2)) + '</li>'; }).join('') + '</ul>';
    }
    return '<p>' + baris.map(function (l) { return esc(l); }).join('<br>') + '</p>';
  }

  // Blok dipisah baris kosong. Blok berawalan "## " menjadi judul.
  function renderTeks(teks) {
    return String(teks || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (blok) {
      var baris = blok.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!baris.length) return '';
      var html = '';
      if (baris[0].indexOf('## ') === 0) {
        html += '<h2>' + esc(baris[0].slice(3)) + '</h2>';
        baris = baris.slice(1);
      }
      return html + (baris.length ? blokBiasa(baris) : '');
    }).join('');
  }

  async function muatHalaman(kunci) {
    var def = HALAMAN[kunci];
    if (!def) return;
    var sb = window.LK && window.LK.sb;
    var teks = def.teks;

    if (sb) {
      var r = await sb.from('site_settings')
        .select('value')
        .eq('key', 'halaman_' + kunci)
        .maybeSingle();
      if (!r.error && r.data && r.data.value) teks = r.data.value;
    }

    document.title = def.judul + ' – Langkatalk';
    var judul = document.getElementById('judul');
    var isi = document.getElementById('isi');
    if (judul) judul.textContent = def.judul;
    if (isi) isi.innerHTML = renderTeks(teks);
  }

  window.LK = window.LK || {};
  window.LK.HALAMAN = HALAMAN;
  window.LK.renderTeks = renderTeks;
  window.LK.muatHalaman = muatHalaman;
})();
