package com.moyolearn.museopticalprobe;
/** Requested UI cues only: elapsed phase never verifies what a person physically did. */
public final class UnmodifiedTrialPhase {
 public static String phase(long elapsedNanos){if(elapsedNanos<0)throw new IllegalArgumentException("Negative trial elapsed time");if(elapsedNanos<5000000000L)return "baseline-pen-out";if(elapsedNanos<15000000000L)return "requested-pen-motion";if(elapsedNanos<20000000000L)return "return-pen-out";return "complete";}
 public static String cue(long elapsedNanos){String p=phase(elapsedNanos);if(p.equals("baseline-pen-out"))return "Keep Muse OUT, head still";if(p.equals("requested-pen-motion"))return "Move Muse left/right + roll, head still";if(p.equals("return-pen-out"))return "Muse OUT again, head still";return "Trial complete";}
 public static int remainingSeconds(long elapsedNanos){if(elapsedNanos<0)throw new IllegalArgumentException("Negative elapsed time");return (int)Math.max(0,(20000000000L-Math.min(elapsedNanos,20000000000L)+999999999L)/1000000000L);}
}
