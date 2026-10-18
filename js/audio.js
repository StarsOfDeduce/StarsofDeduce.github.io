(() => {
  const audio = document.getElementById('site-audio');
  const toggle = document.getElementById('audio-toggle');
  const volume = document.getElementById('audio-volume');
  const level = document.getElementById('audio-level');
  const label = document.getElementById('audio-label');
  if (!audio || !toggle || !volume || !level || !label) return;

  const volumeStorageKey = 'sod-audio-volume-v2';
  const positionStorageKey = 'sod-audio-position-v1';
  const safeGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Optional persistence. */ } };
  const storedVolumeValue = safeGet(volumeStorageKey);
  const storedVolume = storedVolumeValue === null ? NaN : Number(storedVolumeValue);
  const initialVolume = Number.isFinite(storedVolume) && storedVolume > 0 && storedVolume <= 1 ? storedVolume : .24;
  let requested = safeGet('sod-audio-enabled') !== 'false';
  let focusMuted = document.hidden || !document.hasFocus();
  let lastPositionSave = 0;
  audio.volume = initialVolume;
  volume.value = String(Math.round(initialVolume * 100));

  function setDisplay(state) {
    const percent = Math.round(audio.volume * 100);
    level.value = String(percent);
    level.textContent = String(percent).padStart(2, '0');
    toggle.classList.toggle('is-playing', state === 'playing');
    toggle.setAttribute('aria-pressed', String(state === 'playing'));
    label.textContent = 'MUSIC';
    toggle.title = state === 'playing' ? '背景音乐播放中' : state === 'blocked' ? '点击启用背景音乐' : '背景音乐已暂停';
  }

  function restorePosition() {
    let saved;
    try { saved = JSON.parse(safeGet(positionStorageKey) || 'null'); } catch { saved = null; }
    if (!saved || !Number.isFinite(saved.time)) return;
    const elapsed = saved.playing ? Math.max(0, (Date.now() - Number(saved.savedAt || Date.now())) / 1000) : 0;
    const position = saved.time + elapsed;
    audio.currentTime = Number.isFinite(audio.duration) && audio.duration > 0 ? position % audio.duration : position;
  }

  function savePosition(force = false) {
    const now = Date.now();
    if (!force && now - lastPositionSave < 700) return;
    lastPositionSave = now;
    safeSet(positionStorageKey, JSON.stringify({
      time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      savedAt: now,
      playing: requested && !audio.paused
    }));
  }

  async function startAudio() {
    if (!requested || focusMuted) return;
    audio.muted = false;
    try {
      await audio.play();
      setDisplay('playing');
    } catch {
      setDisplay('blocked');
    }
  }

  function stopAudio() {
    audio.pause();
    savePosition(true);
    setDisplay('off');
  }

  toggle.addEventListener('click', () => {
    requested = audio.paused;
    safeSet('sod-audio-enabled', String(requested));
    if (requested) startAudio(); else stopAudio();
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value) / 100;
    safeSet(volumeStorageKey, String(audio.volume));
    if (audio.volume > 0 && requested && audio.paused) startAudio();
    setDisplay(audio.paused ? (requested ? 'blocked' : 'off') : 'playing');
  });

  function updateFocusMute() {
    focusMuted = document.hidden || !document.hasFocus();
    audio.muted = focusMuted;
    if (!focusMuted && requested) startAudio();
  }

  document.addEventListener('visibilitychange', updateFocusMute);
  window.addEventListener('blur', updateFocusMute);
  window.addEventListener('focus', updateFocusMute);
  audio.addEventListener('timeupdate', () => savePosition());
  window.addEventListener('pagehide', () => savePosition(true));
  window.addEventListener('beforeunload', () => savePosition(true));
  document.addEventListener('pointerdown', function unlock(event) {
    if (event.target.closest('.audio-module')) return;
    document.removeEventListener('pointerdown', unlock);
    startAudio();
  });

  const initialize = () => {
    restorePosition();
    setDisplay(requested ? 'blocked' : 'off');
    startAudio();
  };
  if (audio.readyState >= 1) initialize();
  else audio.addEventListener('loadedmetadata', initialize, { once: true });
})();
