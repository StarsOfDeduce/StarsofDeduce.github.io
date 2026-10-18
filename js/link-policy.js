(() => {
  function normalizeLinks(root = document) {
    root.querySelectorAll?.('a[href]').forEach(link => {
      const rawHref = link.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#')) {
        link.target = '_self';
        link.removeAttribute('rel');
        return;
      }

      let url;
      try { url = new URL(rawHref, location.href); } catch { return; }
      if (url.origin === location.origin) {
        link.target = '_self';
        link.removeAttribute('rel');
      } else if (url.protocol === 'http:' || url.protocol === 'https:') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  }

  normalizeLinks();
  window.applyLinkPolicy = normalizeLinks;

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin === location.origin) link.target = '_self';
  }, true);
})();
