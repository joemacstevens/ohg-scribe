// src/lib/types.ts

// Conversation types for speaker identification (tailored for advertising agency)
export type ConversationType =
  | 'none'           // No speaker identification (keeps Speaker A, B, etc.)
  | 'interview'      // Interviewer, Interviewee (e.g., KOL interviews, HCP meetings)
  | 'meeting'        // Presenter, Participant (e.g., client presentations, internal meetings)
  | 'panel';         // Moderator, Panelist (e.g., advisory boards, expert panels)

export const CONVERSATION_TYPE_ROLES: Record<ConversationType, string[]> = {
  'none': [],
  'interview': ['Interviewer', 'Interviewee'],
  'meeting': ['Presenter', 'Participant'],
  'panel': ['Moderator', 'Panelist'],
};

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  'none': 'Generic (Speaker A, B, C...)',
  'interview': 'Interview',
  'meeting': 'Meeting / Presentation',
  'panel': 'Panel Discussion',
};

export interface TranscriptionOptions {
  speakerCount: 'auto' | number;  // 'auto' or 2-20
  speakerNames: string[];  // Kept for backwards compatibility with history
  speakerNamesInput: string;  // Comma-separated string for the new input field
  boostWords: string[];
  boostWordsInput: string;  // Comma-separated string for the new input field
  selectedPresets: string[];  // Array of vocabulary preset IDs
  includeSummary: boolean;
  detectTopics: boolean;
  analyzeSentiment: boolean;
  extractKeyPhrases: boolean;  // New: auto_highlights in AssemblyAI
  conversationType: ConversationType;  // For speaker identification by role
}

export interface FileJob {
  id: string;
  filename: string;
  filepath: string;
  status: 'queued' | 'converting' | 'uploading' | 'transcribing' | 'generating' | 'complete' | 'error';
  progress: number;
  error?: string;
  outputPath?: string;
  historyId?: string;  // ID of the saved history entry for navigating to transcript view
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  summary?: string;
  topics?: { label: string; relevance: number }[];
}

export const ACCEPTED_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'
];

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
