// Rounded panel geometry in metres. Shared by the visible face and its hit target.
export function roundedPanel(width: number, height: number, radius: number, top = true, bottom = true) {
  if (![width, height, radius].every(Number.isFinite) || width <= 0 || height <= 0 || radius < 0) {
    throw new RangeError('A panel needs finite positive dimensions and a nonnegative radius');
  }
  const r = Math.min(radius, width / 2, height / 2);
  const vertices: [number, number, number][] = [[0, 0, 0]];
  // Counterclockwise in XY, facing +Z. Eight segments per corner.
  for (let corner = 0; corner < 4; corner++) {
    const rounded = corner < 2 ? top : bottom;
    const cr = rounded ? r : 0;
    const sx = corner === 0 || corner === 3 ? 1 : -1;
    const sy = corner < 2 ? 1 : -1;
    const count = cr > 0 ? 8 : 0;
    for (let i = 0; i <= count; i++) {
      const angle = (corner + (count ? i / count : 0)) * Math.PI / 2;
      vertices.push([sx * (width / 2 - cr) + cr * Math.cos(angle), sy * (height / 2 - cr) + cr * Math.sin(angle), 0]);
    }
  }
  const triangleIndices: [number, number, number][] = vertices.slice(1).map((_, i) => [0, i + 1, i + 2 < vertices.length ? i + 2 : 1]);
  const triangles = triangleIndices.filter(([a, b, c]) => {
    const [ax, ay] = vertices[a]!; const [bx, by] = vertices[b]!; const [cx, cy] = vertices[c]!;
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 1e-14;
  });
  return {
    vertices,
    triangleIndices: triangles,
    normals: vertices.map((): [number, number, number] => [0, 0, 1]),
    texcoords: vertices.map(([x, y]): [number, number] => [x / width + 0.5, 0.5 - y / height]),
  };
}
