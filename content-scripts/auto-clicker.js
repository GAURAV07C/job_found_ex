/**
 * Job Founder Hunter - Generic Auto-Clicker (set-and-forget)
 *
 * Ek bar config set karo (chrome.storage), phir har naya tab jab load hoga
 * aur usme configured text/selector dikhega, to ye automatically click karega.
 *
 * Real mouse cursor control NAHI karta (browser extension se impossible hai),
 * lekin element.click() se wahi action hota hai — bina cursor hile.
 *
 * Config structure (chrome.storage.local "JFH_AUTOCLICK_RULES"):
 * [
 *   {
 *     match: "linkedin.com",          // URL contain kare to rule lagu ho
 *     find: "Contact info",           // button/text jo dikhe
 *     mode: "text",                   // "text" | "selector"
 *     selector: "button",             // mode=selector ho to CSS selector
 *     action: "click",                // "click" | "copy" (text copy kare)
 *     maxTries: 30,                   // kitni baar retry kare (har 1s)
 *     once: true                      // true = ek baar click karke rule skip
 *   }
 * ]
 */

(function () {
  'use strict';

  const RULES_KEY = 'JFH_AUTOCLICK_RULES';
  const POLL_MS = 1000;
  const firedOnce = new Set(); // rule index jo already ek baar fire ho chuka (once mode)

  function loadRules() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(RULES_KEY, (res) => {
          const rules = res && res[RULES_KEY];
          resolve(Array.isArray(rules) ? rules : []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  // Page ke andar dikh raha text dhoondho (case-insensitive, visible elements)
  function findByText(text) {
    const lower = text.toLowerCase();
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      if (node.nodeValue && node.nodeValue.toLowerCase().includes(lower)) {
        // closest clickable ancestor
        let el = node.parentElement;
        while (el && el !== document.body) {
          if (el.offsetParent !== null && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button')) {
            return el;
          }
          el = el.parentElement;
        }
        // fallback: parent element hi click karo
        if (node.parentElement && node.parentElement.offsetParent !== null) {
          return node.parentElement;
        }
      }
    }
    return null;
  }

  function findElement(rule) {
    if (rule.mode === 'selector') {
      return document.querySelector(rule.selector);
    }
    if (rule.mode === 'text') {
      return findByText(rule.find);
    }
    // default: text
    return findByText(rule.find || rule.selector);
  }

  async function runRules() {
    const rules = await loadRules();
    if (!rules.length) return;

    const url = location.href;

    rules.forEach((rule, idx) => {
      // URL match check
      if (rule.match && !url.includes(rule.match)) return;

      // once mode: already fired?
      if (rule.once && firedOnce.has(idx)) return;

      const maxTries = rule.maxTries || 30;
      let tries = 0;

      const tryOnce = () => {
        const el = findElement(rule);
        if (el && el.offsetParent !== null) {
          try {
            if (rule.action === 'copy') {
              const txt = (el.textContent || '').trim();
              navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {});
              console.log('[JFH-AutoClick] Copied:', txt);
            } else {
              el.click();
              console.log('[JFH-AutoClick] Clicked:', rule.find || rule.selector);
            }
            if (rule.once) firedOnce.add(idx);
          } catch (e) {
            console.warn('[JFH-AutoClick] Action failed:', e.message);
          }
          return true;
        }
        return false;
      };

      // immediate try
      if (tryOnce()) return;

      // poll until found or maxTries
      const timer = setInterval(() => {
        tries++;
        if (tryOnce()) {
          clearInterval(timer);
          return;
        }
        if (tries >= maxTries) {
          clearInterval(timer);
          console.log('[JFH-AutoClick] Gave up after', maxTries, 'tries:', rule.find || rule.selector);
        }
      }, POLL_MS);
    });
  }

  // Run on load + jab bhi DOM badle (lazy loaded buttons)
  function init() {
    runRules();
    // MutationObserver se naye elements aate hi re-check
    const obs = new MutationObserver(() => runRules());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // also re-run on full load
    window.addEventListener('load', runRules);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
