(() => {
  const canonicalHosts = new Set([
    location.hostname.toLowerCase(),
    'starsofdeduce.github.io'
  ]);

  function resolveLink(link) {
    const rawHref = link?.getAttribute?.('href');
    if (!rawHref) return null;

    let url;
    try { url = new URL(rawHref, location.href); } catch { return null; }

    const isWebLink = url.protocol === 'http:' || url.protocol === 'https:';
    if (!isWebLink) return { url, scope: 'other' };

    const isInternal = canonicalHosts.has(url.hostname.toLowerCase());
    return { url, scope: isInternal ? 'internal' : 'external' };
  }

  function normalizeLink(link) {
    const resolved = resolveLink(link);
    if (!resolved) return;

    link.dataset.linkScope = resolved.scope;
    if (resolved.scope === 'internal') {
      if (link.getAttribute('target') !== '_self') link.setAttribute('target', '_self');
      if (link.hasAttribute('rel')) link.removeAttribute('rel');
    } else if (resolved.scope === 'external') {
      if (link.getAttribute('target') !== '_blank') link.setAttribute('target', '_blank');
      if (link.getAttribute('rel') !== 'noopener noreferrer') link.setAttribute('rel', 'noopener noreferrer');
    }
  }

  function normalizeLinks(root = document) {
    if (root.matches?.('a[href]')) normalizeLink(root);
    root.querySelectorAll?.('a[href]').forEach(normalizeLink);
  }

  normalizeLinks();
  window.applyLinkPolicy = normalizeLinks;

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') normalizeLink(record.target);
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) normalizeLinks(node);
      });
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href', 'target']
  });

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    normalizeLink(link);

    const resolved = resolveLink(link);
    if (resolved?.scope !== 'internal' || link.hasAttribute('download')) return;

    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      event.preventDefault();
      location.assign(resolved.url.href);
    }
  }, true);

  document.addEventListener('auxclick', event => {
    if (event.button !== 1) return;
    const link = event.target.closest?.('a[href]');
    const resolved = resolveLink(link);
    if (resolved?.scope !== 'internal' || link.hasAttribute('download')) return;

    event.preventDefault();
    link.setAttribute('target', '_self');
    location.assign(resolved.url.href);
  }, true);
})();
