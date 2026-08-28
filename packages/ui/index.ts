// @acme/ui — pure presentational components (depends only on theme).
// Primitives: '@acme/ui/primitives' · styling wrappers: '@acme/ui/tw'.
// THE component index: check here before building any UI. `pnpm check:barrels`
// fails if a module in this package isn't reachable from an entry point.
// SOT: CLAUDE.md (UI) · docs/pack/10-types-components-spec.md
// SOT-KEYWORDS: ui component index barrel kit presentational button card text

// layout
export { Container, type ContainerProps } from './layout/Container';

// core
export { Text, type TextProps } from './Text';
export { Heading, type HeadingProps } from './Heading';
export { Button, type ButtonProps } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Card, type CardProps } from './Card';
export { Dial, type DialProps, type DialTemperature } from './Dial';
export { RoleScope, type RoleScopeProps } from './RoleScope';
export { Badge, type BadgeProps } from './Badge';
export { MasteryBar, type MasteryBarProps } from './MasteryBar';
export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { ScheduleCard, type ScheduleCardProps } from './ScheduleCard';
export { InspectorSection, type InspectorSectionProps } from './InspectorSection';
export { StatCard, type StatCardProps } from './StatCard';
export { Avatar, type AvatarProps } from './Avatar';
export { Image, type ImageProps } from './Image';
export { BrandLockup, type BrandLockupProps } from './BrandLockup';
export { TutorStage, type TutorStageProps, type TutorStageState } from './TutorStage';
export { LearningCanvas, type LearningCanvasProps } from './LearningCanvas';
export { SessionToolbar, type SessionToolbarProps } from './SessionToolbar';
export { MessageBubble, type MessageBubbleProps } from './MessageBubble';
export { StreamedText, type StreamedTextProps } from './StreamedText';
export { Composer, type ComposerProps } from './Composer';

// forms
export { TextField, type TextFieldProps, type PasteEventPayload } from './TextField';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectProps } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Switch, type SwitchProps } from './Switch';
export { FormField, type FormFieldProps } from './FormField';
export { ErrorMessage, type ErrorMessageProps } from './ErrorMessage';
export { SearchBar, type SearchBarProps } from './SearchBar';
export { DropZone, type DropZoneProps, type DropAsset } from './DropZone';
export { FileTrigger, type FileTriggerProps, type FileTriggerFile } from './file-trigger';
export { PasteWrapper } from './paste-wrapper';

// feedback
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { LoadingSkeleton, type LoadingSkeletonProps } from './LoadingSkeleton';
export { Toast, type ToastProps } from './Toast';
export { ToastCard, type ToastCardProps } from './ToastCard';
export { notify, Toaster } from './notify';
export type { NotifyOptions, NotifyVariant } from './notify.shared';

// overlays + nav
export { Dialog, DialogCard, type DialogProps } from './Dialog';
export { Lightbox, type LightboxProps } from './Lightbox';
export { BottomSheet, SheetSurface, type BottomSheetProps } from './BottomSheet';
export { TabBar, type TabBarProps } from './TabBar';
export { Toolbar, type ToolbarProps } from './Toolbar';
export { TabBarAccessory, type TabBarAccessoryProps } from './TabBarAccessory';

// data
export { VirtualList, type VirtualListProps } from './VirtualList';
export { TrendLine, type TrendLineProps, type TrendPoint } from './TrendLine';
export {
  DataTable, SuppressibleValue, isSuppressed,
  type DataTableProps, type DataTableDensity, type ColumnDef, type Row, type Table, type Suppressible,
} from './DataTable';
export {
  DashboardShell,
  type DashboardShellProps,
  type NavGroup,
  type NavItem,
  type SidebarMode,
} from './DashboardShell';
export { useAppForm, withForm, useFieldContext, useFormContext, useFormStore } from './form';

export { SafeArea, type SafeAreaProps } from './SafeArea';
export { KeyboardAwareScroll, type KeyboardAwareScrollProps } from './keyboard-aware';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { FieldGroup, type FieldGroupProps, type FieldSectionProps } from './FieldGroup';
export { Slider, type SliderProps } from './Slider';
export { Collapsible, type CollapsibleProps } from './Collapsible';
export { List, ListItem, type ListProps, type ListItemProps } from './List';
export { NativeSlot, type NativeSlotProps } from './NativeSlot';
export { Menu, type MenuProps, type MenuAction } from './Menu';
export { useSizeClass, type SizeClass } from './use-size-class';
export {
  Motion, AnimatePresence, createMotionComponent, createMotionAnimatedComponent,
  motion, MotionView, MotionText, FadeIn, ScaleIn, SlideUp, SlideIn, useHydrated, useReducedMotion,
  type MotionViewProps, type MotionTextProps, type MotionPresetProps, type SlideInProps,
} from './motion';
export { PressScale, type PressScaleProps } from './press-scale';
export { useInstanceStore, useStore } from './use-instance-store';
export * from './audio';
export type { TutorAttachment, TutorAttachmentKind } from './tutor-attachment.ts';
export { ATTACHMENT_CHOICES, MAX_TUTOR_IMAGES, countImages } from './tutor-attachment.ts';
export { TutorThread, type TutorThreadProps } from './TutorThread';
export type { TutorMessage } from './tutor-message.ts';
export { ImageViewer, type ImageViewerProps } from './ImageViewer';

// adaptive panes — the list-detail navigator (doc 37 §3.2) and its chrome.
// The sub-barrel owns the full surface; everything reachable there is public.
export * from './adaptive-panes';
