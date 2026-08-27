'use client';
/**
 * PLATFORM FORK — touch has no `<input type="file">` and no drag, so the
 * trigger is the platform's real Pressable and the picker sheet is the dialog
 * (doc 30 §6, §8). `onPickRequest` opens it — camera/library/document routing
 * belongs to the feature, and multi-select is the picker's job, not ours.
 */
import { Pressable } from './primitives';
import type { FileTriggerFile, FileTriggerProps } from './file-trigger.types';

export type { FileTriggerFile, FileTriggerProps };

export function FileTrigger({
  label,
  disabled,
  onPickRequest,
  className,
  children,
}: FileTriggerProps) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPickRequest}
      className={`rounded-control ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
    >
      {children}
    </Pressable>
  );
}
