/* Evler Ligi - yönlendirme ve başlangıç. */
(function () {
  'use strict';
  const L = window.Lig, V = window.Views;
  const app = document.getElementById('app');
  const pick = document.getElementById('teamPick');
  const KEY = 'evlerligi.takim';
  let S = null;
  let fxFilter = 'all';

  function getMy() {
    try { return localStorage.getItem(KEY) || null; } catch (e) { return null; }
  }
  function setMy(id) {
    try { localStorage.setItem(KEY, id); } catch (e) { /* özel pencere vb. */ }
    S.my = id;
  }

  function build(league) {
    const I = L.buildIndex(league);
    const my = getMy();
    S = {
      I,
      my: my && I.teams[my] ? my : null,
      today: L.todayISO(),
      table: L.standings(I),
      post: L.postponeInfo(I),
      scorers: L.scorerTable(I),
      admin: !!(window.Admin && window.Admin.active()),
    };
    S.cur = L.currentRound(I, S.today);
  }

  function fillPicker() {
    pick.innerHTML = '<option value="">Takımını seç</option>' +
      S.I.league.teams.map((t) => '<option value="' + V.esc(t.id) + '">' + V.esc(t.name) + '</option>').join('');
    pick.value = S.my || '';
  }

  function render(keepScroll) {
    if (!S) return;
    const seg = location.hash.replace(/^#\/?/, '').split('/');
    const page = seg[0] || 'ana';
    let html, after, tab = page;
    switch (page) {
      case 'fikstur':
        html = V.fixture(S, fxFilter);
        after = () => {
          if (keepScroll) return;
          const el = document.getElementById('hafta-' + S.cur.round);
          if (el) el.scrollIntoView({ block: 'start' });
        };
        break;
      case 'tablo': html = V.tablePage(S); break;
      case 'takim':
        tab = 'takim';
        html = seg[1] ? V.team(S, seg[1]) : S.my ? V.team(S, S.my) : V.teamPicker(S);
        break;
      case 'kurallar': html = V.rules(S); break;
      default: tab = 'ana'; html = V.home(S);
    }
    app.innerHTML = html;
    document.querySelectorAll('.tabs a').forEach((a) => {
      a.classList.toggle('on', a.dataset.tab === tab);
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (!keepScroll) window.scrollTo(0, 0);
    if (after) after();
  }

  function choose(id) {
    setMy(id);
    fillPicker();
    if (location.hash === '#/takim/' + id) render(true);
    else location.hash = '#/takim/' + id;
  }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) { fxFilter = f.dataset.filter; render(true); return; }
    const p = e.target.closest('[data-pick]');
    if (p) choose(p.dataset.pick);
  });
  pick.addEventListener('change', () => { if (pick.value) choose(pick.value); });
  window.addEventListener('hashchange', () => render(false));

  /* Admin modülü yeni veriyi buradan yükler (kayıttan sonra / girişte). */
  window.EvlerApp = {
    state: () => S,
    load(league) { build(league); fillPicker(); render(true); },
  };

  fetch('data/league.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((league) => {
      build(league); fillPicker(); render(false);
      if (window.Admin) window.Admin.restore();
    })
    .catch((err) => {
      app.innerHTML = '<div class="errbox"><h2>Veri yüklenemedi</h2><p>data/league.json okunamadı (' + V.esc(err.message) +
        ').</p><p>Dosyayı çift tıklayıp açtıysan olmaz; yerel sunucu gerekir:<br><code>python -m http.server 8000</code> ve <code>http://localhost:8000</code></p>' +
        '<p>JSON hatalıysa (virgül, tırnak) README\'deki kontrol adımına bak.</p></div>';
    });
})();
