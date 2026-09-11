import type { GuideSection, GuidedTourStep } from "./types";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "welcome",
    number: 1,
    title: "Welcome to HealthGuardian AI",
    subtitle: "Your personal preventive health-awareness companion",
    category: "overview",
    summary:
      "HealthGuardian AI is a preventive health-awareness application designed to help you understand personal trends in your recorded health data.",
    keyPoints: [
      "Record daily lifestyle habits, symptoms, and vital readings",
      "Discover longitudinal patterns from your own history",
      "Review medical laboratory reports privately on your device",
      "Set personalized health goals and receive proactive alerts",
      "Interact with a safe, grounded AI Assistant that only uses your records",
    ],
    beginnerExplanation:
      "Think of HealthGuardian as your personal wellness notebook combined with smart pattern recognition. It observes your daily habits over time—like how much you sleep, drink water, or exercise—and highlights when things change from your normal baseline.",
    learnMoreExplanation:
      "Unlike generic health apps that compare everyone to a rigid population average, HealthGuardian focuses on your personal baseline. It understands that 6 hours of sleep might be normal for one person but an unusual drop for another.",
    technicalDetails:
      "All baseline calculations, deviations, trend vectors, and confidence metrics are calculated deterministically by local algorithms in the application, ensuring zero AI hallucination of vital statistics.",
    whatItCannotDo: [
      "Cannot diagnose medical conditions or diseases",
      "Cannot prescribe, adjust, or change medications",
      "Cannot replace certified medical professionals or physicians",
      "Cannot provide emergency or real-time life-safety monitoring",
    ],
    routeToOpen: "/app/dashboard",
    buttonLabel: "Open Dashboard",
    safetyNote:
      "If you experience severe or sudden symptoms (e.g. chest pain, fainting), seek emergency medical care immediately.",
  },
  {
    id: "purpose-data-flow",
    number: 2,
    title: "How HealthGuardian Works & Data Flow",
    subtitle: "Grounding insights in real recorded facts",
    category: "overview",
    summary:
      "HealthGuardian operates strictly from the information you provide. The system does not invent or assume missing data.",
    keyPoints: [
      "User logs data → Local deterministic analysis → Personal context → Grounded AI explanations",
      "Missing days remain missing and are never silently filled with fake averages",
      "The AI model receives pre-calculated statistics rather than raw guesswork",
    ],
    beginnerExplanation:
      "When you log a check-in, HealthGuardian stores it safely in your account. As you build up history, our math engine calculates your personal median and detects trends. When you ask the AI Assistant a question, it reads these verified numbers to give you a clear explanation.",
    dataFlowDescription:
      "User Input → Secure Firestore Storage → Deterministic Adaptive Engine (Median, Trend, Confidence) → HealthContext Synthesis → Bounded AI Assistant / UI Dashboard",
    exampleScenario: {
      scenario: "You enter 7 days of sleep data but no blood pressure readings.",
      result:
        "The app calculates your sleep pattern accurately and clearly states that blood pressure data is unavailable.",
    },
    routeToOpen: "/app/dashboard",
    buttonLabel: "View Dashboard Overview",
  },
  {
    id: "getting-started",
    number: 3,
    title: "Recommended First Journey",
    subtitle: "Step-by-step roadmap for new users",
    category: "getting_started",
    summary: "Follow this recommended 10-step sequence to get the most out of HealthGuardian AI.",
    keyPoints: [
      "1. Profile & Privacy: Set your background preferences and emergency notes",
      "2. Daily Check-in: Log your first day of sleep, water, and exercise",
      "3. Consistency: Check in regularly for at least 3–7 days to build a baseline",
      "4. Health History: Inspect your historical records over time",
      "5. Risk & Patterns: Review adaptive lifestyle pattern insights",
      "6. Goals: Create a realistic health target (e.g. 8 glasses of water)",
      "7. Notifications: Review contextual reminders and alerts",
      "8. AI Assistant: Ask questions like 'How has my sleep changed?'",
      "9. Support: Contact support whenever you have app or account questions",
    ],
    beginnerExplanation:
      "You don't need to do everything at once! Start simply by completing your profile and logging today's check-in. In just 3 days, HealthGuardian will start unlocking personal insights tailored specifically to you.",
    routeToOpen: "/app/checkin",
    buttonLabel: "Start Daily Check-in",
  },
  {
    id: "profile-privacy",
    number: 4,
    title: "Profile & Privacy Settings",
    subtitle: "Managing your health context and data ownership",
    category: "core_features",
    summary:
      "Your Profile & Privacy page allows you to manage non-identifying health context, export your records, or delete data at any time.",
    keyPoints: [
      "Record known conditions, allergies, and current medication counts",
      "Maintain emergency notes and preferred language",
      "Export your complete health record anytime in JSON/CSV format",
      "Permanently delete health check-ins or your entire account with full privacy",
    ],
    beginnerExplanation:
      "Your profile gives the application basic context about your health background. This information is read-only for the AI and helps provide more thoughtful explanations, but it will never be used to diagnose or alter medications.",
    technicalDetails:
      "All profile fields are scoped strictly to your authenticated Firebase UID (users/{uid}/profile). Cross-user access is blocked by Firestore security rules.",
    routeToOpen: "/app/settings",
    buttonLabel: "Open Profile & Privacy",
  },
  {
    id: "daily-checkin",
    number: 5,
    title: "Daily Check-in: Blank vs. Zero",
    subtitle: "The golden rule of accurate health logging",
    category: "core_features",
    summary:
      "Daily Check-in captures your lifestyle habits, symptoms, and optional vitals. Leave unknown fields blank—blank never equals zero.",
    keyPoints: [
      "Lifestyle: Sleep (hours), Water (glasses), Exercise (minutes), Weight, Food quality",
      "Symptoms: 12 selectable symptom tags (Fatigue, Headache, Poor sleep, etc.)",
      "Vitals: Blood pressure (systolic/diastolic) and Blood glucose (mg/dL)",
      "CRITICAL: A blank field means 'No data logged'. An explicit '0' means 'Zero consumed/exercised'.",
    ],
    beginnerExplanation:
      "Only enter numbers you actually measured or remember. If you didn't check your blood pressure today, simply leave it empty! If you drank no water, enter 0. HealthGuardian treats these differently so your averages stay 100% accurate.",
    exampleScenario: {
      scenario: "You didn't track water on Tuesday, but drank 8 glasses on Wednesday.",
      result: "Leaving Tuesday blank calculates Wednesday's average as 8 glasses, not 4 glasses.",
    },
    routeToOpen: "/app/checkin",
    buttonLabel: "Open Daily Check-in",
  },
  {
    id: "health-history",
    number: 6,
    title: "Health History & Data Continuity",
    subtitle: "Visualizing your longitudinal progress",
    category: "core_features",
    summary:
      "Health History displays your verified timeline of records. Days without check-ins remain blank to preserve historical truth.",
    keyPoints: [
      "Interactive multi-metric charts for sleep, hydration, exercise, and vitals",
      "Filter by time range (7 days, 14 days, 30 days, 90 days)",
      "Transparent timeline: gaps in logging are shown as gaps, not simulated numbers",
    ],
    beginnerExplanation:
      "Health History is your personal logbook. You can see how your habits fluctuate over weeks and months, helping you identify long-term improvements in your sleep and exercise routines.",
    routeToOpen: "/app/history",
    buttonLabel: "Open Health History",
  },
  {
    id: "medical-reports",
    number: 7,
    title: "Medical Reports & Private OCR",
    subtitle: "Extracting lab values safely on your device",
    category: "core_features",
    summary:
      "Upload lab reports (PDF, PNG, JPEG) to extract key test values. Raw documents stay stored locally in your browser.",
    keyPoints: [
      "1. Upload PDF, PNG, or JPEG lab reports",
      "2. Client-side OCR reads text privately on your device",
      "3. Review and verify extracted test values before saving",
      "4. Only user-verified results are ever used for pattern context",
    ],
    beginnerExplanation:
      "When you upload a blood test or lab report, HealthGuardian reads the text directly on your device. Because automated text recognition can make mistakes, you always review and confirm each number before it is saved.",
    technicalDetails:
      "Raw medical files are stored locally in your browser's IndexedDB and never uploaded to remote servers. Only verified metadata is synchronized to your private Firestore collection.",
    routeToOpen: "/app/reports",
    buttonLabel: "Open Medical Reports",
  },
  {
    id: "risk-patterns",
    number: 8,
    title: "Risk & Patterns Analysis",
    subtitle: "Understanding your personal wellness layers",
    category: "adaptive_ai",
    summary:
      "Risk & Patterns is a multi-layered health assessment engine that evaluates your data without diagnostic labeling.",
    keyPoints: [
      "Layer 1: Safety Gate — Immediate emergency guidance for acute symptoms",
      "Layer 2: Clinical Boundaries — Standard evidence-based thresholds for vitals",
      "Layer 3: Adaptive Wellness — Personal baseline comparison for lifestyle metrics",
      "General Health Score (0–100) combining consistency and habit stability",
    ],
    beginnerExplanation:
      "This section doesn't give you a disease diagnosis. Instead, it lets you know if you're sleeping significantly less than your usual baseline, or if your blood pressure readings have been consistently elevated over recent check-ins.",
    whatItCannotDo: [
      "Does not provide clinical diagnoses",
      "Does not replace lab evaluations or physician consultations",
    ],
    routeToOpen: "/app/risk",
    buttonLabel: "Open Risk & Patterns",
  },
  {
    id: "adaptive-analysis",
    number: 9,
    title: "How Adaptive Intelligence Works",
    subtitle: "Personalized baselines vs. fixed population averages",
    category: "adaptive_ai",
    summary:
      "Adaptive Intelligence calculates your personal median from historical entries, comparing recent observations to compute deviations, trends, and confidence scores.",
    keyPoints: [
      "Personal Baseline: Robust median calculated across your logged history (min 3 entries)",
      "Recent Value: Weighted average of your most recent 3 observations",
      "Deviation: The exact difference between your recent behavior and personal normal",
      "Confidence Score (0.0–1.0): Based on observation count, sample density, and trend stability",
      "Sparse Data Protection: Suppresses premature alerts if you have fewer than 3 observations",
    ],
    beginnerExplanation:
      "If you usually sleep 8 hours a night, sleeping 6 hours is a negative deviation (-2.0h). If another user usually sleeps 6 hours, 6 hours is completely normal for them! HealthGuardian adapts to your unique habits.",
    exampleScenario: {
      scenario:
        "User A normal sleep is 8.0h (recent: 6.0h). User B normal sleep is 6.0h (recent: 6.0h).",
      result: "User A receives an alert about a drop in sleep. User B sees a stable trend.",
    },
    routeToOpen: "/app/risk",
    buttonLabel: "Explore Adaptive Risk",
  },
  {
    id: "ai-assistant",
    number: 10,
    title: "AI Assistant: Safe & Grounded",
    subtitle: "Ask questions about your own records in plain English",
    category: "adaptive_ai",
    summary:
      "The AI Assistant uses controlled agentic tools to answer questions strictly using your permitted records.",
    keyPoints: [
      "Ask natural questions: 'How has my sleep changed?', 'Do I have a hydration goal?'",
      "Zero Hallucination: If data is missing from your records, the AI states it is unavailable",
      "Data Isolation: The AI cannot access other users' data or external unauthorized sources",
      "Grounded Answers: Every statement is linked to your actual check-ins or verified lab reports",
    ],
    beginnerExplanation:
      "You can chat with the assistant just like talking to a wellness coach. Ask about your trends, compare your habits, or ask for guidance on how to structure a new goal.",
    exampleScenario: {
      scenario: "You ask: 'What was my glucose yesterday?' but never logged glucose yesterday.",
      result:
        "The assistant responds: 'I don't have a blood glucose reading recorded for yesterday in your records.'",
    },
    routeToOpen: "/app/assistant",
    buttonLabel: "Open AI Assistant",
  },
  {
    id: "agentic-ai",
    number: 11,
    title: "Agentic AI & Tool Selection",
    subtitle: "How the Assistant dynamically chooses what information it needs",
    category: "adaptive_ai",
    summary:
      "Rather than running a fixed repetitive script for every question, the AI Assistant dynamically decides which tools to execute and stops when sufficient evidence exists.",
    keyPoints: [
      "Dynamic Planning: Inspects your query and selects the minimal relevant tools (e.g. getGoals or getHealthContext)",
      "Result-Aware Loop: After inspecting a tool result, decides whether more info is needed or answers immediately",
      "Write Action Guard: Any action that changes data (creating a goal or reminder) requires your explicit confirmation",
      "Multi-Provider Redundancy: Seamlessly routes across top AI models with automatic failover",
    ],
    beginnerExplanation:
      "When you ask 'Do I have a goal?', the assistant only checks your goals list. It doesn't waste time running all 5 health analysis tools. And if it wants to suggest a new goal, it always asks you for permission first!",
    routeToOpen: "/app/assistant",
    buttonLabel: "Try AI Assistant",
  },
  {
    id: "goals",
    number: 12,
    title: "Health Goals & Habit Tracking",
    subtitle: "Setting achievable targets with progress tracking",
    category: "core_features",
    summary:
      "Create custom health targets for sleep, hydration, exercise, and vitals. Progress updates automatically as you check in.",
    keyPoints: [
      "Set targets: e.g., 'Drink 8 glasses of water daily' or 'Sleep 7.5 hours'",
      "Select frequency (Daily, Weekly) and target metrics",
      "Progress is calculated strictly from your daily check-in logs",
      "AI goal suggestions always appear as proposals requiring your confirmation",
    ],
    beginnerExplanation:
      "Setting small, achievable goals is the best way to improve your health. As you log your daily check-ins, HealthGuardian calculates your progress toward your target automatically.",
    routeToOpen: "/app/goals",
    buttonLabel: "Open Goals",
  },
  {
    id: "notifications",
    number: 13,
    title: "Notifications & Reminders",
    subtitle: "Contextual reminders and adaptive wellness alerts",
    category: "core_features",
    summary:
      "Receive in-app reminders for daily check-ins, goal milestones, and significant adaptive pattern changes.",
    keyPoints: [
      "Goal Reminders: Gentle prompts to stay consistent with your targets",
      "Pattern-Based Awareness: Alerts when an adaptive trend shows high confidence (≥ 0.70)",
      "Notification Privacy: Clinical details are kept out of plain notifications for your privacy",
      "Not Emergency Monitoring: Notifications are for awareness, not real-time medical alarms",
    ],
    beginnerExplanation:
      "Notifications keep you mindful of your habits without being overwhelming. You can review all pending and past alerts right in your notification center.",
    routeToOpen: "/app/notifications",
    buttonLabel: "Open Notifications",
  },
  {
    id: "support",
    number: 14,
    title: "Application Support & Helpdesk",
    subtitle: "Getting assistance with your account and data",
    category: "privacy_safety",
    summary:
      "Submit support requests for questions regarding features, data export, account settings, or bug reports.",
    keyPoints: [
      "Submit technical, feature, or account questions",
      "Set priority (Low, Normal, High) and describe your issue",
      "Track open and resolved support requests directly in the app",
      "IMPORTANT: Support is for app issues only. Never use Support for medical emergencies.",
    ],
    beginnerExplanation:
      "If something in the app isn't working right or you need help exporting your data, open a support ticket and our team will assist you.",
    routeToOpen: "/app/support",
    buttonLabel: "Open Support",
  },
  {
    id: "privacy-security",
    number: 16,
    title: "Your Data, Privacy & Security",
    subtitle: "Complete ownership and control of your records",
    category: "privacy_safety",
    summary:
      "HealthGuardian is built on strict data minimization, client-side encryption principles, and zero third-party data selling.",
    keyPoints: [
      "Your records belong to you: Export your entire dataset anytime in JSON or CSV",
      "Local Document Storage: Raw medical PDFs and images remain in your local browser storage",
      "Zero Secret Exposure: AI provider keys and credentials never touch the client browser",
      "Full Deletion: Delete individual check-ins or your entire account with a single click",
    ],
    beginnerExplanation:
      "We believe your health data should be completely private. Your raw lab documents stay on your device, and you have the power to export or delete your history whenever you wish.",
    routeToOpen: "/app/settings",
    buttonLabel: "Review Privacy Settings",
  },
  {
    id: "safety-emergency",
    number: 17,
    title: "Medical Safety & Emergency Guidelines",
    subtitle: "When and how to seek urgent medical care",
    category: "privacy_safety",
    summary:
      "HealthGuardian AI is a preventive wellness application. It is not an emergency response system.",
    keyPoints: [
      "HealthGuardian NEVER diagnoses diseases or prescribes/changes medications",
      "Immediate Emergency Gate: Phrases like 'chest pain', 'fainting', or 'cannot breathe' immediately trigger emergency guidance",
      "Do NOT wait for an AI response or app check-in if you feel seriously ill",
      "Always consult a licensed physician or emergency services for urgent symptoms",
    ],
    beginnerExplanation:
      "Your safety is our top priority. If you or someone around you experiences sudden chest discomfort, difficulty breathing, severe dizziness, or loss of consciousness, call your local emergency services (e.g. 911 / 112 / 999) immediately.",
    safetyNote:
      "EMERGENCY NOTICE: Do not use this application during a medical crisis. Seek urgent local emergency medical care immediately.",
    routeToOpen: "/app/dashboard",
    buttonLabel: "Return to Dashboard",
  },
];

export const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  {
    stepNumber: 1,
    title: "Welcome to Dashboard",
    sectionId: "welcome",
    targetRoute: "/app/dashboard",
    targetLabel: "Dashboard",
    description:
      "Your main command center. View today's status, quick check-in shortcuts, General Health Score, and recent trends at a single glance.",
    actionPrompt: "Explore your top health indicators and daily status.",
    keyTakeaway: "Dashboard aggregates your logged metrics into an easy daily snapshot.",
  },
  {
    stepNumber: 2,
    title: "Profile & Privacy Settings",
    sectionId: "profile-privacy",
    targetRoute: "/app/settings",
    targetLabel: "Profile & Privacy",
    description:
      "Configure your personal health background, known conditions, allergies, and emergency notes. Export your data or delete records anytime.",
    actionPrompt: "Set up your background context and review privacy controls.",
    keyTakeaway:
      "Your profile gives the AI safe background context while keeping data fully in your control.",
  },
  {
    stepNumber: 3,
    title: "Daily Check-in",
    sectionId: "daily-checkin",
    targetRoute: "/app/checkin",
    targetLabel: "Daily Check-in",
    description:
      "Log your sleep, water, exercise, symptoms, and optional vitals. Remember: leave unknown fields blank—blank never equals zero!",
    actionPrompt: "Log today's wellness habits and symptoms.",
    keyTakeaway: "Consistent check-ins build your personalized baseline over time.",
  },
  {
    stepNumber: 4,
    title: "Health History",
    sectionId: "health-history",
    targetRoute: "/app/history",
    targetLabel: "Health History",
    description:
      "View longitudinal graphs of your recorded metrics across 7, 14, 30, and 90 days. Gaps represent unlogged days accurately.",
    actionPrompt: "Analyze your progress charts and habit consistency.",
    keyTakeaway: "Visual trends reveal how your sleep and activity evolve week over week.",
  },
  {
    stepNumber: 5,
    title: "Medical Reports",
    sectionId: "medical-reports",
    targetRoute: "/app/reports",
    targetLabel: "Medical Reports",
    description:
      "Upload lab reports securely. OCR extracts numbers on your device; you review and confirm each value before saving.",
    actionPrompt: "Store and track lab tests with client-side OCR verification.",
    keyTakeaway: "Raw files remain stored locally in your browser for total privacy.",
  },
  {
    stepNumber: 6,
    title: "Risk & Patterns",
    sectionId: "risk-patterns",
    targetRoute: "/app/risk",
    targetLabel: "Risk & Patterns",
    description:
      "Inspect multi-layered pattern detection. See how your recent 3-day habits deviate from your personal historical median.",
    actionPrompt: "Review your General Health Score and lifestyle pattern alerts.",
    keyTakeaway: "Patterns reflect personal deviation, not clinical disease diagnoses.",
  },
  {
    stepNumber: 7,
    title: "AI Assistant",
    sectionId: "ai-assistant",
    targetRoute: "/app/assistant",
    targetLabel: "AI Assistant",
    description:
      "Chat with your safe, grounded health assistant. It dynamically chooses the exact tools needed to answer your questions accurately.",
    actionPrompt: "Ask questions like 'How has my sleep changed recently?'",
    keyTakeaway: "Answers are strictly grounded in your permitted records with zero hallucination.",
  },
  {
    stepNumber: 8,
    title: "Health Goals",
    sectionId: "goals",
    targetRoute: "/app/goals",
    targetLabel: "Goals",
    description:
      "Set measurable targets for sleep, hydration, and activity. Progress updates automatically whenever you submit daily check-ins.",
    actionPrompt: "Create a target like 'Drink 8 glasses of water daily'.",
    keyTakeaway: "Track your consistency against realistic personal milestones.",
  },
  {
    stepNumber: 9,
    title: "Notifications Center",
    sectionId: "notifications",
    targetRoute: "/app/notifications",
    targetLabel: "Notifications",
    description:
      "Stay informed with habit reminders and high-confidence adaptive pattern alerts. Sensitive medical details are always kept private.",
    actionPrompt: "Review pending reminders and adaptive awareness alerts.",
    keyTakeaway: "Notifications support healthy mindfulness, not emergency alarms.",
  },
  {
    stepNumber: 10,
    title: "Helpdesk & Support",
    sectionId: "support",
    targetRoute: "/app/support",
    targetLabel: "Support",
    description:
      "Need technical assistance, data help, or feature guidance? Open a support ticket directly from your account.",
    actionPrompt: "Reach out for help with application features or data export.",
    keyTakeaway: "Application support is for technical inquiries, never medical emergencies.",
  },
  {
    stepNumber: 11,
    title: "Help & Guide Center",
    sectionId: "getting-started",
    targetRoute: "/app/guide",
    targetLabel: "Help & Guide",
    description:
      "You've completed the tour! You can revisit this Help & Guide center anytime to review data flow diagrams, FAQs, and deep-dive explanations.",
    actionPrompt: "Browse interactive learning topics whenever you have questions.",
    keyTakeaway: "HealthGuardian is always here to guide you on your wellness journey.",
  },
];
