/**
 * Marketing content-page copy.
 *
 * This is the source of truth for the standalone pages linked from the footer.
 * It is separated from the route files so the strings can be reviewed and
 * snapshot-tested without touching layout. Every string follows the Moyo voice:
 * warm, plain, specific; sentence case; contractions yes; no legal theater.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · docs/site/copy-deck.md §10
 * SOT-KEYWORDS: copy content pages safety privacy terms about contact faq footer
 */

export const EMAIL = 'info@moyolearn.com' as const;

export const safety = {
  heading: 'Safety at Moyo',
  lead: 'Moyo is built for children. Every design choice starts with the question: is this safe for a learner?',
  sections: [
    {
      title: 'AI guardrails',
      body: 'Natalie, the tutor, is instructed to coach rather than answer. She stays grade-appropriate, refuses harmful requests, and helps the learner explain what they already know before trying the next step.',
    },
    {
      title: 'Human review',
      body: 'Safety incidents and edge cases are reviewed by a human team. We do not train our models on a child\'s sessions without explicit consent.',
    },
    {
      title: 'No ads, no selling data',
      body: 'Moyo has no advertising and no data brokers. A learner\'s sessions, mistakes, and progress are never for sale.',
    },
    {
      title: 'Report a concern',
      body: `If something does not feel right, email us at ${EMAIL} and a real person will read it.`,
    },
  ],
} as const;

export const privacy = {
  heading: 'Privacy',
  lead: 'Your family\'s information is not our product. Moyo collects only what is needed to tutor your child and keep the account secure.',
  sections: [
    {
      title: 'What we collect',
      body: 'The learner\'s name, grade level, prompts and answers during sessions, and any photos a grown-up chooses to share for homework help. We also collect the email and payment information tied to the account.',
    },
    {
      title: 'Why we collect it',
      body: 'To personalize the tutor\'s voice and difficulty, to generate the session report, and to let grown-ups see progress. Payment information is used only for billing.',
    },
    {
      title: 'Who sees it',
      body: 'The learner\'s data is shared only with the grown-ups on the family account, the Moyo safety team when needed, and the service providers that run our infrastructure under strict contracts.',
    },
    {
      title: 'Your choices',
      body: `You can cancel anytime, export your data, or ask us to delete it by emailing ${EMAIL}.`,
    },
  ],
} as const;

export const childrens = {
  heading: 'Children\'s Privacy',
  lead: 'Moyo is designed for learners, and that changes how we treat information. We follow COPPA, FERPA-aligned practices, and one simple rule: collect less, keep it safe, and give parents control.',
  sections: [
    {
      title: 'Parental consent',
      body: 'A grown-up must create the account and add learners. We do not knowingly allow a child under 13 to sign up alone.',
    },
    {
      title: 'No advertising',
      body: 'We do not show ads to children or target them with marketing. We do not sell a child\'s data to anyone.',
    },
    {
      title: 'Parent rights',
      body: `Parents can review a learner\'s sessions, delete the learner\'s data, or cancel the account at any time. To request deletion or a copy of your data, email ${EMAIL}.`,
    },
  ],
} as const;

export const terms = {
  heading: 'Terms',
  lead: 'By using Moyo, you agree to these terms. We have written them in plain language so you actually know what you are agreeing to.',
  sections: [
    {
      title: 'Accounts',
      body: 'Moyo accounts are for families and their learners. You must be 18 or older to create an account and add a learner.',
    },
    {
      title: 'Payments and trials',
      body: 'New subscriptions start with a 30-day free trial. After that, the plan you chose renews monthly. You can cancel anytime in the app; your access continues through the paid period.',
    },
    {
      title: 'Acceptable use',
      body: 'Moyo is a learning tool. Do not use it to generate harmful content, impersonate others, or attempt to bypass the safety guardrails.',
    },
    {
      title: 'Changes',
      body: 'If we change these terms or our pricing, we will email you and give you a chance to cancel before the change takes effect.',
    },
  ],
} as const;

export const about = {
  heading: 'About Moyo',
  lead: 'Moyo is an AI tutor for children: patient, safe, and built to turn practice into understanding that lasts.',
  sections: [
    {
      title: 'What Moyo does',
      body: 'Most homework tools hand out answers. Moyo does not. Natalie, the tutor, asks questions, points out what a learner already knows, and guides them to the next step. A parent gets a real report after every session, not a score.',
    },
    {
      title: 'Why we made it',
      body: 'We started Moyo because a child should not need a parent who can tutor every subject. The product is designed for the dinner-table moment: the learner is stuck, the grown-up is busy, and someone still needs to explain it well.',
    },
    {
      title: 'Who we are',
      body: 'Moyo is made by a small team of teachers, engineers, and parents in New York.',
    },
  ],
} as const;

export const contact = {
  heading: 'Contact',
  lead: 'We read every message. If you have a question, a safety concern, or a school inquiry, write to us.',
  sections: [
    {
      title: 'Email',
      body: `The best way to reach us is ${EMAIL}. A real person reads every message.`,
    },
    {
      title: 'Schools and business',
      body: `For schools, tutoring businesses, or press, use the same address and it will reach the right person.`,
    },
    {
      title: 'Response time',
      body: 'Moyo does not have a public phone line, but we aim to reply to every email within one business day.',
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
      q: 'Does Moyo give answers?',
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
