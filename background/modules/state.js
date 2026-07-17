/**
 * Job Founder Hunter - Background State Module
 */

// ========== Global State ==========
let isRunning = false;
let isPaused = false;
let currentTask = null; // 'scraping' | 'emailing' | 'finding' | 'sending_backend' | 'sending_drafts'
let targetBatch = [];
let currentIndex = 0;
let findOnlyMode = false;
let useMailmeteor = false;
let linkedInSafetyTimer = null;
let completedCount = 0;
let failedCount = 0;

// Founder scraping state
let founderScrapeQueue = [];
let founderScrapeIndex = 0;
let founderScrapeTabId = null;
let isFounderScraping = false;

// WAS auto-apply state
let wasApplyQueue = [];
let wasApplyIndex = 0;
let wasApplyTabId = null;
let isWasApplying = false;

// ========== Broadcast Helpers ==========
function broadcastState(extra = {}) {
  const total = targetBatch.length;
  const progress = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATE',
    data: {
      isRunning,
      isPaused,
      currentTask,
      progress,
      currentIndex,
      totalCount: total,
      completedCount,
      failedCount,
      pendingCount: Math.max(total - currentIndex, 0),
      currentFounder: extra.currentFounder || '',
      message: extra.message || '',
      ...extra
    }
  }).catch(() => {});
}

function broadcastFounderScrapeState(extra = {}) {
  const progress = founderScrapeQueue.length > 0
    ? Math.round((founderScrapeIndex / founderScrapeQueue.length) * 100)
    : 0;

  chrome.runtime.sendMessage({
    type: 'FOUNDER_SCRAPE_UPDATE',
    data: {
      isRunning: isFounderScraping,
      progress,
      current: founderScrapeIndex,
      total: founderScrapeQueue.length,
      ...extra
    }
  }).catch(() => {});
}

function broadcastWasState(extra = {}) {
  const progress = wasApplyQueue.length > 0
    ? Math.round((wasApplyIndex / wasApplyQueue.length) * 100)
    : 0;

  chrome.runtime.sendMessage({
    type: 'WAS_APPLY_UPDATE',
    data: {
      isRunning: isWasApplying,
      progress,
      current: wasApplyIndex,
      total: wasApplyQueue.length,
      ...extra
    }
  }).catch(() => {});
}

// Expose state getters/setters for modules
const JFH_State = {
  get isRunning() { return isRunning; },
  set isRunning(v) { isRunning = v; },
  get isPaused() { return isPaused; },
  set isPaused(v) { isPaused = v; },
  get currentTask() { return currentTask; },
  set currentTask(v) { currentTask = v; },
  get targetBatch() { return targetBatch; },
  set targetBatch(v) { targetBatch = v; },
  get currentIndex() { return currentIndex; },
  set currentIndex(v) { currentIndex = v; },
  get findOnlyMode() { return findOnlyMode; },
  set findOnlyMode(v) { findOnlyMode = v; },
  get useMailmeteor() { return useMailmeteor; },
  set useMailmeteor(v) { useMailmeteor = v; },
  get linkedInSafetyTimer() { return linkedInSafetyTimer; },
  set linkedInSafetyTimer(v) { linkedInSafetyTimer = v; },
  get founderScrapeQueue() { return founderScrapeQueue; },
  set founderScrapeQueue(v) { founderScrapeQueue = v; },
  get founderScrapeIndex() { return founderScrapeIndex; },
  set founderScrapeIndex(v) { founderScrapeIndex = v; },
  get founderScrapeTabId() { return founderScrapeTabId; },
  set founderScrapeTabId(v) { founderScrapeTabId = v; },
  get isFounderScraping() { return isFounderScraping; },
  set isFounderScraping(v) { isFounderScraping = v; },
  get wasApplyQueue() { return wasApplyQueue; },
  set wasApplyQueue(v) { wasApplyQueue = v; },
  get wasApplyIndex() { return wasApplyIndex; },
  set wasApplyIndex(v) { wasApplyIndex = v; },
  get wasApplyTabId() { return wasApplyTabId; },
  set wasApplyTabId(v) { wasApplyTabId = v; },
  get isWasApplying() { return isWasApplying; },
  set isWasApplying(v) { isWasApplying = v; },
};
