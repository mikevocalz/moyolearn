import { Platform } from 'react-native';
export async function loadTutorBoardPanel() {
  if (Platform.OS !== 'android') return null;
  return (await import('./tutor-board-panel')).loadTutorBoardPanel();
}
export async function loadTutorQuestionPanel() {
  if (Platform.OS !== 'android') return null;
  return (await import('./tutor-question-panel')).loadTutorQuestionPanel();
}
