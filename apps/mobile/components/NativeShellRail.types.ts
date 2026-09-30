import type { ComponentType } from 'react';

export interface NativeShellRailItem {
  key: string;
  label: string;
  selected: boolean;
  raised?: boolean;
  Icon: ComponentType<{ size?: number; className?: string }>;
  onPress: () => void;
}

export interface NativeShellRailProps {
  items: readonly NativeShellRailItem[];
  expanded: boolean;
}
