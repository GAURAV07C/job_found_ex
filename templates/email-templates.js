/**
 * Job Founder Hunter - Email Templates
 * Variables: {{founder_name}}, {{company_name}}, {{founder_title}},
 *            {{your_name}}, {{your_skills}}, {{resume_link}}, {{position}}, {{your_email}}
 */

const JFH_Templates = {
  templates: [
    {
      id: 'gaurav_direct',
      name: '⚡ Gaurav Direct Outreach (New)',
      description: 'Short and direct outreach for founders',
      subject: 'Full Stack Engineer for {{company_name}}',
      body: `Hi {{founder_name}},

I'm Gaurav, a Full Stack Engineer currently building production applications with Node.js, TypeScript, React, Next.js, PostgreSQL, and Redis.

I'm exploring my next opportunity and wanted to reach out directly. If {{company_name}} is hiring now—or expects to hire in the coming months—I would love to be considered. 

I'd love to share some ideas or see if there's a fit for me on your team. 

Resume: {{resume_link}}

Thanks for your time.

Best,
Gaurav Kumar
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}`,
    },
    {
      id: 'gaurav_custom',
      name: '🚀 Gaurav Custom Outreach',
      description: 'Personalized template based on your resume',
      subject: 'Full Stack Developer (Next.js/Node.js) interested in {{company_name}}',
      body: `Hi {{founder_name}},

I came across {{company_name}} and love what you're building! As a Full Stack Developer, I specialize in building scalable web applications. I've built everything from an AI-powered CRM using Node.js/Express, to an Automated Production Planning system using Next.js.

I also actively contribute to open-source projects like Cal.com and thrive in fast-paced environments.

My core tech stack: {{your_skills}}

I'm currently looking for a {{position}} role and would love to bring my experience in building robust full-stack applications to your team.

My Resume: {{resume_link}}

Would love to chat if you're open to it. No pressure!

Best regards,
{{your_name}}
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}
Portfolio: {{portfolio_link}}`,
    },
    {
      id: 'professional',
      name: '🎯 Professional Outreach',
      description: 'Formal and professional cold email',
      subject: 'Excited to Contribute to {{company_name}} — {{position}} Opportunity',
      body: `Hi {{founder_name}},

I hope this message finds you well. I came across {{company_name}} while exploring innovative startups, and I'm genuinely impressed by the work your team is doing.

I'm {{your_name}}, and I specialize in {{your_skills}}. I'm very interested in exploring {{position}} opportunities at {{company_name}} and believe my skills could add real value to your team.

Here's a quick overview of what I bring:
{{your_skills}}

I'd love the opportunity to chat and learn more about your team's goals. Please find my info below:
Resume: {{resume_link}}

Looking forward to hearing from you!

Best regards,
{{your_name}}
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}`,
    },
    {
      id: 'casual',
      name: '💬 Casual & Friendly',
      description: 'Relaxed and approachable tone',
      subject: 'Hey {{founder_name}} — Love What {{company_name}} is Building!',
      body: `Hey {{founder_name}},

I stumbled upon {{company_name}} and honestly, I think what you're building is super cool! 🚀

I'm {{your_name}} — I work with {{your_skills}} and I'm looking for my next challenge. When I saw {{company_name}}, I knew I had to reach out.

I think I could be a great fit for a {{position}} role. Here is my resume:
Resume: {{resume_link}}

Would love to hop on a quick call to chat — no pressure at all!

Cheers,
{{your_name}}
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}`,
    },
    {
      id: 'technical',
      name: '💻 Technical Role',
      description: 'For engineering/technical positions',
      subject: 'Full-Stack Developer Interested in {{company_name}} — {{position}}',
      body: `Hi {{founder_name}},

I'm {{your_name}}, a developer with experience in {{your_skills}}. I recently discovered {{company_name}} and I'm excited about the technical challenges your team is tackling.

A few highlights about my background:
• Tech Stack: {{your_skills}}
• I'm passionate about building scalable, user-centric products
• I thrive in fast-paced startup environments

I'd love to discuss how I can contribute to {{company_name}} as a {{position}}. You can check out my work here: {{resume_link}}

Would you be open to a brief conversation?

Best,
{{your_name}}
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}`,
    },
    {
      id: 'value_prop',
      name: '💡 Value Proposition',
      description: 'Focus on what you can bring to the table',
      subject: 'I Can Help {{company_name}} — Here\'s How',
      body: `Hi {{founder_name}},

Congrats on what you're building at {{company_name}}! As a {{founder_title}}, I'm sure you're looking for talented people who can hit the ground running.

I'm {{your_name}}, and here's what I can bring to your team:

🔹 {{your_skills}}
🔹 Startup experience — I understand the hustle
🔹 Passion for building products that matter

I'm actively looking for {{position}} roles at startups like {{company_name}} that are making a real impact.

Resume/Portfolio: {{resume_link}}

I'd be thrilled to connect and discuss further. Even a 15-minute chat would be great!

Warm regards,
{{your_name}}
{{your_email}}
GitHub: {{github_link}}
LinkedIn: {{linkedin_link}}`,
    },
  ],
  customTemplates: [],

  /**
   * Load custom templates into the engine
   */
  loadCustomTemplates(templates) {
    if (Array.isArray(templates)) {
      this.customTemplates = templates;
    }
  },

  /**
   * Get all available templates (custom + default)
   */
  getAllTemplates() {
    return [...this.customTemplates, ...this.templates];
  },

  /**
   * Get template by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getTemplate(id) {
    return this.getAllTemplates().find(t => t.id === id) || null;
  },

  /**
   * Get all template summaries
   * @returns {Array}
   */
  getTemplateSummaries() {
    return this.getAllTemplates().map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }));
  },

  /**
   * Render a template with data
   * @param {string} templateId
   * @param {Object} data
   * @returns {{subject: string, body: string}|null}
   */
  render(templateId, data) {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const renderStr = (str) => {
      let result = str;
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, value || '');
      }
      return result;
    };

    return {
      subject: renderStr(template.subject),
      body: renderStr(template.body),
    };
  },
};

if (typeof window !== 'undefined') {
  window.JFH_Templates = JFH_Templates;
}
