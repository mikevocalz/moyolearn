/** One entry in a curated queue. */
export interface PlaylistItem {
  videoId: string;
  title: string;
  /** Display string, e.g. "4:21". Not parsed — YouTube owns the real duration. */
  duration?: string;
}

/** The platform-forked player: one video (or one YouTube list), no queue UI. */
export interface YouTubePlayerProps {
  /**
   * The 11-character video id. Optional when a playlistId is given: YouTube's
   * `videoseries` entry point starts a list from its first item.
   */
  videoId?: string;
  /**
   * A YouTube list id. Supplied WITH a videoId when the link came from inside a
   * playlist — the player then starts there and keeps the rest queued.
   */
  playlistId?: string;
  className?: string;
}

export interface YouTubeEmbedProps extends YouTubePlayerProps {
  /**
   * A curated queue. Give this INSTEAD of videoId when the app owns the
   * sequence: one item renders as a plain player, several render the player
   * plus a visible, selectable queue. One component either way — a video and a
   * playlist are the same thing at different lengths.
   */
  items?: readonly PlaylistItem[];
  /** Index to open on. Clamped, so a stale pointer cannot render an empty player. */
  initialIndex?: number;
  onSelect?: (item: PlaylistItem, index: number) => void;
}
