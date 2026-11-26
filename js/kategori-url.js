// js/kategori-url.js
// Membuka beranda dengan kategori tertentu: index.html?kategori=Olahraga
(function () {
  'use strict';

  var kat = new URLSearchParams(location.search).get('kategori');
  if (!kat) return;

  var coba = 0;
  var timer = setInterval(function () {
    coba++;
    var hit = Array.prototype.find.call(
      document.querySelectorAll('#chips .chip-kat'),
      function (c) { return c.dataset.filter === kat; }
    );
    if (hit) {
      clearInterval(timer);
      hit.click();
      history.replaceState(null, '', location.pathname);
    }
    if (coba > 40) clearInterval(timer);
  }, 150);
})();
