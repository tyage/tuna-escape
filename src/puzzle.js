export const DIRECTIONS = {
  right: { x: 1, y: 0, angle: 0, label: '右' },
  down: { x: 0, y: 1, angle: 90, label: '下' },
  left: { x: -1, y: 0, angle: 180, label: '左' },
  up: { x: 0, y: -1, angle: 270, label: '上' },
};

// x/y identify the head; the body extends behind it, against its direction.
export function occupiedCells(fish) {
  const direction = DIRECTIONS[fish.direction];
  return Array.from({ length: fish.length ?? 1 }, (_, i) => ({
    x: fish.x - direction.x * i,
    y: fish.y - direction.y * i,
  }));
}

export function ray(fish, size) {
  const direction = DIRECTIONS[fish.direction];
  const cells = [];
  let x = fish.x + direction.x;
  let y = fish.y + direction.y;
  while (x >= 0 && y >= 0 && x < size && y < size) {
    cells.push({ x, y });
    x += direction.x;
    y += direction.y;
  }
  return cells;
}

export function blocker(fish, fishes, size) {
  for (const cell of ray(fish, size)) {
    const hit = fishes.find(other => other.id !== fish.id && occupiedCells(other).some(body => body.x === cell.x && body.y === cell.y));
    if (hit) return hit;
  }
  return null;
}

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Every newly placed fish can leave immediately. Removing in reverse order is
// therefore a solution, even when subsequent placements obstruct earlier fish.
export function createLevel(level) {
  const size = level < 4 ? 6 : level < 9 ? 7 : 8;
  const target = Math.floor(size * size * Math.min(0.84, 0.72 + level * 0.008));
  const random = randomGenerator(7919 * level + 103);
  const fishes = [];
  const cells = Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) }));
  const occupied = new Set();
  while (occupied.size < target) {
    const choices = [];
    // Start with all three lengths, then mix shorter and longer fish. Candidate
    // bodies must fit without overlap; their entire forward route must be free.
    const length = fishes.length < 3 ? [3, 2, 1][fishes.length] : 1 + Math.floor(random() * 3);
    for (const cell of cells) {
      if (occupied.has(`${cell.x},${cell.y}`)) continue;
      for (const direction of Object.keys(DIRECTIONS)) {
        for (let candidateLength = 1; candidateLength <= length; candidateLength++) {
          const fish = { ...cell, direction, length: candidateLength, id: `fish-${fishes.length}` };
          const fits = occupiedCells(fish).every(body => body.x >= 0 && body.y >= 0 && body.x < size && body.y < size && !occupied.has(`${body.x},${body.y}`));
          if (fits && !blocker(fish, fishes, size)) choices.push(fish);
        }
      }
    }
    if (!choices.length) break;
    // Prefer inward pointing fish, so escaping requires unraveling the school.
    const longest = Math.max(...choices.map(fish => fish.length));
    const preferred = choices.filter(fish => fish.length === longest);
    const inward = preferred.filter(fish => ray(fish, size).length >= 2);
    const pool = inward.length && random() < 0.9 ? inward : preferred;
    const fish = pool[Math.floor(random() * pool.length)];
    fishes.push(fish);
    occupiedCells(fish).forEach(body => occupied.add(`${body.x},${body.y}`));
  }
  return { size, fishes, solution: fishes.map(fish => fish.id).reverse() };
}
