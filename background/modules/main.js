/**
 * Job Founder Hunter - Background Main Module
 * Entry point: initializes all modules and wires remaining listeners.
 */

// ========== Settings Helper ==========
async function saveSettings(settings) {
  for (const [key, value] of Object.entries(settings)) {
    await JFH_DB.saveSetting(key, value);
  }
  return { success: true };
}

// ========== Bulk Drafts Completed Listener ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BULK_DRAFTS_COMPLETED') {
    JFH_State.isRunning = false;
    JFH_State.currentTask = null;
    broadcastState({ message: 'All drafts sent!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icon128.png',
      title: 'Drafts Sent',
      message: `Successfully sent ${message.data.count} drafts.`
    });

    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id).catch(e => console.log(e));
    }
  }
});

// ========== Initialize ==========
function init() {
  // Register the main message router (must be after all modules are loaded)
  setupMessageRouter();
  console.log('[JFH] Service Worker initialized with modules');
}

// Auto-init on load
init();
