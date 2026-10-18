(() => {
  const views = ['overview', 'intel', 'systems', 'identity'];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const links = [...document.querySelectorAll('[data-view]')];
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
    document.title = `${links.find(link => link.dataset.view === target)?.textContent.trim() || 'StarsOfDeduce'} · StarsOfDeduce`;
  }
  document.addEventListener('click', event => { const trigger = event.target.closest('[data-view], [data-jump]'); if (!trigger) return; const target = trigger.dataset.view || trigger.dataset.jump; if (!target) return; event.preventDefault(); setView(target); });
  document.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-jump][tabindex]')) { event.preventDefault(); setView(event.target.dataset.jump); } });
  document.getElementById('next-panel')?.addEventListener('click', () => { const current = views.indexOf(location.hash.slice(1)); setView(views[(current + 1 + views.length) % views.length]); });
  window.addEventListener('hashchange', () => setView(location.hash.slice(1), false)); setView(location.hash.slice(1), false);
  async function loadPosts() {
    try {
      const response = await fetch('https://api.github.com/repos/StarsOfDeduce/StarsofDeduce.github.io/contents/posts', { headers: { Accept: 'application/vnd.github+json' } }); if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const files = (await response.json()).filter(file => file.name.endsWith('.md'));
      const records = await Promise.all(files.map(async file => { const raw = await fetch(file.download_url).then(result => result.ok ? result.text() : Promise.reject(new Error('download failed'))); const { meta } = parseFrontmatter(raw); return { id: file.name.replace(/\.md$/i, ''), title: meta.title || file.name, description: meta.description || '暂无摘要', date: meta.date || '', tags: Array.isArray(meta.tags) ? meta.tags : [] }; }));
      return records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } catch (error) { console.warn('Using local post index fallback:', error); return fallbackPosts; }
  }
  function renderHome(posts) { const target = document.getElementById('home-dispatches'); if (!target) return; target.innerHTML = posts.slice(0, 3).map((post, index) => `<a class="dispatch-card" href="./post.html?id=${encodeURIComponent(post.id)}"><span>0${index + 1} / ${escapeHTML(post.tags[0] || 'NOTE')}</span><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.date || 'UNFILED')}</small></a>`).join(''); }
  function renderForum(posts) { const target = document.getElementById('forum-list'); const count = document.getElementById('archive-count'); if (!target) return; if (count) count.textContent = `${String(posts.length).padStart(2, '0')} 份记录`; target.innerHTML = posts.map((post, index) => `<a class="forum-row" href="./post.html?id=${encodeURIComponent(post.id)}"><span class="forum-index">${String(index + 1).padStart(2, '0')}</span><div class="forum-title"><strong>${escapeHTML(post.title)}</strong><small>${escapeHTML(post.tags.join(' / ') || '未分类')}</small></div><time>${escapeHTML(post.date || '—')}</time><span class="forum-status">${index === 0 ? 'NEW TRANSMISSION' : 'ARCHIVED'}</span></a>`).join(''); }
  loadPosts().then(posts => { renderHome(posts); renderForum(posts); document.getElementById('system-index').textContent = String(2500 + posts.length * 17); });
  const clock = document.getElementById('clock'); function updateClock() { if (clock) clock.textContent = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); } updateClock(); setInterval(updateClock, 1000);
})();
