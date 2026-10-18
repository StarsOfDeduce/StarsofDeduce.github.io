(() => {
  const views = ['overview', 'intel', 'systems', 'identity'];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const links = [...document.querySelectorAll('[data-view]')];
  const heroSlides = [...document.querySelectorAll('[data-hero-slide]')];
  const heroDots = [...document.querySelectorAll('[data-hero-to]')];
  let activeHero = 0;
  let heroWheelLocked = false;
  const fallbackPosts = [
    { id: 'tar-v-design', title: 'Tar V 架构与设计：打造 Windows 毛玻璃拟物风启动面板', description: '探索 Electron 进程分离架构、Win32 图标提取与界面设计。', date: '2026-10-10', tags: ['Electron', 'Windows'] },
    { id: 'windhawk-mods', title: '深入 WindHawk：用 C++ 重塑 Windows 11 交互体验', description: '解析动态注入、消息循环拦截与系统交互定制。', date: '2026-10-05', tags: ['C++', 'Windows 11'] },
    { id: 'glassmorphism-web', title: '探索极客美学：从毛玻璃拟物到 Bento Grid 现代化主页', description: '关于个人主页视觉系统与前端实现的阶段性记录。', date: '2026-10-01', tags: ['Web 前端', '设计系统'] }
  ];
  function parseFrontmatter(markdown) {
    const result = { meta: {}, body: markdown };
    if (!markdown.startsWith('---')) return result;
    const end = markdown.indexOf('\n---', 3); if (end === -1) return result;
    const header = markdown.slice(3, end).trim(); result.body = markdown.slice(end + 4).trim();
    header.split('\n').forEach(line => { const separator = line.indexOf(':'); if (separator < 0) return; const key = line.slice(0, separator).trim(); let value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ''); if (key === 'tags') value = value.replace(/^\[|\]$/g, '').split(',').map(tag => tag.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean); result.meta[key] = value; });
    return result;
  }
  function escapeHTML(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function setView(name, updateHash = true) {
    const target = views.includes(name) ? name : 'overview'; panels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === target)); links.forEach(link => link.classList.toggle('is-active', link.dataset.view === target));
    if (updateHash && location.hash !== `#${target}`) history.replaceState(null, '', `#${target}`);
    document.title = `${links.find(link => link.dataset.view === target)?.textContent.trim() || 'StarsofDeduce'} · StarsofDeduce`;
  }
  function setHero(index) {
    if (!heroSlides.length) return;
    activeHero = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeHero;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    heroDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeHero;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', String(isActive));
    });
  }
  document.addEventListener('click', event => { const trigger = event.target.closest('[data-view], [data-jump]'); if (!trigger) return; const target = trigger.dataset.view || trigger.dataset.jump; if (!target) return; event.preventDefault(); setView(target); });
  document.addEventListener('click', event => {
    const link = event.target.closest('.dispatch-card, .forum-row');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(() => { location.href = link.href; }, 285);
  });
  document.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-jump][tabindex]')) { event.preventDefault(); setView(event.target.dataset.jump); } });
  document.getElementById('next-panel')?.addEventListener('click', () => { const current = views.indexOf(location.hash.slice(1)); setView(views[(current + 1 + views.length) % views.length]); });
  heroDots.forEach(dot => dot.addEventListener('click', () => setHero(Number(dot.dataset.heroTo))));
  document.querySelector('.overview-panel')?.addEventListener('wheel', event => {
    if (matchMedia('(max-width: 920px)').matches || !event.currentTarget.classList.contains('is-active') || Math.abs(event.deltaY) < 12) return;
    event.preventDefault();
    if (heroWheelLocked) return;
    heroWheelLocked = true;
    setHero(activeHero + (event.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { heroWheelLocked = false; }, 620);
  }, { passive: false });
  document.addEventListener('keydown', event => {
    if (!document.querySelector('.overview-panel')?.classList.contains('is-active') || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    setHero(activeHero + (event.key === 'ArrowDown' ? 1 : -1));
  });
  window.addEventListener('hashchange', () => setView(location.hash.slice(1), false)); setView(location.hash.slice(1), false);
  async function loadPosts() {
    try {
      const cached = JSON.parse(sessionStorage.getItem('sod-post-index') || 'null');
      if (cached?.savedAt > Date.now() - 15 * 60 * 1000 && Array.isArray(cached.posts)) return cached.posts;
    } catch { /* Storage can be unavailable in privacy modes. */ }
    try {
      const response = await fetch('https://api.github.com/repos/StarsofDeduce/StarsofDeduce.github.io/contents/posts', { headers: { Accept: 'application/vnd.github+json' } }); if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const files = (await response.json()).filter(file => file.name.endsWith('.md'));
      const records = await Promise.all(files.map(async file => { const raw = await fetch(file.download_url).then(result => result.ok ? result.text() : Promise.reject(new Error('download failed'))); const { meta } = parseFrontmatter(raw); return { id: file.name.replace(/\.md$/i, ''), title: meta.title || file.name, description: meta.description || '暂无摘要', date: meta.date || '', tags: Array.isArray(meta.tags) ? meta.tags : [] }; }));
      const posts = records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      try { sessionStorage.setItem('sod-post-index', JSON.stringify({ savedAt: Date.now(), posts })); } catch { /* Optional cache. */ }
      return posts;
    } catch (error) { console.warn('Using local post index fallback:', error); return fallbackPosts; }
  }
  function renderHome(posts) { const target = document.getElementById('home-dispatches'); if (!target) return; target.innerHTML = posts.slice(0, 3).map((post, index) => `<a class="dispatch-card" href="./post.html?id=${encodeURIComponent(post.id)}" target="_self"><span>0${index + 1} / ${escapeHTML(post.tags[0] || 'NOTE')}</span><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.date || 'UNFILED')}</small></a>`).join(''); window.applyLinkPolicy?.(target); }
  function renderForum(posts) { const target = document.getElementById('forum-list'); const count = document.getElementById('archive-count'); if (!target) return; if (count) count.textContent = `${String(posts.length).padStart(2, '0')} 份记录`; target.innerHTML = posts.map((post, index) => `<a class="forum-row" href="./post.html?id=${encodeURIComponent(post.id)}" target="_self"><span class="forum-index">${String(index + 1).padStart(2, '0')}</span><div class="forum-title"><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.tags.join(' / ') || '未分类')}</small></div><time>${escapeHTML(post.date || '—')}</time><span class="forum-status">${index === 0 ? 'NEW TRANSMISSION' : 'ARCHIVED'}</span></a>`).join(''); window.applyLinkPolicy?.(target); }
  renderHome(fallbackPosts);
  renderForum(fallbackPosts);
  loadPosts().then(posts => { renderHome(posts); renderForum(posts); });
  const systemIndex = document.getElementById('system-index');
  const signalCharacters = '0123456789ABCDEF?#';
  function nextSystemIndex() {
    if (!systemIndex) return;
    let frame = 0;
    const settled = String(Math.floor(2100 + Math.random() * 7700)).padStart(4, '0');
    const scramble = window.setInterval(() => {
      frame += 1;
      systemIndex.textContent = frame < 7
        ? Array.from({ length: 4 }, () => signalCharacters[Math.floor(Math.random() * signalCharacters.length)]).join('')
        : settled;
      if (frame >= 7) {
        window.clearInterval(scramble);
        systemIndex.closest('.signal-meter')?.setAttribute('aria-label', `系统索引 ${settled}`);
      }
    }, 78);
  }
  nextSystemIndex();
  window.setInterval(nextSystemIndex, 2400);
  const clock = document.getElementById('clock'); function updateClock() { if (clock) clock.textContent = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); } updateClock(); setInterval(updateClock, 1000);
  window.addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));
})();
