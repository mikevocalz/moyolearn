/**
 * TEMPORARY verification surface for chapters 04 and 05. Not part of the site.
 * Delete before handing back.
 *
 * SOT-KEYWORDS: temporary chapters lab verification prerender
 */
import { createFileRoute } from '@tanstack/react-router';
import { Heading } from '@acme/ui/typography';
import { Main } from '@acme/ui/primitives';
import { TutorRoomChapter } from '@/components/chapters/tutor-room';
import { WorldChapter } from '@/components/chapters/world';

export const Route = createFileRoute('/chapters-lab')({
  head: () => ({
    meta: [
      { title: 'Chapters lab — Moyo' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ChaptersLab,
});

function ChaptersLab() {
  return (
    <Main className="bg-moyo-paper">
      <Heading level={1} className="sr-only">
        Chapters lab
      </Heading>
      <WorldChapter />
      <TutorRoomChapter />
    </Main>
  );
}
