import { ShellDrawerLayout } from '../../../components/ShellDrawerLayout';
import { DRAWER_EXTRAS } from './(tabs)/_layout';

/**
 * The tutor shell's overflow drawer — same navigator-level `expo-router`
 * Drawer the other ops shells carry. Empty today (every destination is a
 * rail item); the structure stays so a future stack route lands in it.
 */
export default function TutorDrawerLayout() {
  return <ShellDrawerLayout items={DRAWER_EXTRAS} />;
}
