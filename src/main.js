import { createLevel, blocker, occupiedCells, DIRECTIONS } from './puzzle.js';

const $ = selector => document.querySelector(selector);
const LAST_STAGE = 16;
const names = ['はじまりの入江','さざなみの浜辺','珊瑚の小道','潮風のラグーン','翡翠の浅瀬','ひだまりの群れ','青い回廊','ささやきの海流','群青の海峡','月あかりの湾','遠い水平線','秘密の環礁','銀色の航路','静かな大海原','夜明けの海','自由な海へ'];
const storageKey = 'maguro-escape-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Storage may be unavailable in an embedded webview. */ }
let unlocked = Math.min(LAST_STAGE, Math.max(1, Number(saved.unlocked) || 1));
let completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= LAST_STAGE) : []);
let level = Math.min(unlocked, Math.max(1, Number(saved.level) || 1));
let sound = saved.sound === true;
let puzzle, fishes, history, busy = false, generation = 0, audio, sdk;

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ level, unlocked, completed: [...completed], sound })); } catch { /* Local play still works. */ }
}

export function fishSVG(direction = 'right', variant = 0, length = 1) {
  const colors = ['#39766c', '#28675f', '#528b7b', '#245e59'];
  const width = 80 * length;
  const mid = width * 0.52;
  const head = width - 7;
  return `<svg class="fish" style="--angle:${DIRECTIONS[direction].angle}deg" viewBox="0 0 ${width} 80" aria-hidden="true"><path d="M24 40 7 27q-2 13 0 26Z" fill="${colors[variant % 4]}"/><path d="M${mid - 10} 28 ${mid + 3} 15l5 13M${mid - 6} 50l11 13 4-14" fill="#9bb5a0"/><path d="M20 40C30 25 39 24 51 25H${width - 29}Q${width - 14} 28 ${head} 40Q${width - 14} 52 ${width - 29} 55H51C39 56 30 55 20 40Z" fill="${colors[variant % 4]}"/><path d="M22 41Q${mid} 47 ${head - 2} 40Q${width - 14} 54 ${width - 29} 55H51Q30 55 22 41Z" fill="#c6d4ba"/><path d="M${width - 26} 29q-9 11 0 22" fill="none" stroke="#214e48" stroke-width="1.1" opacity=".5"/><path d="m${width - 43} 38 11 4-10 6Z" fill="#1e554e"/><circle cx="${width - 18}" cy="36" r="3" fill="#f4f7e9"/><circle cx="${width - 17}" cy="36" r="1.6" fill="#213e3a"/><path d="m${head - 1} 40-4 1" stroke="#214e48" stroke-width="1.1" stroke-linecap="round"/></svg>`;
}

function message(text, warning = false) {
  $('#status').textContent = text;
  $('#status').classList.toggle('warning', warning);
}

function updateProgress() {
  const escaped = puzzle.fishes.length - fishes.length;
  $('#escaped').textContent = escaped;
  $('#total').textContent = ` / ${puzzle.fishes.length}`;
  $('#progress-fill').style.width = `${escaped / puzzle.fishes.length * 100}%`;
  const track = $('.progress-track');
  track.setAttribute('aria-valuenow', escaped);
  track.setAttribute('aria-valuemax', puzzle.fishes.length);
  $('#undo').disabled = busy || !history.length;
  $('#hint').disabled = busy || !fishes.length;
}

function render() {
  const board = $('#board');
  board.replaceChildren();
  board.style.setProperty('--size', puzzle.size);
  for (const fish of fishes) {
    const button = document.createElement('button');
    const length = fish.length ?? 1;
    const vertical = ['up', 'down'].includes(fish.direction);
    const body = occupiedCells(fish);
    button.className = `cell${vertical ? ' vertical' : ''}`;
    button.dataset.id = fish.id;
    button.dataset.length = length;
    button.style.setProperty('--length', length);
    button.style.gridColumn = `${Math.min(...body.map(cell => cell.x)) + 1} / span ${vertical ? 1 : length}`;
    button.style.gridRow = `${Math.min(...body.map(cell => cell.y)) + 1} / span ${vertical ? length : 1}`;
    button.setAttribute('aria-label', `${fish.y + 1}行${fish.x + 1}列、${DIRECTIONS[fish.direction].label}向き、長さ${length}マスのマグロ`);
    button.innerHTML = fishSVG(fish.direction, Number(fish.id.split('-')[1]), length);
    button.addEventListener('click', () => escape(fish));
    board.append(button);
  }
  $('#celebration').hidden = fishes.length !== 0;
  updateProgress();
}

function start(stage) {
  generation++;
  level = stage;
  puzzle = createLevel(stage);
  fishes = [...puzzle.fishes];
  history = [];
  busy = false;
  $('#stage').textContent = String(stage).padStart(2, '0');
  $('#level-name').textContent = names[stage - 1];
  $('#next').innerHTML = stage === LAST_STAGE ? 'もう一度、海をめぐる <span>↻</span>' : '次の海へ <span>→</span>';
  message('気になるマグロを、タップしてみよう。');
  render();
  persist();
}

async function tone(success, finish = false) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    await audio.resume();
    const now = audio.currentTime;
    const notes = finish ? [523, 659, 784, 1047] : success ? [660, 880] : [220, 196];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * .09);
      gain.gain.linearRampToValueAtTime(.035, now + index * .09 + .012);
      gain.gain.exponentialRampToValueAtTime(.001, now + index * .09 + .28);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + index * .09);
      oscillator.stop(now + index * .09 + .3);
    });
  } catch { /* Audio is optional. */ }
}

function escape(fish) {
  if (busy || !fishes.includes(fish)) return;
  const button = $(`[data-id="${fish.id}"]`);
  document.querySelectorAll('.hinted,.blocker').forEach(node => node.classList.remove('hinted', 'blocker'));
  const hit = blocker(fish, fishes, puzzle.size);
  if (hit) {
    const direction = DIRECTIONS[fish.direction];
    button.style.setProperty('--dx', direction.x);
    button.style.setProperty('--dy', direction.y);
    button.classList.remove('blocked');
    void button.offsetWidth;
    button.classList.add('blocked');
    $(`[data-id="${hit.id}"]`).classList.add('blocker');
    message('おっと、仲間がいるみたい。ほかのマグロから！', true);
    tone(false);
    return;
  }
  busy = true;
  updateProgress();
  const direction = DIRECTIONS[fish.direction];
  const distance = $('#board').clientWidth + 70;
  button.style.setProperty('--exit-x', `${direction.x * distance}px`);
  button.style.setProperty('--exit-y', `${direction.y * distance}px`);
  button.classList.add('leaving');
  tone(true);
  const token = generation;
  setTimeout(() => {
    if (token !== generation) return;
    history.push([...fishes]);
    fishes = fishes.filter(other => other.id !== fish.id);
    busy = false;
    render();
    if (!fishes.length) {
      completed.add(level);
      unlocked = Math.max(unlocked, Math.min(LAST_STAGE, level + 1));
      persist();
      message('全員脱出！ マグロたちが自由な海へ帰りました。');
      tone(true, true);
      $('#next').focus({ preventScroll: true });
      if (sdk) sdk.setSessionData({ stage: level, completed: true });
    } else {
      message(['すいーっ。広い海へ、いってらっしゃい。','いい流れ！ 次の一匹を見つけよう。','一匹ずつ、海がひらけていく。'][fishes.length % 3]);
      const next = $('#board button');
      if (next) next.focus({ preventScroll: true });
    }
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 460);
}

$('#undo').addEventListener('click', () => {
  if (busy || !history.length) return;
  fishes = history.pop();
  render();
  message('ひとつ前の海に戻りました。');
});
$('#reset').addEventListener('click', () => start(level));
$('#next').addEventListener('click', () => start(level === LAST_STAGE ? 1 : level + 1));
$('#hint').addEventListener('click', () => {
  if (busy) return;
  const fish = fishes.find(fish => !blocker(fish, fishes, puzzle.size));
  document.querySelectorAll('.hinted,.blocker').forEach(node => node.classList.remove('hinted', 'blocker'));
  if (fish) {
    $(`[data-id="${fish.id}"]`).classList.add('hinted');
    message('金色に光るマグロは、今すぐ海へ帰れそう。');
  }
});

function renderSound() {
  $('#sound').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>${sound ? '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 6 6m0-6-6 6"/>'}</svg>`;
  $('#sound').setAttribute('aria-label', `音を${sound ? 'オフ' : 'オン'}にする`);
  $('#sound').setAttribute('aria-pressed', sound);
}
$('#sound').addEventListener('click', () => { sound = !sound; renderSound(); persist(); if (sound) tone(true); });
$('#help').addEventListener('click', () => $('#help-dialog').showModal());
$('#help-fish').innerHTML = fishSVG();
document.querySelectorAll('.dialog-close,.close-help').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
$('#levels').addEventListener('click', () => {
  $('#stage-list').replaceChildren();
  for (let stage = 1; stage <= LAST_STAGE; stage++) {
    const button = document.createElement('button');
    button.className = `stage-choice${stage === level ? ' current' : ''}`;
    button.disabled = stage > unlocked;
    button.setAttribute('aria-label', `ステージ${stage} ${names[stage - 1]}${completed.has(stage) ? ' クリア済み' : ''}`);
    button.innerHTML = `${String(stage).padStart(2, '0')}${completed.has(stage) ? '<span class="check">✓</span>' : ''}`;
    button.addEventListener('click', () => { start(stage); $('#levels-dialog').close(); });
    $('#stage-list').append(button);
  }
  $('#levels-dialog').showModal();
});

// Keep the web version playable without the Meta runtime. In an Instant Games
// webview, initialize and signal readiness before allowing interactions.
async function initializeMeta() {
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  const game = $('.game');
  game.inert = true;
  message('海の準備をしています…');
  try {
    if (!window.FBInstant) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://connect.facebook.net/en_US/fbinstant.7.1.js';
        const timeout = setTimeout(() => reject(new Error('SDK load timeout')), 6000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('SDK unavailable')); };
        document.head.append(script);
      });
    }
    const api = window.FBInstant;
    await Promise.race([
      (async () => { await api.initializeAsync(); api.setLoadingProgress(100); await api.startGameAsync(); })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SDK initialization timeout')), 10000)),
    ]);
    sdk = api;
    sdk.onPause(() => { if (audio) audio.suspend().catch(() => {}); });
    message('気になるマグロを、タップしてみよう。');
  } catch {
    message('Web 版でプレイ中。マグロをタップしてみよう。');
  } finally { game.inert = false; }
}

start(level);
renderSound();
initializeMeta();
