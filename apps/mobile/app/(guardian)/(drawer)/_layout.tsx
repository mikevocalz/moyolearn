import { ShellDrawerLayout } from '../../../components/ShellDrawerLayout';
import { DRAWER_EXTRAS } from './(tabs)/_layout';

/**
 * The guardian shell's overflow drawer — the navigator-level `expo-router`
 * Drawer that wraps the tabs and lists the group's Stack routes (Memory, AI
 * Activity, Calendar), opened by the rail's footer menu button.
 */
export default function GuardianDrawerLayout() {
  return <ShellDrawerLayout items={DRAWER_EXTRAS} />;
}
