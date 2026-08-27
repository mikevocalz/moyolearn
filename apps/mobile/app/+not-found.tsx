import { Redirect } from 'expo-router';

/**
 * The silent drop (doc 36 §4.4). A role-mismatched deep link — an incident
 * link opened by a learner account — matches no route in the active shell
 * (Stack.Protected purged the other shells) and lands here. It redirects to
 * the dispatcher, which puts the person on their own landing screen. Never an
 * error screen, never a "you don't have permission" toast at a child: the
 * link just goes nowhere.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
