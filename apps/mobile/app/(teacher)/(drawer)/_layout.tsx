import { ShellDrawerLayout } from '../../../components/ShellDrawerLayout';
import { DRAWER_EXTRAS } from './(tabs)/_layout';

/**
 * The teacher shell's overflow drawer — the navigator-level `expo-router`
 * Drawer that wraps the tabs and lists the group's stack routes (Conferences,
 * New assignment), opened by the rail's footer menu button.
 */
export default function TeacherDrawerLayout() {
  return <ShellDrawerLayout items={DRAWER_EXTRAS} />;
}
