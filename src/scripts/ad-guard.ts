const STORAGE_KEY = "annahouse_ad_click_guard";
const MAX_CLICKS = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 1200;
const SCRIPT_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7643658138527330";

type GuardState = {
  windowStart: number;
  count: number;
};

function readState(): GuardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { windowStart: Date.now(), count: 0 };
    const parsed = JSON.parse(raw) as Partial<GuardState>;
    const windowStart = Number(parsed.windowStart) || 0;
    if (!windowStart || Date.now() - windowStart >= WINDOW_MS) {
      return { windowStart: Date.now(), count: 0 };
    }
    return { windowStart, count: Math.max(0, Number(parsed.count) || 0) };
  } catch {
    return { windowStart: Date.now(), count: 0 };
  }
}

function writeState(state: GuardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

function isBlocked(): boolean {
  return readState().count >= MAX_CLICKS;
}

function removeAdSlots() {
  document.querySelectorAll(".ad-slot").forEach((el) => el.remove());
}

function recordClickEstimate() {
  const state = readState();
  state.count += 1;
  writeState(state);
  if (state.count >= MAX_CLICKS) removeAdSlots();
}

function fillSlot(slot: HTMLElement) {
  if (slot.querySelector("ins.adsbygoogle")) return;

  const client = slot.dataset.adClient;
  const adSlot = slot.dataset.adSlot;
  if (!client || !adSlot) return;

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.setAttribute("data-ad-client", client);
  ins.setAttribute("data-ad-slot", adSlot);

  if (slot.dataset.adFormat === "fixed") {
    ins.style.display = "inline-block";
    ins.style.width = slot.dataset.adWidth || "300px";
    ins.style.height = slot.dataset.adHeight || "600px";
  } else {
    ins.style.display = "block";
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
  }

  slot.appendChild(ins);
}

function pushSlots() {
  const w = window as Window & { adsbygoogle?: unknown[] };
  w.adsbygoogle = w.adsbygoogle || [];
  document.querySelectorAll(".ad-slot ins.adsbygoogle").forEach(() => {
    w.adsbygoogle!.push({});
  });
}

function loadAdScript() {
  if (document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`)) {
    pushSlots();
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;
  script.crossOrigin = "anonymous";
  script.addEventListener("load", pushSlots, { once: true });
  document.head.appendChild(script);
}

function mountAds() {
  if (isBlocked()) {
    removeAdSlots();
    return;
  }

  document.querySelectorAll<HTMLElement>(".ad-slot[data-ad-client]").forEach(fillSlot);
  loadAdScript();
}

function armIfAdTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  if (target.closest("ins.adsbygoogle, .adsbygoogle")) {
    armed = true;
  }
}

let armed = false;
let lastRecordAt = 0;

document.addEventListener(
  "mouseover",
  (event) => {
    armIfAdTarget(event.target);
  },
  true,
);

document.addEventListener(
  "touchstart",
  (event) => {
    armIfAdTarget(event.target);
  },
  { capture: true, passive: true },
);

window.addEventListener("blur", () => {
  if (!armed) return;
  armed = false;
  const now = Date.now();
  if (now - lastRecordAt < DEBOUNCE_MS) return;
  lastRecordAt = now;
  recordClickEstimate();
});

mountAds();
