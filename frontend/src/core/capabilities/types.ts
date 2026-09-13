export type NotificationCapabilityState =
  | "unsupported"
  | "default"
  | "denied"
  | "granted_local"
  | "fcm_active";

export interface AppCapabilities {
  // Camera & Image Capture
  canDirectCameraCapture: boolean; // Genuine direct rear camera capture (mobile/tablet browsers with camera)
  canStreamCamera: boolean;        // navigator.mediaDevices.getUserMedia available

  // Voice & Speech
  canSpeechRecognize: boolean;     // Web Speech API SpeechRecognition or webkitSpeechRecognition
  canSpeechSynthesize: boolean;    // Web Speech API speechSynthesis

  // File System & Storage
  canAccessFileSystem: boolean;    // File System Access API showDirectoryPicker
  hasIndexedDb: boolean;           // IndexedDB functional and available

  // Push & Notifications
  notificationState: NotificationCapabilityState;
  canWebPush: boolean;             // ServiceWorker + PushManager available
  isIosSafari: boolean;            // Running in iOS Safari browser
  isStandalonePwa: boolean;        // Running as installed PWA (standalone display mode)

  // Sharing & Export
  canWebShare: boolean;            // navigator.share available
  canClipboardCopy: boolean;       // navigator.clipboard available

  // Input & Device Modality
  isTouchDevice: boolean;          // Primary or available touch pointer
  hasFinePointer: boolean;         // Mouse / trackpad / fine pointer present
}
