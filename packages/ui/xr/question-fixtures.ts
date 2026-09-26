/**
 * The XR question fixture set — one `XrLearningQuestion` per row of the
 * acceptance matrix, so layout resolution, transition sequencing and
 * device verification all run the SAME fixtures. Data only: no renderer,
 * no network. Media URIs are fixture keys (`fixture:` scheme) — the host
 * resolves them to bundled assets, and a fixture never leaves the repo's
 * own images.
 *
 * The `XR_FIXTURE_SEQUENCE` at the bottom is the spec's final mixed run —
 * five questions, five subjects, five interaction kinds — the transition
 * matrix, not just the content matrix.
 *
 * SOT: spec §Acceptance Matrix · question-contract.ts · question-content.ts
 * SOT-KEYWORDS: xr question fixtures acceptance matrix subjects locales rtl spanish sequence
 */

import type { XrLearningQuestion } from './question-contract.ts';

const base = {
  uiLocale: 'en-US',
  questionLocale: 'en-US',
  textDirection: 'ltr' as const,
  source: 'practice' as const,
  progress: { index: 1, total: 10 },
};

const choice = (id: string, label: string) => ({ id, label });

export const XR_QUESTION_FIXTURES: readonly XrLearningQuestion[] = [
  {
    ...base,
    id: 'fx-text-only',
    subject: 'math',
    subjectLabel: 'MATH',
    skillLabel: 'MENTAL MATH',
    prompt: 'What is 7 + 5?',
    content: [{ type: 'text', text: 'Work it out in your head, then pick the answer.' }],
    interaction: 'multiple-choice',
    choices: [choice('a', '11'), choice('b', '12'), choice('c', '13'), choice('d', '14')],
    evidence: { questionId: 'fx-text-only', revision: 'r1' },
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-bullet-list',
    subject: 'science',
    subjectLabel: 'SCIENCE',
    skillLabel: 'HABITATS',
    prompt: 'Which things does every habitat need?',
    content: [
      { type: 'text', text: 'A habitat gives a living thing:' },
      { type: 'list', style: 'bullet', items: ['Food', 'Water', 'Shelter', 'Space'] },
      { type: 'text', text: 'Which of these is NOT part of a habitat?', emphasis: 'strong' },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'Food'), choice('b', 'Toys'), choice('c', 'Water'), choice('d', 'Shelter')],
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-numbered-steps',
    subject: 'computer-science',
    subjectLabel: 'COMPUTING',
    skillLabel: 'ALGORITHMS',
    prompt: 'Put the steps in order to brush your teeth.',
    content: [
      { type: 'text', text: 'An algorithm is steps in order.' },
      { type: 'list', style: 'numbered', items: ['Wet the brush', 'Add toothpaste', 'Brush two minutes', 'Rinse'] },
    ],
    interaction: 'ordering',
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-single-image',
    subject: 'science',
    subjectLabel: 'SCIENCE',
    skillLabel: 'PLANT CELLS',
    prompt: 'What does the green part of the cell do?',
    content: [
      { type: 'heading', text: 'Plant cell' },
      { type: 'text', text: 'Look at the green parts of the cell.' },
      {
        type: 'image',
        source: { kind: 'image', uri: 'fixture:plant-cell.png', alt: 'A labelled diagram of a plant cell with a nucleus, cell wall and green chloroplasts.', caption: 'A plant cell' },
      },
      { type: 'list', style: 'numbered', items: ['They make food from sunlight', 'They store water', 'They hold the cell together'] },
    ],
    interaction: 'diagram-label',
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-image-compare',
    subject: 'history',
    subjectLabel: 'HISTORY',
    skillLabel: 'THEN AND NOW',
    prompt: 'Which photo shows a street 100 years ago?',
    content: [
      {
        type: 'image-grid',
        columns: 2,
        items: [
          { kind: 'image', uri: 'fixture:street-1920.png', alt: 'A black and white photo of a street with horses and carts.' },
          { kind: 'image', uri: 'fixture:street-today.png', alt: 'A colour photo of a street with cars.' },
        ],
      },
      { type: 'text', text: 'Tap the older one.' },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'Left'), choice('b', 'Right')],
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-image-grid',
    subject: 'science',
    subjectLabel: 'SCIENCE',
    skillLabel: 'ANIMAL GROUPS',
    prompt: 'Which animals are mammals?',
    content: [
      {
        type: 'image-grid',
        columns: 2,
        items: [
          { kind: 'image', uri: 'fixture:animal-fox.png', alt: 'A fox.' },
          { kind: 'image', uri: 'fixture:animal-frog.png', alt: 'A frog.' },
          { kind: 'image', uri: 'fixture:animal-whale.png', alt: 'A whale.' },
          { kind: 'image', uri: 'fixture:animal-snake.png', alt: 'A snake.' },
        ],
      },
    ],
    interaction: 'multi-select',
    choices: [choice('a', 'Fox'), choice('b', 'Frog'), choice('c', 'Whale'), choice('d', 'Snake')],
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-diagram-labels',
    subject: 'science',
    subjectLabel: 'SCIENCE',
    skillLabel: 'THE WATER CYCLE',
    prompt: 'Label where evaporation happens.',
    content: [
      {
        type: 'diagram',
        source: { kind: 'image', uri: 'fixture:water-cycle.png', alt: 'The water cycle: sun over a lake, arrows rising to clouds, rain over mountains.' },
        labels: [
          { id: 'evaporation', text: 'Evaporation' },
          { id: 'condensation', text: 'Condensation' },
          { id: 'precipitation', text: 'Precipitation' },
        ],
      },
    ],
    interaction: 'diagram-label',
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-structured-math',
    subject: 'math',
    subjectLabel: 'MATH',
    skillLabel: 'FRACTIONS',
    prompt: 'What is one half plus one quarter?',
    content: [
      { type: 'text', text: 'Add the fractions:' },
      { type: 'equation', expression: ['Add', ['Divide', 1, 2], ['Divide', 1, 4]] },
    ],
    interaction: 'numeric',
    evaluation: { kind: 'server-objective' },
    evidence: { questionId: 'fx-structured-math', revision: 'r1' },
  },
  {
    ...base,
    id: 'fx-table',
    subject: 'science',
    subjectLabel: 'SCIENCE',
    skillLabel: 'MEASURING',
    prompt: 'Which material let the most water through?',
    content: [
      {
        type: 'table',
        columns: [
          { key: 'material', header: 'Material' },
          { key: 'water', header: 'Water through', unit: 'mL' },
        ],
        rows: [
          [{ text: 'Fabric' }, { text: '45', id: 'cell-fabric' }],
          [{ text: 'Paper' }, { text: '80', id: 'cell-paper' }],
          [{ text: 'Plastic' }, { text: '5', id: 'cell-plastic' }],
        ],
      },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'Fabric'), choice('b', 'Paper'), choice('c', 'Plastic')],
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-passage',
    subject: 'reading',
    subjectLabel: 'READING',
    skillLabel: 'COMPREHENSION',
    prompt: 'Why did Maya keep the map?',
    content: [
      {
        type: 'passage',
        title: 'The Map in the Attic',
        text: 'Maya found the map folded inside a tin box in her grandmother\'s attic. It showed their town the way it looked a hundred years ago, when the river ran wide and the mill stood where the library is now. She traced the blue line with her finger and wondered who had drawn it, and whether they had stood in this same room.',
      },
      { type: 'text', text: 'Answer after you have read the passage.' },
    ],
    interaction: 'multiple-choice',
    choices: [
      choice('a', 'It was worth money'),
      choice('b', 'It showed how the town used to look'),
      choice('c', 'Her grandmother told her to'),
      choice('d', 'It was made of tin'),
    ],
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-code',
    subject: 'computer-science',
    subjectLabel: 'COMPUTING',
    skillLabel: 'SEQUENCES',
    prompt: 'What does this program print?',
    content: [
      { type: 'code', language: 'python', code: 'for i in range(3):\n    print(i * 2)' },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', '0 2 4'), choice('b', '2 4 6'), choice('c', '0 1 2'), choice('d', '1 2 3')],
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-map',
    subject: 'geography',
    subjectLabel: 'GEOGRAPHY',
    skillLabel: 'READING MAPS',
    prompt: 'Which city is farthest north?',
    content: [
      {
        type: 'map',
        source: { kind: 'image', uri: 'fixture:europe-map.png', alt: 'A map of Europe with three cities marked.' },
        markers: [
          { id: 'oslo', label: 'Oslo' },
          { id: 'paris', label: 'Paris' },
          { id: 'madrid', label: 'Madrid' },
        ],
      },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'Oslo'), choice('b', 'Paris'), choice('c', 'Madrid')],
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-timeline',
    subject: 'history',
    subjectLabel: 'HISTORY',
    skillLabel: 'SEQUENCE',
    prompt: 'Which event happened first?',
    content: [
      {
        type: 'timeline',
        events: [
          { id: 'e1', label: '1765', detail: 'The stamp tax is passed' },
          { id: 'e2', label: '1773', detail: 'The tea protest in the harbour' },
          { id: 'e3', label: '1776', detail: 'The declaration is signed' },
        ],
      },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', '1765'), choice('b', '1773'), choice('c', '1776')],
    evaluation: { kind: 'server-objective' },
  },
  {
    ...base,
    id: 'fx-homework-region',
    subject: 'math',
    subjectLabel: 'HOMEWORK',
    skillLabel: 'FRACTIONS',
    prompt: 'Finish the working on the board.',
    supportingText: 'From the worksheet you scanned.',
    content: [
      { type: 'document-region', evidenceRegionId: 'region-worksheet-q3' },
      { type: 'equation', expression: ['Add', ['Divide', 1, 3], ['Divide', 1, 6]] },
      { type: 'board' },
    ],
    interaction: 'board-work',
    evidence: { questionId: 'fx-homework-region', revision: 'r1' },
    evaluation: { kind: 'coach-review' },
    source: 'capture',
  },
  {
    ...base,
    id: 'fx-spanish-science',
    subject: 'science',
    subjectLabel: 'CIENCIAS',
    uiLocale: 'en-US',
    questionLocale: 'es-ES',
    skillLabel: 'LAS PLANTAS',
    prompt: '¿Qué necesita la planta para crecer?',
    content: [
      { type: 'text', text: 'Mira la foto y responde.' },
      { type: 'image', source: { kind: 'image', uri: 'fixture:seedling.png', alt: 'Una planta joven creciendo en tierra con sol y agua.', caption: 'Una planta joven' } },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'Luz, agua y tierra'), choice('b', 'Juguetes'), choice('c', 'Nieve'), choice('d', 'Piedras')],
    evaluation: { kind: 'coach-review' },
  },
  {
    ...base,
    id: 'fx-long-list',
    subject: 'english-language-arts',
    subjectLabel: 'ENGLISH',
    skillLabel: 'VOCABULARY',
    prompt: 'Which of these words means "happy"?',
    content: [
      {
        type: 'list',
        style: 'bullet',
        /* Deliberately long — the pseudo-localized overflow row of the
           acceptance matrix; the resolver must page it, not shrink it. */
        items: [
          'joyful', 'delighted', 'content', 'gleeful', 'elated', 'cheerful',
          'gloomy', 'sorrowful', 'mournful', 'miserable', 'downcast', 'forlorn',
          'pleased', 'thrilled', 'blissful', 'ecstatic', 'morose', 'jubilant',
          'despondent', 'melancholy', 'heartbroken', 'crestfallen', 'dejected', 'lugubrious',
          'euphoric', 'exuberant', 'radiant', 'buoyant', 'effervescent', 'vivacious',
          'desolate', 'disconsolate', 'woebegone', 'dolorous', 'plaintive', 'lachrymose',
          'exhilarated', 'rapturous', 'transported', 'beatific', 'serene', 'halcyon',
        ],
      },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'joyful'), choice('b', 'gloomy'), choice('c', 'mournful'), choice('d', 'forlorn')],
    evaluation: { kind: 'ungraded' },
  },
  {
    ...base,
    id: 'fx-rtl',
    subject: 'world-language',
    subjectLabel: 'اللغة',
    uiLocale: 'en-US',
    questionLocale: 'ar-SA',
    textDirection: 'rtl',
    skillLabel: 'القراءة',
    prompt: 'ما لون السماء في يوم صافٍ؟',
    content: [
      { type: 'text', text: 'اقرأ السؤال ثم اختر الإجابة الصحيحة.' },
    ],
    interaction: 'multiple-choice',
    choices: [choice('a', 'أزرق'), choice('b', 'أخضر'), choice('c', 'أحمر'), choice('d', 'أسود')],
    evaluation: { kind: 'coach-review' },
  },
];

/**
 * The spec's final mixed sequence — five subjects, five layouts, run
 * through the same next-question transition path.
 */
export const XR_FIXTURE_SEQUENCE: readonly string[] = [
  'fx-text-only',        /* English math multiple choice          */
  'fx-spanish-science',  /* Spanish science with an image         */
  'fx-passage',          /* English reading comprehension         */
  'fx-homework-region',  /* math expression + board work          */
  'fx-rtl',              /* world-language listening/speaking row  */
];

export function fixtureById(id: string): XrLearningQuestion | null {
  return XR_QUESTION_FIXTURES.find((q) => q.id === id) ?? null;
}
