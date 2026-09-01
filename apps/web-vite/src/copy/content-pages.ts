/**
 * Marketing content-page copy.
 *
 * This is the source of truth for the standalone pages linked from the footer.
 * It is separated from the route files so the strings can be reviewed and
 * snapshot-tested without touching layout. Every string follows the Moyo voice:
 * warm, plain, specific; sentence case; contractions yes; no legal theater.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · .claude/skills/cognitive-load-conversion/SKILL.md
 *      docs/site/copy-deck.md §10
 * SOT-KEYWORDS: copy content pages safety privacy terms about contact faq footer
 */

export const EMAIL = 'info@moyolearn.com' as const;

export const safety = {
  heading: 'Safety at Moyo',
  lead: 'Moyo is built for children. If it is not safe for a learner, we do not ship it.',
  sections: [
    {
      title: 'AI guardrails',
      body: 'Natalie coaches, not answers. She speaks at the right grade level, refuses harmful requests, and asks the learner to explain what they already know before trying the next step.',
    },
    {
      title: 'Human review',
      body: 'People review safety incidents. We do not train models on a child\'s sessions without explicit consent.',
    },
    {
      title: 'No ads, no selling data',
      body: 'No ads to children. No data brokers. A learner\'s progress is not for sale.',
    },
    {
      title: 'Report a concern',
      body: `Something feel off? Email ${EMAIL}. A real person reads it.`,
    },
  ],
} as const;

export const privacy = {
  heading: 'Privacy',
  lead: 'We collect only what we need to tutor your child and run the account. Your data is not our product.',
  sections: [
    {
      title: 'What we collect',
      body: 'Learner name, grade level, prompts and answers, and any photos a grown-up adds for homework help. Email and payment info for the account.',
    },
    {
      title: 'Why we collect it',
      body: 'To match the tutor to the learner, build the session report, and let grown-ups track progress. Payment info is for billing only.',
    },
    {
      title: 'Who sees it',
      body: 'Grown-ups on the account, the Moyo safety team when needed, and a few contracted service providers. That is it.',
    },
    {
      title: 'Your choices',
      body: `Cancel, export, or delete your data anytime. Email ${EMAIL}.`,
    },
  ],
} as const;

export const childrens = {
  heading: 'Children\'s Privacy',
  lead: 'A grown-up is in charge. We follow COPPA and FERPA-aligned practices, and we keep it simple: collect less, protect it, and give parents control.',
  sections: [
    {
      title: 'Parental consent',
      body: 'A grown-up creates the account and adds each learner. We do not allow children under 13 to sign up alone.',
    },
    {
      title: 'No advertising',
      body: 'No ads to children. No selling a child\'s data. Ever.',
    },
    {
      title: 'Parent rights',
      body: `Review sessions, delete data, or cancel the account anytime. Request a copy or deletion by emailing ${EMAIL}.`,
    },
  ],
} as const;

export const terms = {
  heading: 'Terms',
  lead: 'These terms are plain. Read them and you will know exactly what you are agreeing to.',
  sections: [
    {
      title: 'Accounts',
      body: 'Moyo accounts are for families. You must be 18 or older to create an account.',
    },
    {
      title: 'Payments and trials',
      body: 'Start with 30 days free. Then your chosen plan renews monthly. Cancel anytime in the app.',
    },
    {
      title: 'Acceptable use',
      body: 'Use Moyo for learning. Do not generate harmful content, impersonate, or bypass the guardrails.',
    },
    {
      title: 'Changes',
      body: 'If we change these terms or pricing, we will email you first. You can cancel before the change takes effect.',
    },
  ],
} as const;

export const about = {
  heading: 'About Moyo',
  lead: 'Moyo is an AI tutor that helps children understand their work instead of copying it.',
  sections: [
    {
      title: 'What Moyo does',
      body: 'Other homework tools hand out the answer. Moyo never just gives it; it teaches the next step. Natalie asks questions, points out what the learner already knows, and guides the next step. Parents get a real report after every session.',
    },
    {
      title: 'Why we made it',
      body: 'No parent can tutor every subject. Moyo is for the dinner-table moment: the learner is stuck, the grown-up is busy, and the explanation still needs to be good.',
    },
    {
      title: 'Who we are',
      body: 'Made by teachers, engineers, and parents in New York.',
    },
  ],
  beliefs: [
    'Learners first. A child should understand the work, not copy an answer.',
    'Safety is not optional. Every feature is checked for the learner before it ships.',
    'Parents are the loop. Grown-ups can see progress, set limits, and step in anytime.',
    'No shortcuts. Real learning takes patience, and Moyo is built for that.',
  ],
} as const;

export const contact = {
  heading: 'Contact',
  lead: 'We read every message. Ask a question, report a concern, or start a school conversation.',
  sections: [
    {
      title: 'Email',
      body: `Email ${EMAIL}. A real person reads it.`,
    },
    {
      title: 'Schools and business',
      body: 'Schools, tutoring businesses, and press: use the same address. It will reach the right person.',
    },
    {
      title: 'Response time',
      body: 'No public phone line. We aim to reply within one business day.',
    },
  ],
} as const;

export const faq = {
  heading: 'FAQ',
  lead: `Common questions about Moyo. If you do not see your question, email us at ${EMAIL}.`,
  faqs: [
    {
      q: 'What is Moyo?',
      a: 'Moyo is an AI tutor for children. It helps learners work through their own homework by asking questions and guiding them to the answer, instead of giving it away.',
    },
    {
      q: 'How much does Moyo cost?',
      a: 'Moyo Plus is $14.99 a month for one learner. Moyo Family is $24.99 a month for up to 3 children. Each additional child after the first 3 is $11 a month.',
    },
    {
      q: 'Is Moyo safe for kids?',
      a: 'Yes. Moyo is built with guardrails, human review, no ads, and no selling of learner data. A grown-up creates the account and can see reports after every session.',
    },
    {
      q: 'Does Moyo complete the work for the learner?',
      a: 'No. Natalie, the tutor, coaches the learner through the problem. The goal is for the child to understand the next step, not to copy a solution.',
    },
    {
      q: 'Can I cancel?',
      a: 'Yes. You can cancel anytime in the app. Your access continues through the current paid month. New accounts get 30 days free.',
    },
    {
      q: 'What ages is Moyo for?',
      a: 'Moyo is designed for learners in elementary through middle school. A grown-up adds each learner and sets the grade level so the tutor speaks at the right level.',
    },
  ],
} as const;
