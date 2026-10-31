import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, blocker, ray, occupiedCells, DIRECTIONS } from '../src/puzzle.js';

test('long bodies extend behind the head in all four directions', () => {
  for (const [direction, vector] of Object.entries(DIRECTIONS)) {
    const fish = { id: 'a', x: 3, y: 3, direction, length: 3 };
    assert.deepEqual(occupiedCells(fish), [0, 1, 2].map(i => ({ x: 3 - vector.x * i, y: 3 - vector.y * i })));
    assert.equal(blocker(fish, [fish], 7), null, 'a fish never blocks itself');
  }
});

test('the tail and middle of another fish block a route even when its head is elsewhere', () => {
  const fish = { id: 'a', x: 0, y: 2, direction: 'right', length: 1 };
  const crossing = { id: 'b', x: 3, y: 0, direction: 'up', length: 3 };
  assert.equal(blocker(fish, [fish, crossing], 6), crossing, 'tail at (3,2) blocks the route');
  const towardMiddle = { ...fish, y: 1 };
  assert.equal(blocker(towardMiddle, [towardMiddle, crossing], 6), crossing);
  assert.equal(blocker(fish, [fish], 6), null, 'removing the entire body frees the route');
});

test('first occupied body cell determines the nearest blocker', () => {
  const fish = { id: 'a', x: 0, y: 2, direction: 'right', length: 1 };
  const long = { id: 'b', x: 4, y: 2, direction: 'right', length: 3 };
  const farther = { id: 'c', x: 5, y: 0, direction: 'up', length: 3 };
  assert.equal(blocker(fish, [fish, farther, long], 6), long);
});

test('a tuna can only travel in its facing direction; first blocker wins', () => {
  const fish = { id: 'a', x: 0, y: 2, direction: 'right' };
  const near = { id: 'b', x: 2, y: 2, direction: 'up' };
  const far = { id: 'c', x: 4, y: 2, direction: 'left' };
  const elsewhere = { id: 'd', x: 1, y: 1, direction: 'down' };
  assert.equal(blocker(fish, [fish, far, near, elsewhere], 6), near);
  assert.equal(blocker(fish, [fish, elsewhere], 6), null);
  assert.deepEqual(ray({ ...fish, direction: 'left' }, 6), []);
  assert.deepEqual(ray({ ...fish, direction: 'up' }, 6), [{ x: 0, y: 1 }, { x: 0, y: 0 }]);
  assert.equal(ray({ ...fish, direction: 'down' }, 6).length, 3);
});

for (let level = 1; level <= 16; level++) {
  test(`stage ${level}: unique cells, deterministic layout, and fully solvable`, () => {
    const puzzle = createLevel(level);
    assert.deepEqual(createLevel(level), puzzle);
    let fishes = [...puzzle.fishes];
    assert.ok(fishes.length >= 10);
    const bodies = fishes.flatMap(occupiedCells);
    assert.equal(new Set(bodies.map(cell => `${cell.x},${cell.y}`)).size, bodies.length, 'no bodies overlap');
    assert.ok(bodies.every(cell => cell.x >= 0 && cell.y >= 0 && cell.x < puzzle.size && cell.y < puzzle.size), 'entire bodies fit inside board');
    for (const length of [1, 2, 3]) assert.ok(fishes.some(fish => fish.length === length), `length ${length} appears`);
    assert.ok(fishes.some(fish => blocker(fish, fishes, puzzle.size)), 'initial layout has blocked fish');
    for (const id of puzzle.solution) {
      const fish = fishes.find(fish => fish.id === id);
      assert.ok(fish);
      assert.equal(blocker(fish, fishes, puzzle.size), null, `${id} must be able to escape`);
      fishes = fishes.filter(other => other.id !== id);
    }
    assert.equal(fishes.length, 0);
  });
}
