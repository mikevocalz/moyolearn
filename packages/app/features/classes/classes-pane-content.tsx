'use client';
// ClassesPaneScreen — the contract's `Classes | detail` shell: the AdaptivePanes
// host around the EXISTING ClassesScreen (primary list) and the class/student
// details — composed and moved, never rebuilt (the reports-pane precedent,
// third-consumer rule). On expanded widths the selection renders beside the
// list and survives the fold (scoped store, doc 37 §3.2); on compact the host
// shows the list alone and rows keep their navigate behaviour —
// classes-content.tsx owns that branch. The selection string is either a class
// id or `classId:enrollmentId` (a student open inside the class): one scoped
// store carrying both levels is how "class/student selection intact" survives
// the fold, and `:` is safe because document ids never contain it.
//
// Mobbin: https://mobbin.com/screens/9dae9f31-b569-44e1-948b-5dcae49c1e7a (Zillow —
//   inbox list beside the open conversation, selected row highlighted) ·
//   https://mobbin.com/screens/beafa73d-3c43-4ddc-9949-b0b1c2f76d12 (Threads —
//   list column drives the detail column, one screen) ·
//   https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   fixed list pane, flexible detail region). Structure only.
// SOT: design/screens/teacher/teacher.classes/contract.md · docs/pack/37-onboarding-dual-pane.md §3.2 §3.3
// SOT-KEYWORDS: classes pane screen teacher adaptive panes list detail student selection tablet
import {
  AdaptivePanes,
  DetailNavbar,
  EmptyState,
  Text,
  useAdaptivePaneSelection,
} from '@acme/ui';
import { ScrollView, View } from '@acme/ui/primitives';
import { ClassDetailScreen } from './class-detail-content.tsx';
import { ClassesScreen } from './classes-content.tsx';
import { StudentDetailScreen } from './student-detail-content.tsx';

/**
 * The detail pane: the selected class's roster, or the student opened from it,
 * or an instruction when nothing is selected. Reads the host's scoped
 * selection — the same store the list (and the roster inside this pane) write.
 * Dismissing a student steps back to its class (the contract's "detail → list"
 * back order, one level at a time); dismissing the class clears the pane.
 */
function SelectedClassPane() {
  const { selectedId, select } = useAdaptivePaneSelection();

  if (selectedId === null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <EmptyState
          icon={<Text className="text-title">✎</Text>}
          title="Pick a class"
          description="Choose a class from the list to see its roster here."
        />
      </View>
    );
  }

  const [classId = '', enrollmentId] = selectedId.split(':');

  if (enrollmentId !== undefined && enrollmentId.length > 0) {
    return (
      <View className="flex-1">
        <View className="border-b-2 border-border px-inset py-2">
          <DetailNavbar
            title="Student"
            onDismiss={() => {
              select?.(classId);
            }}
          />
        </View>
        <ScrollView className="flex-1">
          <StudentDetailScreen studentId={enrollmentId} classId={classId} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="border-b-2 border-border px-inset py-2">
        <DetailNavbar
          title="Class"
          onDismiss={() => {
            select?.(null);
          }}
        />
      </View>
      <ScrollView className="flex-1">
        <ClassDetailScreen classId={classId} />
      </ScrollView>
    </View>
  );
}

export function ClassesPaneScreen() {
  return (
    <AdaptivePanes detail={<SelectedClassPane />}>
      <AdaptivePanes.Column>
        <ScrollView className="flex-1">
          <ClassesScreen />
        </ScrollView>
      </AdaptivePanes.Column>
    </AdaptivePanes>
  );
}
