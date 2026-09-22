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

let sessionBlocked = false;
let armed = false;
let lastRecordAt = 0;

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
  return sessionBlocked || readState().count >= MAX_CLICKS;
}

/** 광고 DOM을 즉시 제거. display:none이 아니라 노드 삭제. */
function tearDownAds() {
  sessionBlocked = true;
  armed = false;
  document.querySelectorAll(".ad-slot, ins.adsbygoogle").forEach((el) => el.remove());
  document
    .querySelectorAll(
      'iframe[id^="google_ads_iframe"], iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[name^="google_ads"]',
    )
    .forEach((el) => el.remove());
}

function enforceBlockIfNeeded() {
  if (isBlocked()) tearDownAds();
}

function recordClickEstimate() {
  const state = readState();
  state.count += 1;
  writeState(state);
  if (state.count >= MAX_CLICKS) {
    tearDownAds();
    // 광고 클릭으로 백그라운드에 있어도, 돌아오는 순간 한 번 더 걷어냄
    queueMicrotask(tearDownAds);
    setTimeout(tearDownAds, 0);
    setTimeout(tearDownAds, 300);
  }
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
  if (isBlocked()) {
    tearDownAds();
    return;
  }
  const w = window as Window & { adsbygoogle?: unknown[] };
  w.adsbygoogle = w.adsbygoogle || [];
  document.querySelectorAll(".ad-slot ins.adsbygoogle").forEach(() => {
    w.adsbygoogle!.push({});
  });
}

function loadAdScript() {
  if (isBlocked()) {
    tearDownAds();
    return;
  }
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
    tearDownAds();
    return;
  }

  document.querySelectorAll<HTMLElement>(".ad-slot[data-ad-client]").forEach(fillSlot);
  loadAdScript();
}

function armIfAdTarget(target: EventTarget | null) {
  if (sessionBlocked || isBlocked()) return;
  if (!(target instanceof Element)) return;
  // 슬롯 영역(빈 여백 포함)도 무장 — iframe 클릭 직전에 부모에서 잡히도록
  if (target.closest(".ad-slot, ins.adsbygoogle, .adsbygoogle")) {
    armed = true;
  }
}

document.addEventListener(
  "mouseover",
  (event) => {
    armIfAdTarget(event.target);
  },
  true,
);

document.addEventListener(
  "pointerdown",
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
  if (!armed || sessionBlocked) return;
  armed = false;
  const now = Date.now();
  if (now - lastRecordAt < DEBOUNCE_MS) return;
  lastRecordAt = now;
  recordClickEstimate();
});

// 광고 탭에서 돌아오면 차단 여부를 다시 보고, 남아 있는 배너를 즉시 제거
window.addEventListener("focus", enforceBlockIfNeeded);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") enforceBlockIfNeeded();
});

mountAds();
