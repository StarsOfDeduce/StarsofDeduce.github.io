(() => {
  const audio = document.getElementById('site-audio');
  const toggle = document.getElementById('audio-toggle');
  const volume = document.getElementById('audio-volume');
  const level = document.getElementById('audio-level');
  const label = document.getElementById('audio-label');
  if (!audio || !toggle || !volume || !level || !label) return;

  const volumeStorageKey = 'sod-audio-volume-v2';
  const storedVolumeValue = localStorage.getItem(volumeStorageKey);
  const storedVolume = storedVolumeValue === null ? NaN : Number(storedVolumeValue);
  const initialVolume = Number.isFinite(storedVolume) && storedVolume > 0 && storedVolume <= 1 ? storedVolume : .24;
  let requested = localStorage.getItem('sod-audio-enabled') !== 'false';
  let focusMuted = document.hidden || !document.hasFocus();
  audio.volume = initialVolume;
  volume.value = String(Math.round(initialVolume * 100));

  function setDisplay(state) {
    const percent = Math.round(audio.volume * 100);
    level.value = String(percent);
    level.textContent = String(percent).padStart(2, '0');
    toggle.classList.toggle('is-playing', state === 'playing');
    toggle.setAttribute('aria-pressed', String(state === 'playing'));
    label.textContent = state === 'playing' ? 'MUSIC / ON' : state === 'blocked' ? 'MUSIC / CLICK' : 'MUSIC / OFF';
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
    setDisplay('off');
  }

  toggle.addEventListener('click', () => {
    requested = audio.paused;
    localStorage.setItem('sod-audio-enabled', String(requested));
    if (requested) startAudio(); else stopAudio();
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value) / 100;
    localStorage.setItem(volumeStorageKey, String(audio.volume));
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
  document.addEventListener('pointerdown', function unlock(event) {
    if (event.target.closest('.audio-module')) return;
    document.removeEventListener('pointerdown', unlock);
    startAudio();
  });

  setDisplay(requested ? 'blocked' : 'off');
  startAudio();
})();
