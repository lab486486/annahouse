/**
 * AdSense invalid-click guard.
 * Placeholders (.ad-slot.ad-unit) stay in HTML. This script inserts <ins>,
 * loads adsbygoogle.js, and calls push() only when the browser is not blocked.
 * A block removes ad nodes; it does not hide them with display:none.
 *
 * localStorage key: annahouse_ad_click_guard_v2
 * { windowStart: number, count: number } — 3 estimated ad clicks / 24h blocks.
 * v2 ignores the v1 key, which counted ordinary article visits.
 */
(function () {
  if (window.__annaAdGuard) return;
  window.__annaAdGuard = true;

  var STORAGE_KEY = "annahouse_ad_click_guard_v2";
  var MAX_CLICKS = 3;
  var WINDOW_MS = 24 * 60 * 60 * 1000;
  var DEBOUNCE_MS = 1000;
  var ARM_MS = 14000;
  var SCRIPT_SRC =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7643658138527330";

  var AD_IFRAME_SELECTOR = [
    'iframe[id^="google_ads_iframe"]',
    'iframe[id^="aswift_"]',
    'iframe[name^="google_ads"]',
    'iframe[name^="aswift_"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googletagservices"]',
  ].join(",");

  var AD_NODE_SELECTOR = ".ad-unit, ins.adsbygoogle, .google-auto-placed";

  var blocked = false;
  var armedUntil = 0;
  var lastRecordAt = 0;
  /** 광고가 아닌 링크를 누른 직후 pagehide/blur는 글 이동이다. 이 시각까지는 카운트하지 않는다. */
  var ignoreLeaveUntil = 0;
  var reaper = null;
  var pushed = typeof WeakSet === "function" ? new WeakSet() : null;

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { windowStart: Date.now(), count: 0 };
      var parsed = JSON.parse(raw);
      var windowStart = Number(parsed.windowStart) || 0;
      var count = Math.max(0, Number(parsed.count) || 0);
      if (!windowStart || Date.now() - windowStart >= WINDOW_MS) {
        var fresh = { windowStart: Date.now(), count: 0 };
        writeState(fresh);
        return fresh;
      }
      return { windowStart: windowStart, count: count };
    } catch (err) {
      return { windowStart: Date.now(), count: 0 };
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode / quota */
    }
  }

  function syncBlocked() {
    blocked = readState().count >= MAX_CLICKS;
    return blocked;
  }

  function arm() {
    if (blocked) return;
    armedUntil = Date.now() + ARM_MS;
  }

  function isArmed() {
    return Date.now() < armedUntil;
  }

  function isGoogleAdIframe(el) {
    if (!el || el.tagName !== "IFRAME") return false;
    var id = el.id || "";
    var name = el.name || "";
    var src = (el.getAttribute("src") || "") + (el.getAttribute("data-src") || "");
    return (
      id.indexOf("google_ads_iframe") === 0 ||
      id.indexOf("aswift_") === 0 ||
      name.indexOf("google_ads") === 0 ||
      name.indexOf("aswift_") === 0 ||
      src.indexOf("googlesyndication") !== -1 ||
      src.indexOf("doubleclick") !== -1 ||
      src.indexOf("googletagservices") !== -1
    );
  }

  function isAdScript(el) {
    if (!el || el.tagName !== "SCRIPT") return false;
    var src = el.getAttribute("src") || "";
    return src.indexOf("adsbygoogle.js") !== -1 || src.indexOf("googlesyndication.com/pagead") !== -1;
  }

  function elementLooksLikeAd(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest(".ad-slot, .ad-unit, ins.adsbygoogle, .adsbygoogle, .google-auto-placed")) {
      return true;
    }
    return isGoogleAdIframe(el);
  }

  function eventTargetEl(event) {
    var target = event.target;
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  function pointOverAd(x, y) {
    if (!document.elementFromPoint) return false;
    return elementLooksLikeAd(document.elementFromPoint(x, y));
  }

  function eventHitsAd(event) {
    if (elementLooksLikeAd(eventTargetEl(event))) return true;
    if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent) {
      return pointOverAd(event.clientX, event.clientY);
    }
    if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      var touch = event.touches[0] || event.changedTouches[0];
      if (touch) return pointOverAd(touch.clientX, touch.clientY);
    }
    return false;
  }

  /** Pointer/touch over an ad arms for ARM_MS. Leaving the ad does not disarm. */
  function onPointerActivity(event) {
    if (blocked) return;
    if (eventHitsAd(event)) arm();
  }

  function onFocusIn(event) {
    if (elementLooksLikeAd(eventTargetEl(event))) arm();
  }

  function armFromActiveElement() {
    if (elementLooksLikeAd(document.activeElement)) arm();
  }

  /**
   * 부모 문서가 받는 링크 클릭은 사이트 안 이동이다.
   * 광고 iframe 클릭은 cross-origin이라 여기까지 클릭이 올라오지 않는다.
   */
  function markNonAdLink(event) {
    var el = eventTargetEl(event);
    if (!el || !el.closest) return;
    if (elementLooksLikeAd(el)) return;
    var link = el.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;
    ignoreLeaveUntil = Date.now() + 2500;
  }

  function leaveIsSiteNavigation() {
    if (Date.now() < ignoreLeaveUntil) return true;
    var active = document.activeElement;
    if (!active || !active.closest) return false;
    if (elementLooksLikeAd(active)) return false;
    var link = active.closest("a[href]");
    if (!link) return false;
    var href = link.getAttribute("href") || "";
    return !!href && href.charAt(0) !== "#";
  }

  function removeMatches(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(AD_NODE_SELECTOR).forEach(function (el) {
      el.remove();
    });
    root.querySelectorAll(AD_IFRAME_SELECTOR).forEach(function (el) {
      el.remove();
    });
    root.querySelectorAll("script[src]").forEach(function (el) {
      if (isAdScript(el)) el.remove();
    });
  }

  function stripNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (
      (node.matches && node.matches(AD_NODE_SELECTOR)) ||
      isGoogleAdIframe(node) ||
      isAdScript(node)
    ) {
      node.remove();
      return;
    }
    removeMatches(node);
  }

  function neuterAdsbygoogle() {
    var queue = [];
    queue.push = function () {
      return 0;
    };
    try {
      var current = window.adsbygoogle;
      if (current && typeof current.push === "function") {
        current.push = function () {
          return 0;
        };
      }
    } catch (err) {
      /* ignore */
    }
    try {
      Object.defineProperty(window, "adsbygoogle", {
        configurable: true,
        enumerable: true,
        get: function () {
          return queue;
        },
        set: function () {},
      });
    } catch (err) {
      try {
        window.adsbygoogle = queue;
      } catch (err2) {
        /* ignore */
      }
    }
  }

  function startReaper() {
    if (reaper || !document.documentElement) return;
    reaper = new MutationObserver(function (records) {
      if (!blocked) return;
      records.forEach(function (record) {
        record.addedNodes.forEach(stripNode);
      });
    });
    reaper.observe(document.documentElement, { childList: true, subtree: true });
  }

  function tearDownAds() {
    blocked = true;
    armedUntil = 0;
    neuterAdsbygoogle();
    startReaper();
    removeMatches(document);
  }

  function recordClickEstimate() {
    var state = readState();
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

  /**
   * Estimated ad click: armed, then the page is hidden because the ad opened.
   * A click on an in-site link also hides the page (pagehide) but must not count.
   * Arm stays sticky after a real ad hide so the next iframe click still counts.
   */
  function onPossibleAdClickLeave() {
    if (leaveIsSiteNavigation()) return;
    armFromActiveElement();
    if (!isArmed() || blocked) return;
    var now = Date.now();
    if (now - lastRecordAt < DEBOUNCE_MS) return;
    lastRecordAt = now;
    recordClickEstimate();
    if (!blocked) arm();
  }

  function cssPx(value, fallbackPx) {
    if (!value) return fallbackPx + "px";
    if (/^\d+(\.\d+)?$/.test(value)) return value + "px";
    return value;
  }

  function fillSlot(slot) {
    if (blocked) return;
    if (slot.querySelector("ins.adsbygoogle")) return;
    var client = slot.dataset.adClient;
    var adSlot = slot.dataset.adSlot;
    if (!client || !adSlot) return;

    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", adSlot);

    var format = slot.dataset.adFormat || "auto";
    if (format === "fixed") {
      ins.style.display = "inline-block";
      ins.style.width = cssPx(slot.dataset.adWidth, 300);
      ins.style.height = cssPx(slot.dataset.adHeight, 600);
    } else if (format === "fluid" || slot.dataset.adLayout) {
      ins.style.display = "block";
      ins.setAttribute("data-ad-format", format === "fixed" ? "fluid" : format);
      if (slot.dataset.adLayout) ins.setAttribute("data-ad-layout", slot.dataset.adLayout);
    } else {
      ins.style.display = "block";
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
    }

    slot.appendChild(ins);
  }

  function pushSlots() {
    if (blocked) {
      tearDownAds();
      return;
    }
    window.adsbygoogle = window.adsbygoogle || [];
    document.querySelectorAll("ins.adsbygoogle").forEach(function (ins) {
      if (pushed && pushed.has(ins)) return;
      if (pushed) pushed.add(ins);
      try {
        window.adsbygoogle.push({});
      } catch (err) {
        /* already filled */
      }
    });
  }

  function loadAdScript() {
    if (blocked) {
      tearDownAds();
      return;
    }
    if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      pushSlots();
      return;
    }
    var script = document.createElement("script");
    script.async = true;
    script.src = SCRIPT_SRC;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", pushSlots, { once: true });
    document.head.appendChild(script);
  }

  function mountAds() {
    if (syncBlocked()) {
      tearDownAds();
      return;
    }
    document.querySelectorAll(".ad-slot[data-ad-client], .ad-unit[data-ad-client]").forEach(fillSlot);
    loadAdScript();
  }

  function onPageVisible() {
    if (syncBlocked()) {
      tearDownAds();
      return;
    }
    if (reaper) {
      reaper.disconnect();
      reaper = null;
    }
  }

  document.addEventListener("mousemove", onPointerActivity, { capture: true, passive: true });
  document.addEventListener("mouseover", onPointerActivity, true);
  document.addEventListener("pointerover", onPointerActivity, true);
  document.addEventListener("pointerdown", onPointerActivity, true);
  document.addEventListener("pointerdown", markNonAdLink, true);
  document.addEventListener("click", markNonAdLink, true);
  document.addEventListener("auxclick", markNonAdLink, true);
  document.addEventListener("touchstart", onPointerActivity, { capture: true, passive: true });
  document.addEventListener("touchstart", markNonAdLink, { capture: true, passive: true });
  document.addEventListener("focusin", onFocusIn, true);
  window.addEventListener("focus", armFromActiveElement, true);
  window.addEventListener("blur", onPossibleAdClickLeave);
  window.addEventListener("pagehide", onPossibleAdClickLeave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") onPossibleAdClickLeave();
    if (document.visibilityState === "visible") onPageVisible();
  });

  syncBlocked();
  if (blocked) startReaper();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (blocked) tearDownAds();
      else mountAds();
    });
  } else if (blocked) {
    tearDownAds();
  } else {
    mountAds();
  }
})();
