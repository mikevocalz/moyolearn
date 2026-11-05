import { Redirect } from 'expo-router';
import { ForgeBoardProbe } from '../src/forge-board-probe/screen';

/** Isolated engineering fixture, available only in a development build. */
export default function ForgeBoardProbeRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ForgeBoardProbe />;
}
