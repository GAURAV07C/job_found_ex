/**
 * Job Founder Hunter - Modal Module
 */

function initModal({ loadDataView, updateStats }) {
  const modal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const editForm = document.getElementById('edit-founder-form');

  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.JFH_Modal = {
    open(founder) {
      document.getElementById('edit-id').value = founder.id;
      document.getElementById('edit-name').value = founder.name || '';
      document.getElementById('edit-title').value = founder.title || '';
      document.getElementById('edit-company').value = founder.companyName || '';
      document.getElementById('edit-email').value = founder.email || '';
      document.getElementById('edit-linkedin').value = founder.linkedinUrl || '';
      document.getElementById('edit-contacted').checked = founder.contacted || false;

      modal.style.display = 'flex';
    }
  };

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;

    const founder = await JFH_DB.getFounder(id);
    if (!founder) return;

    founder.name = document.getElementById('edit-name').value;
    founder.title = document.getElementById('edit-title').value;
    founder.companyName = document.getElementById('edit-company').value;

    const newEmail = document.getElementById('edit-email').value.trim();
    if (newEmail !== founder.email) {
      founder.email = newEmail;
      if (newEmail && !founder.contacted) founder.status = 'email_found';
    }

    founder.linkedinUrl = document.getElementById('edit-linkedin').value;

    const isContacted = document.getElementById('edit-contacted').checked;
    if (isContacted && !founder.contacted) {
      founder.contacted = true;
      founder.contactedAt = Date.now();
      founder.status = 'email_sent';
    } else if (!isContacted && founder.contacted) {
      founder.contacted = false;
      founder.status = founder.email ? 'email_found' : 'pending';
    }

    await JFH_DB.updateFounder(founder);
    modal.style.display = 'none';
    if (loadDataView) loadDataView();
    if (updateStats) updateStats();
  });
}

window.JFH_ModalModule = { initModal };
