// js/redaksi-halus.js
// Isi Ruang Redaksi memudar masuk setelah status login diketahui, tanpa kedip layar login.
(function () {
  'use strict';
  var root = document.documentElement;
  var sb = window.LK && window.LK.sb;

  function buka() {
    requestAnimationFrame(function () {
      setTimeout(function () { root.classList.remove('rd-menunggu'); }, 250);
    });
  }

  if (!sb) { buka(); return; }
  sb.auth.getSession().then(buka, buka);
  setTimeout(buka, 1500); // jaga-jaga kalau koneksi lambat
})();
