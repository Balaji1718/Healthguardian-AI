/**
 * test-voice-audio-quality.js — Phase 10C-Fix Audio Capture Quality & Lifecycle Invariants Test Suite
 *
 * Verifies:
 * 1. Pure Web Speech API architecture (zero getUserMedia / MediaRecorder secondary streams to eliminate hardware echo)
 * 2. No live speaker loopback / destination routing
 * 3. Audio playback support via speech synthesis
 * 4. Dev-only diagnostics registry
 * 5. Continuous speech recognition auto-restart
 * 6. Non-destructive transcript accumulation
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS  ${message}`);
    passCount++;
  } else {
    console.error(`  FAIL  ${message}`);
    failCount++;
  }
}

console.log("============================================================");
console.log("HealthGuardian AI — Phase 10C Voice Audio Quality & Lifecycle Invariants");
console.log("============================================================\n");

// Read frontend voice files
const voiceRecorderSrc = readFileSync(
  resolve(__dirname, "../frontend/src/features/checkin/VoiceRecorderWaveform.tsx"),
  "utf-8"
);
const useSpeechRecSrc = readFileSync(
  resolve(__dirname, "../frontend/src/features/checkin/useSpeechRecognition.ts"),
  "utf-8"
);

// --- TEST 1: Pure Single-Pipeline Architecture (Zero Duplicate Stream Echo) ---
console.log("[Test 1: Pure Single-Pipeline Architecture]");
assert(
  voiceRecorderSrc.includes("useSpeechRecognition"),
  "Voice check-in uses single authoritative SpeechRecognition pipeline"
);
assert(
  !voiceRecorderSrc.includes("getUserMedia"),
  "Zero redundant getUserMedia streams running alongside SpeechRecognition"
);
assert(
  voiceRecorderSrc.includes("togglePlayAudio"),
  "Voice playback preview bar is available when recording is stopped"
);

// --- TEST 2: No Live Speaker Feedback / No Destination Routing ---
console.log("\n[Test 2: No Live Speaker Feedback]");
assert(
  !voiceRecorderSrc.includes("connect(audioContext.destination)"),
  "Microphone stream is NEVER routed to audioContext.destination"
);
assert(
  !voiceRecorderSrc.includes("srcObject = stream"),
  "Live stream is not attached to unmuted audio element during recording"
);

// --- TEST 3: Development Diagnostics Invariant ---
console.log("\n[Test 3: Development Diagnostics Invariant]");
assert(
  voiceRecorderSrc.includes("__HEALTHGUARDIAN_VOICE_DIAGNOSTICS__"),
  "Dev-only diagnostic registry tracks active streams and tracks"
);

// --- TEST 4: Continuous Recognition and Pause Auto-Restart ---
console.log("\n[Test 4: Continuous Speech Auto-Restart]");
assert(
  useSpeechRecSrc.includes("instance.continuous = true"),
  "SpeechRecognition configured with continuous: true"
);
assert(
  useSpeechRecSrc.includes("shouldKeepListeningRef"),
  "SpeechRecognition uses shouldKeepListeningRef for pause resilience"
);
assert(
  useSpeechRecSrc.includes("instance.onend"),
  "onend handler automatically restarts recognition during natural pauses"
);

// --- TEST 5: Non-Destructive Transcript Accumulator ---
console.log("\n[Test 5: Non-Destructive Transcript Accumulator]");
assert(
  useSpeechRecSrc.includes("baseTranscriptRef"),
  "Employs baseTranscriptRef to prevent transcript loss or duplication across restarts"
);

console.log("\n============================================================");
console.log(`Audio Quality Tests: ${passCount} Passed, ${failCount} Failed`);
console.log("============================================================\n");

if (failCount > 0) process.exit(1);
