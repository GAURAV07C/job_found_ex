/**
 * Job Founder Hunter - Tabs Module
 */

function initTabs({ onData, onHome, onDashboard }) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');

      if (btn.dataset.tab === 'data' && onData) onData();
      if (btn.dataset.tab === 'home' && onHome) onHome();
      if (btn.dataset.tab === 'dashboard' && onDashboard) onDashboard();
    });
  });
}

window.JFH_Tabs = { initTabs };
