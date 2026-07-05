export function segmentIntersectsBox(start, end, center, halfExtents) {
  const dir = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };

  let tMin = 0;
  let tMax = 1;

  for (const axis of ['x', 'y', 'z']) {
    const d = dir[axis];
    const o = start[axis];
    const c = center[axis];
    const h = halfExtents[axis];

    if (Math.abs(d) < 1e-9) {
      if (o < c - h || o > c + h) {
        return false;
      }
      continue;
    }

    const invD = 1 / d;
    let t1 = ((c - h) - o) * invD;
    let t2 = ((c + h) - o) * invD;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return false;
    }
  }

  return true;
}
