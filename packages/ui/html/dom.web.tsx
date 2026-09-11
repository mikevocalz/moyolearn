'use client';
/**
 * PLATFORM FORK — justification (§7): these tags have no react-native-web
 * mapping (figcaption, address, details, summary, fieldset, legend, select)
 * or the RNW rendering is not the real element (pressable → div). The web
 * build emits the real DOM elements directly — native controls on web.
 *
 * react-native-css's web useCssElement moves className into a styleq-style
 * `style` array ({$$css:true, className} entries) that only RNW components
 * decode — toDom() decodes it back for raw DOM elements. Direct callers can
 * still pass a plain className string; both merge.
 */
import React from 'react';
// Type-only, so the web bundle never pulls React Native in — the same rule the
// SafeArea/keyboard-aware forks follow for values.
import type { TextInputProps } from 'react-native';

type StyleqEntry = { $$css?: boolean; [key: string]: unknown } | React.CSSProperties;
type WebStyle = StyleqEntry | (StyleqEntry | null | undefined)[] | null | undefined;

// Decode a styleq `style` value into DOM className + inline style.
const toDom = (className?: string, style?: WebStyle) => {
  const classes: string[] = className ? [className] : [];
  const css: Record<string, unknown> = {};
  const visit = (s: WebStyle) => {
    if (!s) return;
    if (Array.isArray(s)) return s.forEach(visit);
    const entry = s as Record<string, unknown>;
    if (entry.$$css) {
      for (const [k, v] of Object.entries(entry)) {
        if (k !== '$$css' && typeof v === 'string') classes.push(v);
      }
    } else {
      Object.assign(css, entry);
    }
  };
  visit(style);
  return {
    className: classes.length ? classes.join(' ') : undefined,
    style: Object.keys(css).length ? (css as React.CSSProperties) : undefined,
  };
};

type P = { className?: string; style?: WebStyle; children?: React.ReactNode };

const dom = <T extends P>(Tag: string) => {
  const Component = ({ className, style, ...props }: T) =>
    React.createElement(Tag, { ...toDom(className, style), ...props });
  Component.displayName = `Dom(${Tag})`;
  return Component;
};

export const FigcaptionBase = dom('figcaption');
export const AddressBase = dom('address');
export const DetailsBase = dom<P & { open?: boolean }>('details');
export const SummaryBase = dom('summary');
export const FieldsetBase = dom<P & { disabled?: boolean }>('fieldset');
export const LegendBase = dom('legend');
export const SelectBase = (
  props: P & {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
  },
) => {
  const { onValueChange, className, style, ...rest } = props;
  return <select {...toDom(className, style)} {...rest} onChange={(e) => onValueChange?.(e.target.value)} />;
};

// ---- interactive controls — real DOM elements, RN-style prop surface -------

export interface PressBaseProps extends P {
  onPress?: () => void;
  /** Real <button> on web, so it can be driven from the keyboard. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  disabled?: boolean;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  'aria-checked'?: boolean;
  'aria-hidden'?: boolean;
  /**
   * Disclosure state. A collapsing section is unusable with a screen reader
   * without it — the control announces as a plain button and never says whether
   * the content below is showing. React Native's accessibilityState carries the
   * same idea under `expanded`, so both spellings are accepted and the forks
   * take one JSX tree.
   */
  'aria-expanded'?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: {
    checked?: boolean;
    disabled?: boolean;
    selected?: boolean;
    expanded?: boolean;
  };
  /**
   * Press area that extends BEYOND the drawn box, so a control can be drawn
   * small without being tapped small. React Native's own prop, honoured here so
   * one JSX tree keeps serving both forks — the native fork already takes it
   * through `ComponentProps<typeof Pressable>`, and before this the web fork
   * refused the prop outright, which is what forced callers to choose between
   * a narrow drawing and a reachable target.
   *
   * Implemented as padding out plus an equal negative margin back: the hit box
   * grows, the LAID-OUT box does not, so a slopped control still occupies the
   * width its row budgeted for it.
   */
  hitSlop?: number | { left?: number; right?: number; top?: number; bottom?: number };
}

/**
 * `hitSlop` as style. Padding grows the button's own box (a `<button>` is its
 * own hit area) and the matching negative margin takes the growth back out of
 * the layout, so neighbours do not move.
 */
function hitSlopStyle(slop: PressBaseProps['hitSlop']): React.CSSProperties | undefined {
  if (slop === undefined) return undefined;
  const s = typeof slop === 'number' ? { left: slop, right: slop, top: slop, bottom: slop } : slop;
  const side = (n: number | undefined) => (n === undefined || n <= 0 ? undefined : n);
  const [l, r, t, b] = [side(s.left), side(s.right), side(s.top), side(s.bottom)];
  return {
    ...(l === undefined ? {} : { paddingLeft: l, marginLeft: -l }),
    ...(r === undefined ? {} : { paddingRight: r, marginRight: -r }),
    ...(t === undefined ? {} : { paddingTop: t, marginTop: -t }),
    ...(b === undefined ? {} : { paddingBottom: b, marginBottom: -b }),
  };
}

// RN views default to display:flex — raw DOM elements don't, so seed it
// (callers' flex-row / items-* classes expect a flex container).
export const ButtonBase = ({
  onPress, accessibilityLabel, accessibilityState, role, className, style, hitSlop, ...props
}: PressBaseProps) => (
  <button
    type="button"
    // Custom widget roles (radio, tab, switch…) must survive; 'button' is
    // implicit on the element, so only set the attribute when it differs.
    role={role && role !== 'button' ? role : undefined}
    onClick={onPress}
    disabled={props.disabled ?? accessibilityState?.disabled}
    aria-label={props['aria-label'] ?? accessibilityLabel}
    // RN spells it accessibilityState.expanded; the DOM wants aria-expanded.
    // Mapped here so a caller writes one prop and both platforms announce it.
    aria-expanded={props['aria-expanded'] ?? accessibilityState?.expanded}
    {...toDom(`inline-flex flex-col ${className ?? ''}`, { ...hitSlopStyle(hitSlop), ...style })}
    {...props}
  />
);

export interface InputBaseProps extends P {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  returnKeyType?: string;
  placeholderTextColor?: string;
  numberOfLines?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  role?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  /*
    Autofill hints. Absent until a login form needed them, which meant no field
    in the kit could tell a password manager what it was looking at — so every
    sign-in was typed by hand, and `autoCapitalize` left mobile browsers
    Capitalising Email Addresses. React Native's TextInput takes all three under
    these exact names, so the native fork gets them for free.
  */
  autoComplete?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /*
    iOS's own autofill hint, which is a SEPARATE contract from `autoComplete`:
    Safari and the iOS keychain read `textContentType`, everything else reads
    `autoComplete`, and a credential field needs both to be offered a saved
    password. Derived from React Native's own prop rather than restated, so the
    web fork can never accept a value the native fork rejects.

    Declared here and dropped below: it is a native prop with no DOM attribute,
    and forwarding it would put `textcontenttype="..."` in the markup and a
    React unknown-prop warning in the console.
  */
  textContentType?: TextInputProps['textContentType'];
}

const ENTER_KEY_HINT: Record<string, React.HTMLAttributes<HTMLElement>['enterKeyHint']> = {
  search: 'search', done: 'done', go: 'go', next: 'next', send: 'send',
};

export const InputBase = ({
  onChangeText, onSubmitEditing, editable, secureTextEntry, returnKeyType,
  placeholderTextColor: _ptc, numberOfLines: _n, role: _role,
  textContentType: _tct,
  autoCapitalize, className, style, ...props
}: InputBaseProps) => (
  <input
    type={secureTextEntry ? 'password' : 'text'}
    readOnly={editable === false}
    enterKeyHint={returnKeyType ? ENTER_KEY_HINT[returnKeyType] : undefined}
    // RN's `none` is the DOM's `off`; the other three names match.
    autoCapitalize={autoCapitalize === 'none' ? 'off' : autoCapitalize}
    onChange={(e) => onChangeText?.(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') onSubmitEditing?.(); }}
    {...toDom(className, style)}
    {...props}
  />
);

export interface TextareaBaseProps extends InputBaseProps {
  /**
   * React 19 passes refs as an ordinary prop. Declared here because the tutor
   * composer measures `scrollHeight` to grow the field with its content, and a
   * component you cannot get a handle on cannot be measured.
   */
  ref?: React.Ref<HTMLTextAreaElement | null>;
}

export const TextareaBase = ({
  onChangeText, onSubmitEditing, editable, secureTextEntry: _p, returnKeyType: _r,
  placeholderTextColor: _ptc, numberOfLines, role: _role, textContentType: _tct,
  className, style, ...props
}: TextareaBaseProps) => (
  <textarea
    readOnly={editable === false}
    rows={numberOfLines}
    onChange={(e) => onChangeText?.(e.target.value)}
    /*
      PLAIN ENTER SUBMITS; Shift+Enter keeps the newline. This fork used to
      DISCARD `onSubmitEditing` while `InputBase` above honoured it, so a
      multiline field on web answered the one key every chat teaches with a
      blank second line — a child typed an answer, pressed Enter, and nothing
      sent. The preventDefault matters: without it the newline lands in the
      field before the caller's send clears it. On native the prop passes to
      TextInput, where a multiline field never fires it — that platform's send
      button is the submit, and this fork does not get to overrule it.
    */
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey && onSubmitEditing) {
        e.preventDefault();
        onSubmitEditing();
      }
    }}
    {...toDom(className, style)}
    {...props}
  />
);

export const LabelBase = dom('label');
const FormPlain = dom('form');
export const FormBase = ({ className, ...props }: P) => (
  <FormPlain className={`flex flex-col ${className ?? ''}`} {...props} />
);
