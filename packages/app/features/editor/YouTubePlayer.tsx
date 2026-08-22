// TS resolution anchor — bundlers load the .native/.web forks.
// Only the PLAYER is forked; the queue around it is shared (YouTubeEmbed.tsx).
export { YouTubePlayer } from './YouTubePlayer.web';
