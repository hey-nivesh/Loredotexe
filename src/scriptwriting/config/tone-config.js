/**
 * Channel Tone Profile, Pacing Defaults, and Humor Configuration.
 */

export const DEFAULT_SCRIPT_CONFIG = Object.freeze({
  channelName: 'The 10min Explosion',
  targetLanguage: 'en-US',
  targetDurationSeconds: 600, // 10 minutes
  minimumDurationSeconds: 480, // 8 minutes minimum
  maximumDurationSeconds: 720, // 12 minutes maximum
  narrationWordsPerMinute: 145, // 145 wpm spoken rate
  toneProfile: 'gen_z_energetic',
  profanityLevel: 'contextual', // 'none' | 'mild' | 'contextual' | 'uncensored'
  audienceLevel: 'general_internet_literate'
});

export const HUMOR_TYPES = Object.freeze({
  SARCASM: 'sarcasm',
  IRONY: 'irony',
  ANALOGY: 'analogy',
  PUNCHLINE: 'punchline',
  ANTI_CLIMAX: 'anti_climax',
  EXAGGERATION: 'exaggeration',
  SELF_AWARE: 'self_aware'
});

export const SCRIPT_APPROVAL_STATUS = Object.freeze({
  APPROVED_FOR_REVIEW: 'APPROVED_FOR_REVIEW',
  NEEDS_REVISION: 'NEEDS_REVISION',
  BLOCKED: 'BLOCKED'
});

export const QA_SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  INFO: 'info'
});

/**
 * Calculates estimated duration from spoken word count and WPM rate.
 * @param {number} wordCount
 * @param {number} [wpm=145]
 * @returns {number} duration in seconds
 */
export function estimateDurationSeconds(wordCount, wpm = 145) {
  if (!wordCount || wordCount <= 0) return 0;
  const safeWpm = wpm > 0 ? wpm : 145;
  return Math.round((wordCount / safeWpm) * 60);
}

/**
 * Counts words in a narration string, excluding markdown tags, stage directions, and parentheticals.
 * @param {string} text
 * @returns {number}
 */
export function countSpokenWords(text) {
  if (!text || typeof text !== 'string') return 0;
  // Remove visual cues in brackets, e.g. [Visual: ...], (pause), [Sound effect: ...]
  const cleaned = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*\)/g, ' ')
    .replace(/#+\s+[^\n]+/g, ' ') // chapter headings
    .replace(/[*_`~>]/g, ' ')
    .replace(/claim:\s*claim-[a-zA-Z0-9_-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}
