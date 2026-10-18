(() => {
  const canvases = [...document.querySelectorAll('.signal-polyhedron')];
  if (!canvases.length) return;

  const vertices = [
    [-.76, -.42, -.34], [.18, -.78, -.46], [.74, -.25, -.27],
    [.55, .64, -.18], [-.34, .78, -.08], [-.71, .18, .24],
    [-.16, -.28, .76], [.53, .09, .62]
  ];
  const edges = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],
    [0,6],[1,6],[2,7],[3,7],[4,6],[4,7],[5,6],[5,7],[6,7],
    [0,4],[1,7],[2,5],[3,6]
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rotatePoint([x, y, z], ax, ay, az, stretch) {
    x *= stretch.x; y *= stretch.y; z *= stretch.z;
    let cos = Math.cos(ax), sin = Math.sin(ax);
    [y, z] = [y * cos - z * sin, y * sin + z * cos];
    cos = Math.cos(ay); sin = Math.sin(ay);
    [x, z] = [x * cos + z * sin, -x * sin + z * cos];
    cos = Math.cos(az); sin = Math.sin(az);
    [x, y] = [x * cos - y * sin, x * sin + y * cos];
    return [x, y, z];
  }

  function draw(canvas, now) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const t = reducedMotion ? .8 : now / 1000;
    const stretch = {
      x: 1 + Math.sin(t * .72) * .18,
      y: 1 + Math.sin(t * .72 + 2.1) * .13,
      z: 1 + Math.sin(t * .72 + 4.2) * .2
    };
    const rotated = vertices.map(point => rotatePoint(
      point,
      .58 + Math.sin(t * .48) * .35,
      -.32 + Math.sin(t * .39) * .62,
      t * .24,
      stretch
    ));
    const projected = rotated.map(([x, y, z]) => {
      const perspective = 1.9 / (2.7 - z);
      return [size / 2 + x * size * .56 * perspective, size / 2 + y * size * .56 * perspective, z];
    });

    ctx.clearRect(0, 0, size, size);
    edges
      .map(edge => ({ edge, depth: (projected[edge[0]][2] + projected[edge[1]][2]) / 2 }))
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ edge: [a, b], depth }, index) => {
        ctx.beginPath();
        ctx.moveTo(projected[a][0], projected[a][1]);
        ctx.lineTo(projected[b][0], projected[b][1]);
        ctx.strokeStyle = index % 7 === 0 ? `rgba(18,103,181,${.48 + (depth + 1) * .16})` : `rgba(18,25,34,${.48 + (depth + 1) * .2})`;
        ctx.lineWidth = depth > .1 ? 3.4 : 2.2;
        ctx.stroke();
      });

    projected.forEach(([x, y, z]) => {
      ctx.beginPath();
      ctx.arc(x, y, z > .2 ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = z > .2 ? '#121922' : 'rgba(18,25,34,.62)';
      ctx.fill();
    });
  }

  function frame(now) {
    canvases.forEach(canvas => draw(canvas, now));
    if (!reducedMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
