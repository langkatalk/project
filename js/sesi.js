// js/sesi.js
// Logout otomatis jika tidak ada aktivitas selama 20 menit.
// Aktivitas di tab mana pun dihitung, karena disimpan di localStorage bersama.
(function () {
  'use strict';

  var BATAS_MS = 20 * 60 * 1000;
  var PERIKSA_MS = 30 * 1000;
  var KUNCI_AKTIF = 'lk_aktif_terakhir';

  function sb() { return window.LK && window.LK.sb; }

  function catatAktif() {
    try { localStorage.setItem(KUNCI_AKTIF, String(Date.now())); } catch (e) {}
  }

  function sudahLewat() {
    var t = Number(localStorage.getItem(KUNCI_AKTIF) || 0);
    return t > 0 && (Date.now() - t) > BATAS_MS;
  }

  async function keluarOtomatis() {
    var c = sb();
    try { if (c) await c.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem(KUNCI_AKTIF); } catch (e) {}
    alert('Sesi berakhir karena tidak ada aktivitas selama 20 menit. Silakan masuk lagi.');
    location.href = 'redaksi.html';
  }

  async function adaSesi() {
    var c = sb();
    if (!c) return false;
    var s = await c.auth.getSession();
    return !!(s.data && s.data.session);
  }

  async function periksa() {
    if (!(await adaSesi())) return;
    if (sudahLewat()) return keluarOtomatis();
  }

  function mulai() {
    if (!localStorage.getItem(KUNCI_AKTIF)) catatAktif();

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function (ev) {
      document.addEventListener(ev, catatAktif, { passive: true, capture: true });
    });

    periksa();
    setInterval(periksa, PERIKSA_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
