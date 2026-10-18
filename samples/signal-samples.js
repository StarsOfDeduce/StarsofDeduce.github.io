(() => {
  const value = document.getElementById('sample-index');
  const characters = '0123456789ABCDEF?#';
  function scramble() {
    let frame = 0;
    const target = String(Math.floor(2100 + Math.random() * 7700)).padStart(4, '0');
    const timer = setInterval(() => {
      frame += 1;
      value.textContent = frame < 7 ? Array.from({ length: 4 }, () => characters[Math.floor(Math.random() * characters.length)]).join('') : target;
      if (frame >= 7) clearInterval(timer);
    }, 78);
  }
  scramble();
  setInterval(scramble, 2400);
})();
