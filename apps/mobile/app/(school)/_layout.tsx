import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The school route group — parked, not a shell. Doc 36 §3 enumerates no school
 * role (its §3.4 is the ORG companion set), so the authority here is ADR-103
 * (docs/decisions/adr-103-school-admin-ia.md): school admin is web-first and
 * mobile parks at Overview-only — never a More tab — until the role has a PRD
 * persona and an entitlement story. Parking as a guarded Stack route follows
 * the ADR-104 district idiom: a one-destination tab bar would re-ship the
 * "tab bar that cannot navigate" defect (G §1.8 / E-matrix G-6) that this
 * re-cut exists to kill. If school-admin mobile ever ships, ADR-103 pre-binds
 * its set to Overview · People · Academics · Inbox.
 */
const TITLES: Record<string, string> = {
  '/school-home': 'Overview',
};

export default function SchoolShell() {
  const { activeContext } = useAppSession();
  const isSchoolAdmin = activeContext.kind === 'school_admin';

  return (
    <RoleScope role="school" className="flex-1">
      <Stack
        screenOptions={{
          header: ({ navigation, back }) => (
            <ShellHeader
              titles={TITLES}
              fallback="Moyo"
              /* `back` is defined only on a pushed route, so the wordmark
                 yields to the chevron exactly where the platform expects an
                 exit — never on a tab root. */
              canGoBack={back !== undefined}
              onBack={navigation.goBack}
            />
          ),
        }}
      >
        <Stack.Protected guard={isSchoolAdmin}>
          <Stack.Screen name="school-home" options={{ title: 'Overview' }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}
