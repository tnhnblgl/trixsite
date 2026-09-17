// The Download button's direct link, and the app window's 3D tilt.

const REPO = 'tnhnblgl/trix';

// ---- Download ----------------------------------------------------------------
// The zip's name carries its version (trix-v1.4.0-win-x64.zip), so no fixed URL
// always means "the newest zip". The button's href in the HTML is GitHub's
// latest-release page, which works even if this never runs; once GitHub says
// which zip is newest, the button points straight at it.

const CACHE_KEY = 'trix-latest-zip';
const CACHE_MS = 10 * 60 * 1000;

const download = document.getElementById('download');
const downloadMeta = document.getElementById('download-meta');

function showZip(zip) {
  download.href = zip.url;
  downloadMeta.textContent = `Windows · ${zip.tag} · ${(zip.size / 1048576).toFixed(1)} MB`;
}

function cachedZip() {
  try {
    const zip = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return zip && Date.now() - zip.at < CACHE_MS ? zip : null;
  } catch {
    return null;
  }
}

async function latestZip() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const release = await res.json();
  const assets = release.assets ?? [];
  const asset = assets.find((a) => /win-x64\.zip$/i.test(a.name)) ?? assets.find((a) => /\.zip$/i.test(a.name));
  if (!asset) throw new Error(`${release.tag_name} has no zip attached`);
  return { url: asset.browser_download_url, tag: release.tag_name, size: asset.size, at: Date.now() };
}

const cached = cachedZip();
if (cached) {
  showZip(cached);
} else {
  latestZip()
    .then((zip) => {
      showZip(zip);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(zip));
      } catch {}
    })
    // Rate-limited or offline: the button keeps linking to the release page.
    .catch(() => {});
}

// ---- Tilt ----------------------------------------------------------------------
// The window leans back at the top of the page and straightens as it scrolls
// into the middle of the screen. A mouse turns it a little on top of that.

const TILT_TOP = 24; // degrees back, at the top of the page
const TILT_CENTRED = 4; // once the window is centred on screen
const TILT_REDUCED = 12; // fixed, when the viewer has asked for less motion
const POINTER_TURN = 9; // sideways, with the mouse at a screen edge
const POINTER_LEAN = 5; // forwards and back, likewise
const FOLLOW = 0.08; // fraction of the way to the mouse per frame

const scene = document.querySelector('.scene');
const slab = document.querySelector('.slab');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const pointer = { x: 0, y: 0 }; // -1..1 across the viewport
const shown = { x: 0, y: 0 };
let settleScroll = 1; // scroll position at which the window is centred
let queued = false;

function measure() {
  // offsetTop ignores the entrance animation's transform; the bounding box
  // would not.
  let top = 0;
  for (let el = scene; el; el = el.offsetParent) top += el.offsetTop;
  const centred = top + slab.offsetHeight / 2 - innerHeight / 2;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  settleScroll = Math.max(1, Math.min(centred, maxScroll));
}

function set(name, value) {
  slab.style.setProperty(name, value);
}

function render() {
  queued = false;

  if (reducedMotion.matches) {
    set('--rx', `${TILT_REDUCED}deg`);
    set('--ry', '0deg');
    set('--refl', '0');
    return;
  }

  shown.x += (pointer.x - shown.x) * FOLLOW;
  shown.y += (pointer.y - shown.y) * FOLLOW;

  const progress = Math.min(1, Math.max(0, scrollY / settleScroll));
  const eased = 1 - (1 - progress) ** 2;
  const rx = TILT_TOP + (TILT_CENTRED - TILT_TOP) * eased - shown.y * POINTER_LEAN;
  const ry = shown.x * POINTER_TURN;

  set('--rx', `${rx.toFixed(3)}deg`);
  set('--ry', `${ry.toFixed(3)}deg`);
  set('--gx', `${(50 + shown.x * 40).toFixed(2)}%`);
  set('--gy', `${(10 + shown.y * 30).toFixed(2)}%`);
  set('--refl', eased.toFixed(3));

  if (Math.abs(pointer.x - shown.x) > 0.001 || Math.abs(pointer.y - shown.y) > 0.001) queue();
}

function queue() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(render);
  }
}

addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
    queue();
  },
  { passive: true },
);

document.documentElement.addEventListener('mouseleave', () => {
  pointer.x = 0;
  pointer.y = 0;
  queue();
});

addEventListener('scroll', queue, { passive: true });

addEventListener('resize', () => {
  measure();
  queue();
});

addEventListener('load', () => {
  measure();
  queue();
});

reducedMotion.addEventListener('change', queue);

measure();
render();
