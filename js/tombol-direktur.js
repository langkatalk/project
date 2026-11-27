// js/tombol-direktur.js
// Tombol khusus direktur di Ruang Redaksi: Atur Pantau Pembangunan dan Pengaturan Situs.
(async function () {
  'use strict';

  var sb = window.LK && window.LK.sb;
  if (!sb) return;

  var s = await sb.auth.getSession();
  var user = s.data && s.data.session && s.data.session.user;
  if (!user) return;

  var p = await sb.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
  if (!(p.data && p.data.role === 'direktur' && p.data.is_active !== false)) return;
  if (document.getElementById('btnAturPembangunan')) return;

  var tulis = [...document.querySelectorAll('a,button')].find(function (el) {
    return /\+\s*Tulis/.test(el.textContent);
  });

  var tombol = [
    { id: 'btnAturPembangunan', href: 'atur-pembangunan.html', teks: 'Atur Pantau Pembangunan' },
    { id: 'btnPengaturanSitus', href: 'pengaturan-situs.html', teks: 'Pengaturan Situs' }
  ];

  tombol.forEach(function (t) {
    var a = document.createElement('a');
    a.id = t.id;
    a.href = t.href;
    a.textContent = t.teks;
    a.className = 'btn btn-kecil';
    a.style.cssText = 'margin-right:8px;background:#fff;color:#5A2FCF;border:1.5px solid #E4DEFF;';
    if (tulis && tulis.parentNode) tulis.parentNode.insertBefore(a, tulis);
    else document.querySelector('.rd-header').appendChild(a);
  });
})();
