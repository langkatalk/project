// js/menu-hp.js
// Di HP: tombol Beranda dan Menu Kategori. Kategori muncul di panel saat tombol diklik.
// Klik kategori memakai tombol chip asli, jadi filter feed tetap bekerja seperti biasa.
(function () {
  'use strict';

  var chips = document.getElementById('chips');
  if (!chips) return;

  var bar = document.createElement('div');
  bar.className = 'menu-hp-bar';
  bar.innerHTML =
    '<button type="button" class="menu-hp-btn" data-m="beranda">Beranda</button>' +
    '<button type="button" class="menu-hp-btn" data-m="kategori">Menu Kategori ▾</button>';

  var panel = document.createElement('div');
  panel.className = 'menu-hp-panel';
  panel.innerHTML =
    '<div class="menu-hp-kaca">' +
      '<div class="menu-hp-atas"><span>Pilih kategori</span><button type="button" data-m="tutup" aria-label="Tutup">✕</button></div>' +
      '<div class="menu-hp-grid" id="menuHpGrid"></div>' +
    '</div>';

  chips.parentNode.insertBefore(bar, chips);
  document.body.appendChild(panel);

  var grid = document.getElementById('menuHpGrid');

  function tombolAsli() {
    return Array.prototype.slice.call(chips.querySelectorAll('.chip-kat'))
      .filter(function (c) { return c.dataset.filter !== undefined; });
  }

  function sinkronTampilan() {
    var aktif = chips.querySelector('.chip-kat.on');
    var filterAktif = aktif ? aktif.dataset.filter : '';

    // Isi panel dengan salinan tombol kategori
    grid.innerHTML = '';
    tombolAsli().forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.filter = c.dataset.filter;
      b.textContent = c.textContent.trim();
      if (c.dataset.filter === filterAktif) b.classList.add('on');
      grid.appendChild(b);
    });

    bar.querySelector('[data-m="beranda"]').classList.toggle('on', filterAktif === '');
    bar.querySelector('[data-m="kategori"]').classList.toggle('on', filterAktif !== '');
  }

  function bukaPanel(buka) {
    panel.classList.toggle('on', buka);
  }

  bar.addEventListener('click', function (e) {
    var t = e.target.closest('[data-m]');
    if (!t) return;
    if (t.dataset.m === 'beranda') {
      var semua = chips.querySelector('.chip-kat[data-filter=""]');
      if (semua) semua.click();
    }
    if (t.dataset.m === 'kategori') bukaPanel(true);
  });

  panel.addEventListener('click', function (e) {
    if (e.target === panel || (e.target.closest('[data-m="tutup"]'))) return bukaPanel(false);

    var b = e.target.closest('[data-filter]');
    if (!b) return;
    var asli = Array.prototype.find.call(tombolAsli(), function (c) {
      return c.dataset.filter === b.dataset.filter;
    });
    if (asli) asli.click();
    bukaPanel(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') bukaPanel(false);
  });

  // Ikuti perubahan dari tempat lain (misalnya tombol kategori yang berubah saat halaman dibuka)
  new MutationObserver(sinkronTampilan).observe(chips, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class']
  });

  sinkronTampilan();
})();
