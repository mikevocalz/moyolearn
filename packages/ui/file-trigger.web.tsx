'use client';
/**
 * PLATFORM FORK — the a11y core of every upload surface (doc 30 §6): a REAL
 * `<input type="file">` that stays in the DOM and stays focusable, wrapped in
 * the `<label>` that is the visible control. Never a `<div onClick>` — that
 * shape is why most dropzones cannot be operated by keyboard or screen reader.
 *
 * Keyboard comes free from the platform: Tab reaches the input, Enter/Space
 * opens the browser's picker. The input is visually collapsed (1px, opacity-0)
 * rather than `display:none`, because a display-none input is removed from the
 * tab order — invisible AND unreachable is the failure this file exists to
 * prevent. Focus is painted on the label via `focus-within`, so the ring wraps
 * the thing the user sees.
 *
 * Files come back in the transport's own shape (`uri` is an object URL) so a
 * caller hands them straight to `useBunnyUpload`/the queue without a re-map.
 */
import React from 'react';
import type { FileTriggerFile, FileTriggerProps } from './file-trigger.types';

export type { FileTriggerFile, FileTriggerProps };

export function FileTrigger({
  label,
  accept,
  multiple,
  disabled,
  onFiles,
  onPickRequest: _onPickRequest,
  className,
  children,
}: FileTriggerProps) {
  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).map<FileTriggerFile>((file) => ({
      uri: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    // Same file picked twice must fire twice — a replaced avatar is often
    // re-replaced with the original after a mis-pick.
    event.currentTarget.value = '';
    if (files.length > 0) onFiles(files);
  };

  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-control focus-within:ring-2 focus-within:ring-focus/50 focus-within:ring-offset-2 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className ?? ''}`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        onChange={change}
        className="absolute h-px w-px opacity-0"
      />
      {children}
    </label>
  );
}
