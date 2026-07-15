/**
 * Job Founder Hunter - Profile Module
 */

function initProfile({ updateStats, refreshBackendSendButton }) {
  const templateSelect = document.getElementById('set-template');

  function renderTemplateOptions() {
    templateSelect.innerHTML = '';
    JFH_Templates.getTemplateSummaries().forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      templateSelect.appendChild(opt);
    });
  }

  // Load existing profile & templates
  JFH_DB.getAllSettings().then((settings) => {
    if (settings.customTemplates) {
      try {
        JFH_Templates.loadCustomTemplates(JSON.parse(settings.customTemplates));
      } catch (e) { console.error(e); }
    }
    renderTemplateOptions();

    const map = {
      userName: 'set-name', userEmail: 'set-email', targetPosition: 'set-position',
      userSkills: 'set-skills', resumeLink: 'set-resume', portfolioLink: 'set-portfolio',
      githubLink: 'set-github', linkedinLink: 'set-linkedin',
      experience: 'set-experience', availability: 'set-availability',
      workMode: 'set-work-mode', salary: 'set-salary',
      wasTplFrontend: 'was-tpl-frontend', wasTplBackend: 'was-tpl-backend',
      wasTplFullstack: 'was-tpl-fullstack', wasTplDefault: 'was-tpl-default',
      qaWhyCompany: 'qa-why-company', qaAboutMe: 'qa-about-me',
      qaLookingFor: 'qa-looking-for', qaAchievement: 'qa-achievement',
      qaWhyLeaving: 'qa-why-leaving',
    };

    Object.entries(map).forEach(([key, id]) => {
      if (settings[key] && document.getElementById(id)) {
        document.getElementById(id).value = settings[key];
      }
    });

    if (settings.emailActionMode && document.getElementById('set-action-mode')) {
      document.getElementById('set-action-mode').value = settings.emailActionMode;
    }
    if (settings.selectedTemplate && templateSelect) {
      if (Array.from(templateSelect.options).some((o) => o.value === settings.selectedTemplate)) {
        templateSelect.value = settings.selectedTemplate;
      }
    }

    const backendUrlInput = document.getElementById('set-backend-url');
    const backendKeyInput = document.getElementById('set-backend-key');
    if (backendUrlInput) backendUrlInput.value = settings.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL;
    if (backendKeyInput) backendKeyInput.value = settings.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY;
  });

  // Custom Template Logic
  const toggleTpl = document.getElementById('toggle-custom-template');
  const tplBuilder = document.getElementById('custom-template-builder');
  toggleTpl?.addEventListener('click', () => {
    tplBuilder.style.display = tplBuilder.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-save-custom-tpl')?.addEventListener('click', async () => {
    const name = document.getElementById('custom-tpl-name').value;
    const subject = document.getElementById('custom-tpl-subject').value;
    const body = document.getElementById('custom-tpl-body').value;

    if (!name || !subject || !body) {
      alert("Please fill all template fields!");
      return;
    }

    const newTpl = {
      id: 'custom_' + Date.now(),
      name: '🛠️ ' + name,
      description: 'Custom User Template',
      subject,
      body
    };

    const allCustom = [...JFH_Templates.customTemplates, newTpl];
    JFH_Templates.loadCustomTemplates(allCustom);
    await JFH_DB.saveSetting('customTemplates', JSON.stringify(allCustom));

    renderTemplateOptions();
    templateSelect.value = newTpl.id;
    tplBuilder.style.display = 'none';

    document.getElementById('custom-tpl-name').value = '';
    document.getElementById('custom-tpl-subject').value = '';
    document.getElementById('custom-tpl-body').value = '';
  });

  // Preview
  const previewBtn = document.getElementById('btn-preview-email');
  const previewBox = document.getElementById('email-preview-box');
  previewBtn?.addEventListener('click', () => {
    const templateId = document.getElementById('set-template').value;
    const dummyData = {
      founder_name: 'Alex', company_name: 'Acme Startup', founder_title: 'CEO',
      your_name: document.getElementById('set-name').value || '[Your Name]',
      your_skills: document.getElementById('set-skills').value || '[Skills]',
      resume_link: document.getElementById('set-resume').value || '[Resume]',
      portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
      github_link: document.getElementById('set-github').value || '[GitHub]',
      linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
      position: document.getElementById('set-position').value || '[Position]',
      your_email: document.getElementById('set-email').value || '[Your Email]'
    };

    const rendered = JFH_Templates.render(templateId, dummyData);
    if (previewBox.style.display === 'block') {
      previewBox.style.display = 'none';
    } else {
      previewBox.innerHTML = `<strong>Subject:</strong> ${rendered.subject}<br><br>${rendered.body}`;
      previewBox.style.display = 'block';
    }
  });

  // Test Mail to Self
  const testMailBtn = document.getElementById('btn-test-mail');
  const testMailStatus = document.getElementById('test-mail-status');

  const buildTestMail = () => {
    const userEmail = document.getElementById('set-email').value.trim();
    const templateId = document.getElementById('set-template').value;
    const dummyData = {
      founder_name: 'Alex', company_name: 'Acme Startup', founder_title: 'CEO',
      your_name: document.getElementById('set-name').value || '[Your Name]',
      your_skills: document.getElementById('set-skills').value || '[Skills]',
      resume_link: document.getElementById('set-resume').value || '[Resume]',
      portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
      github_link: document.getElementById('set-github').value || '[GitHub]',
      linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
      position: document.getElementById('set-position').value || '[Position]',
      your_email: userEmail
    };
    const rendered = JFH_Templates.render(templateId, dummyData);
    return { userEmail, rendered };
  };

  testMailBtn?.addEventListener('click', async () => {
    const { userEmail, rendered } = buildTestMail();

    if (!userEmail || !userEmail.includes('@')) {
      testMailStatus.textContent = '⚠️ Please enter a valid email address first (Personal Details > Email Address).';
      testMailStatus.style.display = 'block';
      return;
    }
    if (!rendered) {
      testMailStatus.textContent = '⚠️ Could not render template.';
      testMailStatus.style.display = 'block';
      return;
    }

    const subject = `[TEST] ${rendered.subject}`;
    const body = rendered.body;
    const auth = {
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };

    testMailStatus.textContent = '⏳ Sending test mail via backend...';
    testMailStatus.style.display = 'block';
    const res = await JFH_Helpers.sendEmailViaBackend(
      { to: userEmail, subject, body, replyTo: userEmail },
      auth
    );

    if (res.success) {
      testMailStatus.textContent = `✅ Test mail queued! (${res.queued} email(s)) Tracking active. It will arrive at ${userEmail}.`;
    } else {
      console.warn('[test mail] backend failed, falling back to Gmail:', res.message);
      const encodedTo = encodeURIComponent(userEmail);
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      const gmailComposeUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
      chrome.tabs.create({ url: gmailComposeUrl, active: true });
      testMailStatus.textContent = '⚠️ Backend unavailable (' + (res.message || '') + '). Opened Gmail draft instead — no tracking.';
    }
    testMailStatus.style.display = 'block';
  });

  // Custom test email
  const testMailCustomBtn = document.getElementById('btn-test-mail-custom');
  const testMailToInput = document.getElementById('test-mail-to');
  testMailCustomBtn?.addEventListener('click', async () => {
    const to = testMailToInput.value.trim();
    if (!to || !to.includes('@')) {
      testMailStatus.textContent = '⚠️ Please enter a valid email address.';
      testMailStatus.style.display = 'block';
      return;
    }
    const templateId = document.getElementById('set-template').value;
    const dummyData = {
      founder_name: 'Alex', company_name: 'Acme Startup', founder_title: 'CEO',
      your_name: document.getElementById('set-name').value || '[Your Name]',
      your_skills: document.getElementById('set-skills').value || '[Skills]',
      resume_link: document.getElementById('set-resume').value || '[Resume]',
      portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
      github_link: document.getElementById('set-github').value || '[GitHub]',
      linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
      position: document.getElementById('set-position').value || '[Position]',
      your_email: document.getElementById('set-email').value || '[Your Email]'
    };
    const rendered = JFH_Templates.render(templateId, dummyData);
    if (!rendered) {
      testMailStatus.textContent = '⚠️ Could not render template.';
      testMailStatus.style.display = 'block';
      return;
    }

    const subject = `[TEST] ${rendered.subject}`;
    const body = rendered.body;
    const auth = {
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };
    testMailStatus.textContent = '⏳ Sending test mail to ' + to + '...';
    testMailStatus.style.display = 'block';
    const res = await JFH_Helpers.sendEmailViaBackend(
      { to, subject, body, replyTo: document.getElementById('set-email').value },
      auth
    );
    if (res.success) {
      testMailStatus.textContent = `✅ Test mail queued to ${to}! (${res.queued} email(s)) Tracking active.`;
    } else {
      testMailStatus.textContent = '❌ ' + (res.message || 'Backend send failed.');
    }
    testMailStatus.style.display = 'block';
  });

  // Test Backend Connection
  const testBackendBtn = document.getElementById('btn-test-backend');
  const backendStatus = document.getElementById('backend-test-status');
  testBackendBtn?.addEventListener('click', async () => {
    const auth = {
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };
    backendStatus.textContent = '⏳ Connecting...';
    backendStatus.style.display = 'block';
    const ok = await JFH_Helpers.pingBackend(auth);
    backendStatus.textContent = ok
      ? '✅ Backend connected!'
      : '❌ Backend not reachable. Is the server running? (node server/src/server.js)';
    backendStatus.style.color = ok ? 'var(--primary)' : '#ff6b6b';
    backendStatus.style.display = 'block';
  });

  // Save Profile
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSettings = {
      userName: document.getElementById('set-name').value,
      userEmail: document.getElementById('set-email').value,
      targetPosition: document.getElementById('set-position').value,
      userSkills: document.getElementById('set-skills').value,
      resumeLink: document.getElementById('set-resume').value,
      portfolioLink: document.getElementById('set-portfolio').value,
      githubLink: document.getElementById('set-github').value,
      linkedinLink: document.getElementById('set-linkedin').value,
      emailActionMode: document.getElementById('set-action-mode').value,
      selectedTemplate: document.getElementById('set-template').value,
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      backendApiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
      experience: document.getElementById('set-experience').value,
      availability: document.getElementById('set-availability').value,
      workMode: document.getElementById('set-work-mode').value,
      salary: document.getElementById('set-salary').value,
      wasTplFrontend: document.getElementById('was-tpl-frontend').value,
      wasTplBackend: document.getElementById('was-tpl-backend').value,
      wasTplFullstack: document.getElementById('was-tpl-fullstack').value,
      wasTplDefault: document.getElementById('was-tpl-default').value,
      qaWhyCompany: document.getElementById('qa-why-company').value,
      qaAboutMe: document.getElementById('qa-about-me').value,
      qaLookingFor: document.getElementById('qa-looking-for').value,
      qaAchievement: document.getElementById('qa-achievement').value,
      qaWhyLeaving: document.getElementById('qa-why-leaving').value,
    };

    for (const [key, value] of Object.entries(newSettings)) {
      await JFH_DB.saveSetting(key, value);
    }

    const msg = document.getElementById('profile-save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);

    if (refreshBackendSendButton) refreshBackendSendButton();
  });
}

window.JFH_Profile = { initProfile };
