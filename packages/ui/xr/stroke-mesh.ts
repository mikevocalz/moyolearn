/** Flat ink geometry for Metal, without ViroPolyline's shader modifiers. */
type Vec3 = [number, number, number];
export interface StrokeMesh { vertices: Vec3[]; normals: Vec3[]; triangleIndices: Vec3[] }

export function strokeMesh(points: readonly Vec3[], thickness: number): StrokeMesh {
  const mesh: StrokeMesh = { vertices: [], normals: [], triangleIndices: [] };
  if (!Number.isFinite(thickness) || thickness <= 0) return mesh;
  const clean: Vec3[] = [];
  for (const p of points) {
    if (!p.every(Number.isFinite)) return mesh;
    const last = clean.at(-1);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-8) clean.push(p);
  }
  if (!clean.length) return mesh;
  const half = thickness / 2;
  if (clean.length === 1) {
    const [x, y, z] = clean[0]!;
    mesh.vertices.push([x-half,y-half,z], [x+half,y-half,z], [x+half,y+half,z], [x-half,y+half,z]);
    mesh.triangleIndices.push([0,1,2], [0,2,3]);
  } else {
    const directions = clean.slice(1).map((p, i) => {
      const a = clean[i]!;
      const length = Math.hypot(p[0]-a[0], p[1]-a[1]);
      return [(p[0]-a[0])/length, (p[1]-a[1])/length] as const;
    });
    clean.forEach(([x,y,z], i) => {
      const before = directions[Math.max(0,i-1)]!;
      const after = directions[Math.min(i,directions.length-1)]!;
      let nx = -before[1]-after[1], ny = before[0]+after[0];
      const length = Math.hypot(nx,ny);
      if (length < 1e-6) { nx = -after[1]; ny = after[0]; }
      else { nx /= length; ny /= length; }
      // Limit the miter at sharp corners so reversal never produces an infinite spike.
      const scale = Math.min(half / Math.max(0.001, nx * -after[1] + ny * after[0]), thickness);
      mesh.vertices.push([x+nx*scale,y+ny*scale,z], [x-nx*scale,y-ny*scale,z]);
      if (i) { const j = i*2; mesh.triangleIndices.push([j-2,j-1,j], [j,j-1,j+1]); }
    });
  }
  mesh.normals = mesh.vertices.map(() => [0,0,1]);
  return mesh;
}
