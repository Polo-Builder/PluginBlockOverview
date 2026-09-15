// Exécuter dans /search?q=chat avec google-navigation.html, les styles Google,
// filter-tabs.css, un mock chrome.storage et filter-tabs.js.
(async () => {
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  try {
    await frame();
    const row = document.querySelector('[data-gsaio-row]');
    const ordered = () => [...row.querySelectorAll(':scope > [data-gsaio-order]')]
      .sort((a, b) => Number(a.dataset.gsaioOrder) - Number(b.dataset.gsaioOrder));
    assert(ordered().map(n => n.textContent.trim()).join(',') === 'Eco,Actualités,Images,Vidéos,Maps', 'Ordre des cinq onglets');
    const bounds = ordered().map(n => n.getBoundingClientRect());
    assert(bounds.every((r, i) => r.width > 0 && Math.abs(r.top - bounds[0].top) < 1 &&
      (!i || r.left >= bounds[i - 1].right - 1)), 'Alignement horizontal sans chevauchement');
    assert(![...row.children].some(n => /^(Tous|Mode IA|Plus|Web)$/.test(n.textContent.trim()) && getComputedStyle(n).display !== 'none'), 'Onglets superflus masqués');
    const eco = ordered()[0].querySelector('a');
    assert(new URL(eco.href).searchParams.get('udm') === 'web', 'Eco utilise le lien Web');
    const news = ordered()[1].querySelector('a');
    const originalHref = news.href;
    results.push('Ordre, alignement, lien Eco et masquage IA : OK');
    document.body.append(document.createElement('aside'));
    await frame();
    assert(ordered().length === 5 && ordered()[1].querySelector('a') === news, 'Mise à jour sans doublons ni remplacement natif');
    window.changes.forEach(fn => fn({state:{newValue:{enabled:false}}}, 'local'));
    await frame();
    assert(!document.querySelector('[data-gsaio-row], [data-gsaio-added], [data-gsaio-hide]'), 'Désactivation restaure la navigation');
    assert(eco.textContent.trim() === 'Web' && news.href === originalHref, 'Libellé et liens natifs restaurés');
    window.changes.forEach(fn => fn({state:{newValue:{enabled:true}}}, 'local'));
    await frame();
    assert(ordered().length === 5, 'Réactivation sans doublon');
    results.push('Mises à jour, désactivation et réactivation : OK');
  } catch (error) { results.push('ÉCHEC : ' + error.message); }
  const output = document.createElement('pre');
  output.id = 'test-results';
  output.textContent = results.join('\n');
  document.body.append(output);
})();
