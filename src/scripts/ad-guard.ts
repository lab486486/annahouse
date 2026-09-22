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
/** 마우스가 광고 영역(또는 광고 iframe) 위에 있었는지. iframe 안에서는 이벤트가 끊겨도 유지됨. */
let overAd = false;
let lastRecordAt = 0;
let reaper: MutationObserver | null = null;

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

function isGoogleAdIframe(el: Element): boolean {
  if (!(el instanceof HTMLIFrameElement)) return false;
  const id = el.id || "";
  const name = el.name || "";
  const src = el.getAttribute("src") || "";
  return (
    id.startsWith("google_ads_iframe") ||
    name.startsWith("google_ads") ||
    src.includes("googlesyndication") ||
    src.includes("doubleclick") ||
    src.includes("googletagservices")
  );
}

function elementLooksLikeAd(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest(".ad-slot, ins.adsbygoogle, .adsbygoogle")) return true;
  if (isGoogleAdIframe(el)) return true;
  return false;
}

function pointOverAd(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y);
  return elementLooksLikeAd(el);
}

function markOverAdFromEvent(event: Event) {
  if (sessionBlocked) return;

  if (event instanceof MouseEvent) {
    overAd = pointOverAd(event.clientX, event.clientY) || elementLooksLikeAd(event.target as Element | null);
    return;
  }
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (touch) {
      overAd = pointOverAd(touch.clientX, touch.clientY) || elementLooksLikeAd(event.target as Element | null);
      return;
    }
  }
  if (elementLooksLikeAd(event.target as Element | null)) {
    overAd = true;
  }
}

/** 광고 DOM을 즉시 제거. display:none이 아니라 노드 삭제. */
function tearDownAds() {
  sessionBlocked = true;
  overAd = false;
  document.querySelectorAll(".ad-slot, ins.adsbygoogle").forEach((el) => el.remove());
  document
    .querySelectorAll(
      'iframe[id^="google_ads_iframe"], iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[src*="googletagservices"], iframe[name^="google_ads"]',
    )
    .forEach((el) => el.remove());

  // AdSense가 비동기로 다시 꽂는 iframe/ins 도 계속 제거
  if (!reaper) {
    reaper = new MutationObserver(() => {
      if (!sessionBlocked) return;
      document.querySelectorAll(".ad-slot, ins.adsbygoogle").forEach((el) => el.remove());
      document
        .querySelectorAll(
          'iframe[id^="google_ads_iframe"], iframe[src*="googlesyndication"], iframe[src*="doubleclick"], iframe[src*="googletagservices"], iframe[name^="google_ads"]',
        )
        .forEach((el) => el.remove());
    });
    reaper.observe(document.documentElement, { childList: true, subtree: true });
  }
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
    queueMicrotask(tearDownAds);
    setTimeout(tearDownAds, 0);
    setTimeout(tearDownAds, 300);
    setTimeout(tearDownAds, 1000);
  }
}

/** 광고 클릭으로 탭이 가려지거나 포커스를 잃을 때 카운트 */
function onPossibleAdClickLeave() {
  if (!overAd || sessionBlocked) return;
  const now = Date.now();
  if (now - lastRecordAt < DEBOUNCE_MS) return;
  lastRecordAt = now;
  recordClickEstimate();
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

document.addEventListener("mousemove", markOverAdFromEvent, { passive: true, capture: true });
document.addEventListener("mouseover", markOverAdFromEvent, true);
document.addEventListener("pointerdown", markOverAdFromEvent, true);
document.addEventListener("touchstart", markOverAdFromEvent, { capture: true, passive: true });

window.addEventListener("blur", onPossibleAdClickLeave);
window.addEventListener("pagehide", onPossibleAdClickLeave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") onPossibleAdClickLeave();
  if (document.visibilityState === "visible") enforceBlockIfNeeded();
});
window.addEventListener("focus", enforceBlockIfNeeded);

mountAds();
