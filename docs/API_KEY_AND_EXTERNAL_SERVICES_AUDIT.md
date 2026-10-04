# API Key and External Services Architecture Audit

**Project:** HealthGuardian AI  
**Audit Date:** September 27, 2026  
**Auditor:** Antigravity AI Engineering  
**Scope:** Complete frontend and backend codebase, environment files, AI routing engine, Firebase integrations, OCR, notifications, search, storage, and 3D Dashboard dependencies.

---

## 1. Executive Summary

This architecture audit provides an exhaustive, code-level inventory of every external service, application programming interface (API), environment variable, and cryptographic secret in HealthGuardian AI. 

### Key Findings
1. **Zero Secret Leaks to Frontend:** An automated AST and string scan of all production build bundles (`frontend/dist/assets/`) confirmed that **zero server secrets** (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `MISTRAL_API_KEY`, `SAMBANOVA_API_KEY`, `COHERE_API_KEY`, `CEREBRAS_API_KEY`, `RESEND_API_KEY`, `FIREBASE_PRIVATE_KEY`, `FCM_INTERNAL_SECRET`) are bundled or exposed to the client.
2. **OCR is 100% Local & Keyless:** Optical Character Recognition (OCR) and PDF ingestion run entirely on the user's browser device via WebAssembly (`tesseract.js`) and Web Worker (`pdfjs-dist`). No external cloud vision API or OCR key exists or is required.
3. **Web Search is Keyless:** Live medical search queries the DuckDuckGo Instant Answer API without an API key and falls back to an in-memory curated medical knowledge base.
4. **Current Dashboard Requires NO External API:** The existing HealthGuardian Dashboard relies strictly on local Firestore data and in-browser deterministic health-score and risk calculation engines.
5. **Proposed 3D Anatomical Dashboard Requires NO New API/Key:** The 3D anatomical viewer can be powered completely client-side via Three.js / WebGL with a locally bundled `.glb` asset in `frontend/public/models/`. Body-state mapping connects directly to existing deterministic biomarker data without calling any external or AI API.
6. **AI Provider Redundancy:** The backend implements an 8-provider sequential fallback router. While 8 AI provider keys are currently populated in `backend/.env`, the system only requires **one primary AI provider** (e.g. Groq or OpenRouter) with deterministic local fallback to be fully operational.
7. **Documented vs. Actual Code Discrepancies:** 
   - `VITE_API_URL` is documented in multiple `.env.example` files but is **never consumed** in `frontend/src` (all requests use relative `/api/...` endpoints).
   - `OPENAI_API_KEY` and `OPENAI_MODEL` are actively registered at Priority 1 in `backend/ai-provider-router.js` and present in `backend/.env`, but are **omitted from all `.env.example` documentation**.
   - `GEMINI_API_KEY` is completely unused in application code and only referenced in legacy unit test resets.
   - Legacy frontend provider files (`frontend/src/services/ai/OpenRouterProvider.ts`, `GroqProvider.ts`, `CerebrasProvider.ts`, `providers.server.ts`) exist in the source tree but are **unreferenced dead code**.

---

## 2. Master External Services & Environment Variables Audit Table

| Service | Environment Variable | Used By | Secret/Public | Required | Optional | Fallback Only | Purpose | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `OPENAI_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | No (Priority 1) | Primary AI completion & structured extraction | B, F |
| **OpenAI** | `OPENAI_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | No | OpenAI model identifier override (`gpt-4o-mini`) | B |
| **OpenRouter** | `OPENROUTER_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 2) | Multi-model routing fallback & free tier completion | B, C, F |
| **OpenRouter** | `OPENROUTER_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | OpenRouter model override (`openrouter/free`) | B, C |
| **Groq** | `GROQ_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 2) | Ultra-low latency LPU inference & fallback | B, C, F |
| **Groq** | `GROQ_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | Groq model override (`openai/gpt-oss-120b`) | B, C |
| **NVIDIA NIM** | `NVIDIA_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 3) | Llama 3.2 Vision / Nemotron AI fallback | B, C, F |
| **NVIDIA NIM** | `NVIDIA_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | NVIDIA model override | B, C |
| **Mistral AI** | `MISTRAL_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 4) | European resilient LLM fallback | B, C, F |
| **Mistral AI** | `MISTRAL_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | Mistral model override (`mistral-small-latest`) | B, C |
| **SambaNova** | `SAMBANOVA_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 5) | High-speed SN40L chip inference fallback | B, C, F |
| **SambaNova** | `SAMBANOVA_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | SambaNova model override (`Meta-Llama-3.3-70B-Instruct`) | B, C |
| **Cohere** | `COHERE_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 6) | Command-R+ enterprise inference fallback | B, C, F |
| **Cohere** | `COHERE_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | Cohere model override (`command-r-plus-08-2024`) | B, C |
| **Cerebras** | `CEREBRAS_API_KEY` | `backend/ai-provider-router.js` | Secret | No | Yes | Yes (Priority 7) | CS-3 Wafer-Scale cluster inference fallback | B, C, F |
| **Cerebras** | `CEREBRAS_MODEL` | `backend/ai-provider-router.js` | Public/Config | No | Yes | Yes | Cerebras model override (`gpt-oss-120b`) | B, C |
| **AI Router Settings** | `PROVIDER_COOLDOWN_MS` | `backend/ai-provider-router.js` | Public/Config | No | Yes | No | Cooldown duration after quota/rate limit error (default: 60000ms) | B |
| **AI Router Settings** | `PROVIDER_TIMEOUT_MS` | `backend/ai-provider-router.js` | Public/Config | No | Yes | No | Per-provider abort timeout (default: 20000ms) | B |
| **Firebase Auth & App** | `VITE_FIREBASE_API_KEY` | `frontend/src/services/firebase/config.ts` | Public (Client) | Yes | No | No | Firebase Web API key for client SDK identification | A, E |
| **Firebase Auth** | `VITE_FIREBASE_AUTH_DOMAIN` | `frontend/src/services/firebase/config.ts` | Public (Client) | Yes | No | No | Firebase Auth OAuth redirect & handler domain | A, E |
| **Firestore / Firebase** | `VITE_FIREBASE_PROJECT_ID` | `frontend/src/services/firebase/config.ts` | Public (Client) | Yes | No | No | Firebase project identifier for client SDK | A, E |
| **Firebase Messaging** | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `frontend/src/services/firebase/config.ts` | Public (Client) | Yes | No | No | Cloud Messaging sender number for push dispatch | A, E |
| **Firebase Web App** | `VITE_FIREBASE_APP_ID` | `frontend/src/services/firebase/config.ts` | Public (Client) | Yes | No | No | Firebase client Web App unique ID | A, E |
| **Firebase Analytics** | `VITE_FIREBASE_MEASUREMENT_ID` | `frontend/src/services/firebase/config.ts` | Public (Client) | No | Yes | No | Google Analytics measurement ID | B, E |
| **Firebase App Check** | `VITE_FIREBASE_APPCHECK_SITE_KEY` | `frontend/src/services/firebase/config.ts` | Public (Client) | No | Yes | No | Optional reCAPTCHA v3 site key for abuse protection | B, E |
| **Firebase Cloud Messaging** | `VITE_FIREBASE_VAPID_KEY` | `frontend/src/services/notifications/webPush.ts` | Public (Client) | No | Yes (Default in code) | No | Web Push application server public key for browser push | B, E |
| **Firebase Admin SDK** | `FIREBASE_PROJECT_ID` | `backend/firebase-admin.js` | Public/Config | Yes (Prod push) | No | No | Server-side Firebase project identification | A, F |
| **Firebase Admin SDK** | `FIREBASE_CLIENT_EMAIL` | `backend/firebase-admin.js` | Public/Config | Yes (Prod push) | No | No | Service account client email for JWT signing | A, F |
| **Firebase Admin SDK** | `FIREBASE_PRIVATE_KEY` | `backend/firebase-admin.js` | Secret | Yes (Prod push) | No | No | Service account RSA private key for Admin Auth/FCM | A, F |
| **Firebase Admin Fallback** | `GOOGLE_APPLICATION_CREDENTIALS` | `backend/firebase-admin.js` | Config/Path | No | Yes | Yes | Path to `service-account.json` file on disk | B, C, D |
| **Firebase Admin Fallback** | `FIREBASE_SERVICE_ACCOUNT_PATH` | `backend/server.js` | Config/Path | No | Yes | Yes | Referenced in dev bypass check in `server.js` | D, G |
| **FCM Internal Auth** | `FCM_INTERNAL_SECRET` | `backend/server.js` | Secret | No | Yes | No | Shared header secret to authenticate server-to-server push dispatch | B, F |
| **Resend Email API** | `RESEND_API_KEY` | `backend/server.js`, `backend/auth-otp.js` | Secret | No | Yes | No | Transactional email delivery for OTP & support tickets | B, F |
| **Support Email** | `SUPPORT_EMAIL_TO` | `backend/server.js` | Public/Config | No | Yes | No | Destination inbox for support tickets (balajiteen18@gmail.com) | B |
| **Support Email** | `SUPPORT_EMAIL_FROM` | `backend/server.js`, `backend/auth-otp.js` | Public/Config | No | Yes | No | Sender address for Resend emails | B |
| **App Origin** | `APP_URL` | `backend/firebase-admin.js` | Public/Config | No | Yes | No | Public application origin URL for FCM notification icons & links | B |
| **Node Server** | `PORT` | `backend/server.js` | Public/Config | No | Yes | No | Listening port for Express backend (default: 3000) | B |
| **Node Server** | `HOST` | `backend/server.js` | Public/Config | No | Yes | No | Interface binding address for Express (default: 0.0.0.0) | B |
| **Node Server** | `NODE_ENV` | `backend/server.js`, `backend/auth-otp.js` | Public/Config | No | Yes | No | Runtime mode (`production` vs `development`/`test`) | B |
| **CORS Policy** | `CORS_ORIGIN` | `backend/.env.example` | Public/Config | No | Yes | No | Allowed cross-origin development URL | B, D |
| **API Base URL** | `VITE_API_URL` | `.env.example`, `frontend/.env` | Public (Client) | No | No | No | Documented API base URL; **NOT CONSUMED** by frontend code | G, E |
| **Gemini AI** | `GEMINI_API_KEY` | `backend/test-*.js` | Secret | No | No | No | Referenced only in test cleanup; not in provider router | G |
| **DuckDuckGo API** | *(None - Keyless)* | `backend/web-search.js` | Keyless Public API | No | Yes | No | Free public Instant Answer API for web reference lookup | B |
| **Tesseract.js OCR** | *(None - Keyless)* | `frontend/src/services/ocr/ocr.ts` | Client WebAssembly | Yes (for OCR) | No | No | In-browser on-device image text recognition | A |
| **PDF.js Text Engine** | *(None - Keyless)* | `frontend/src/services/ocr/ocr.ts` | Client Web Worker | Yes (for PDF) | No | No | In-browser on-device PDF text layer extraction | A |

---

## 3. Classification of Every Environment Variable

### A. Required at Runtime
- `VITE_FIREBASE_API_KEY`: Mandatory for client Firebase initialization.
- `VITE_FIREBASE_AUTH_DOMAIN`: Mandatory for Firebase authentication callbacks.
- `VITE_FIREBASE_PROJECT_ID`: Mandatory for client Firestore access.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Mandatory for Firebase push messaging.
- `VITE_FIREBASE_APP_ID`: Mandatory for Firebase Web app binding.
- *For live production server-side push/token verification:* `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or `service-account.json`).
- *For live AI intelligence:* At least **one** valid AI provider key (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, or `OPENAI_API_KEY`).

### B. Optional
- `OPENAI_MODEL`, `OPENROUTER_MODEL`, `GROQ_MODEL`, `NVIDIA_MODEL`, `MISTRAL_MODEL`, `SAMBANOVA_MODEL`, `COHERE_MODEL`, `CEREBRAS_MODEL`: Default models are hardcoded in `ai-provider-router.js`.
- `PROVIDER_COOLDOWN_MS`, `PROVIDER_TIMEOUT_MS`: Default fallbacks exist (60,000ms and 20,000ms).
- `VITE_FIREBASE_MEASUREMENT_ID`: Google Analytics is non-blocking.
- `VITE_FIREBASE_APPCHECK_SITE_KEY`: AppCheck is optional.
- `VITE_FIREBASE_VAPID_KEY`: Has an in-code fallback key.
- `FCM_INTERNAL_SECRET`: Optional; without it, `server.js` verifies Firebase user Bearer tokens.
- `RESEND_API_KEY`: If absent, support tickets still save to Firestore, and auth OTP logs to console.
- `SUPPORT_EMAIL_TO`, `SUPPORT_EMAIL_FROM`: Sensible defaults hardcoded.
- `PORT`, `HOST`, `NODE_ENV`: Sensible defaults hardcoded (3000, 0.0.0.0).
- `APP_URL`: Sensible default hardcoded (`https://healthguardian-ai-1.onrender.com`).

### C. Fallback Provider
- `OPENROUTER_API_KEY`: Priority 2 fallback.
- `GROQ_API_KEY`: Priority 2 fallback.
- `NVIDIA_API_KEY`: Priority 3 fallback.
- `MISTRAL_API_KEY`: Priority 4 fallback.
- `SAMBANOVA_API_KEY`: Priority 5 fallback.
- `COHERE_API_KEY`: Priority 6 fallback.
- `CEREBRAS_API_KEY`: Priority 7 fallback.
- `GOOGLE_APPLICATION_CREDENTIALS`: Fallback path for Firebase service account.

### D. Development / Test Only
- `CORS_ORIGIN`: Used only for cross-origin dev if backend and frontend run on different ports.
- `RUN_LIVE_AI_TEST`: Used only in test suites (`test-ai-document-understanding-integration.js`).
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Used only in dev condition in `server.js`.

### E. Public Frontend Configuration (Exposed to Client)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_APPCHECK_SITE_KEY`
- `VITE_FIREBASE_VAPID_KEY`

### F. Secret Server Configuration (Never Expose)
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `NVIDIA_API_KEY`
- `MISTRAL_API_KEY`
- `SAMBANOVA_API_KEY`
- `COHERE_API_KEY`
- `CEREBRAS_API_KEY`
- `FIREBASE_PRIVATE_KEY`
- `FCM_INTERNAL_SECRET`
- `RESEND_API_KEY`

### G. Deprecated / Unused
- `VITE_API_URL`: Documented extensively in `.env.example`, `frontend/.env`, and Render deployment guides, but **0 references exist in `frontend/src`**.
- `GEMINI_API_KEY`: Deleted in unit test mock setups; not present in router or code.
- Legacy frontend AI provider files: `frontend/src/services/ai/OpenRouterProvider.ts`, `GroqProvider.ts`, `CerebrasProvider.ts`, `providers.server.ts`, `AIProviderRouter.ts` are orphaned dead code.

---

## 4. Detailed Answers to Specific Audit Questions

### 1. What is the minimum set of secrets required for the application to run?
**Answer:** 
- In **development / local mode**: **0 secrets**. The backend boots without any AI keys or Firebase Admin credentials; local mock authentication and deterministic rule fallbacks handle requests safely.
- In **production mode**:
  - **1 AI Secret Key**: Either `GROQ_API_KEY` or `OPENROUTER_API_KEY` or `OPENAI_API_KEY` to power conversational check-in extraction, medical document understanding, and assistant QA.
  - **1 Firebase Admin Secret**: `FIREBASE_PRIVATE_KEY` (along with `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PROJECT_ID`, or `service-account.json`) if background push notifications and server-side token validation are active.
  *(Optional: `RESEND_API_KEY` if live email delivery for OTP/support is needed; otherwise tickets save to Firestore without email).*

### 2. Can the application function with only one AI provider?
**Answer: YES.** The AI Provider Router (`ai-provider-router.js`) dynamically filters providers using `getProviderConfig(provider).isConfigured`. If only one provider is configured (e.g. `GROQ_API_KEY`), the router sends all completions to that provider. If that provider fails, the system executes the deterministic local fallback. The app does not require multiple providers to function.

### 3. Which AI providers are fallback-only?
**Answer:**
Under the current `PROVIDER_REGISTRY` priority ranking:
- Priority 1: `openai` (Primary when configured)
- Priority 2: `openrouter`, `groq` (Secondary / High-speed alternatives)
- Priority 3: `nvidia` (Fallback)
- Priority 4: `mistral` (Fallback)
- Priority 5: `sambanova` (Fallback)
- Priority 6: `cohere` (Fallback)
- Priority 7: `cerebras` (Fallback)
- Priority 8: Local Deterministic Rule Engine (Terminal fallback)
Thus, **NVIDIA NIM, Mistral AI, SambaNova, Cohere, and Cerebras** operate strictly as fallback providers. If OpenAI is active, OpenRouter and Groq also operate as fallbacks.

### 4. Which existing API keys are unused and can be removed from the configuration?
**Answer:**
- `GEMINI_API_KEY`: Can be removed entirely.
- `VITE_API_URL`: Can be safely removed; the frontend uses same-origin relative `/api` paths.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Can be removed (superseded by standard `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_PRIVATE_KEY`).
- Secondary AI keys: If quota on a single primary provider (such as Groq or OpenRouter) is sufficient, up to 6-7 of the other provider keys (`CEREBRAS_API_KEY`, `COHERE_API_KEY`, `SAMBANOVA_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY`) can be removed without breaking core functionality.

### 5. Does OCR require any external API key?
**Answer: NO.**
OCR runs completely locally in the browser:
- PDF text extraction: `pdfjs-dist` (client-side Web Worker, lines 27–44 of `frontend/src/services/ocr/ocr.ts`).
- Image OCR: `tesseract.js` (client-side WebAssembly, lines 46–59 of `frontend/src/services/ocr/ocr.ts`).
Zero external OCR network requests or API keys are utilized.

### 6. Does the Dashboard currently require any external API?
**Answer: NO.**
`frontend/src/routes/app/dashboard.tsx` queries only Firestore user data (`checkins`, `goals`, `verifiedResults`) and executes client-side deterministic algorithms:
- `calculateAdaptiveEvidence` in `@/features/healthRisk/engine`
- `buildHealthContext` in `@/core/adaptive/context`
- Local score and pattern calculations
No external AI or third-party HTTP endpoints are queried by the Dashboard.

### 7. Does the proposed 3D anatomical Dashboard require any new API?
**Answer: NO.**
A 3D anatomical model is rendered directly by the client's GPU via WebGL using Three.js / React Three Fiber. It requires no backend endpoints, no cloud rendering services, and no external APIs.

### 8. Can the 3D anatomical model be bundled locally as a .glb asset?
**Answer: YES.**
A `.glb` or `.gltf` 3D model can be placed directly in `frontend/public/models/` and loaded locally via standard Vite static asset serving or `@react-three/drei`'s `useGLTF`. This provides 100% offline capability, zero API costs, and immediate load times.

### 9. Does anatomical body-state mapping require an AI API, or can it use existing deterministic application data/rules?
**Answer: It can use existing deterministic application data and rules.**
HealthGuardian AI already extracts and normalizes structured metrics in `checkins` (blood pressure, heart rate, sleep duration, hydration, step count, mood) and `verifiedResults` (blood glucose, HbA1c, cholesterol, lipid panel, creatinine). A deterministic mapping table maps anatomical body zones directly to these biomarkers (e.g., Heart -> BP & Heart Rate; Brain -> Sleep & Stress; Pancreas -> Glucose; Kidneys -> Hydration & Creatinine; Musculoskeletal -> Steps & Physical Activity). No AI API is needed for real-time anatomical body-state visualization.

### 10. Are any current keys exposed to the frontend?
**Answer: Only public Firebase client identifiers.**
The only keys exposed in client build assets are:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_VAPID_KEY`
In Firebase architecture, these are designed to be public client identifiers restricted by domain whitelisting and Firestore Security Rules.
**Zero server secrets are exposed to the client.**

### 11. Are any secrets accidentally bundled into the client?
**Answer: NO.**
A deep cryptographic token scan was performed across all built JavaScript artifacts in `frontend/dist/assets/`. None of the server secrets (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `MISTRAL_API_KEY`, `SAMBANOVA_API_KEY`, `COHERE_API_KEY`, `CEREBRAS_API_KEY`, `RESEND_API_KEY`, `FIREBASE_PRIVATE_KEY`, `FCM_INTERNAL_SECRET`) are bundled or leaked.

### 12. Are any environment variables documented but not actually consumed?
**Answer: YES.**
- `VITE_API_URL`: Documented in `.env.example`, `frontend/.env.example`, `render-env-checklist.md`, and `render-environment-template.md`, but **never referenced in executable client code**.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Documented and checked in `server.js`, but never read by `firebase-admin.js`.
- `GEMINI_API_KEY`: Cleared in mock test scripts, but completely absent from the actual provider router.

### 13. Are any code paths expecting an API key that is missing from the documented configuration?
**Answer: YES.**
- `OPENAI_API_KEY` and `OPENAI_MODEL`: Registered as Priority 1 in `backend/ai-provider-router.js` and present in `backend/.env`, but completely omitted from `.env.example`, `backend/.env.example`, and Render setup documentation.
- `GOOGLE_APPLICATION_CREDENTIALS`: Checked by `backend/firebase-admin.js` as fallback for `service-account.json`, but not listed in `.env.example`.
- `APP_URL`: Checked by `backend/firebase-admin.js` for constructing push notification image links, but not documented in `.env.example`.

---

## 5. Architectural Assessment: Multi-Provider Over-Engineering

### Analysis
HealthGuardian AI currently maintains configurations for **8 distinct AI providers** (`OpenAI`, `OpenRouter`, `Groq`, `NVIDIA NIM`, `Mistral`, `SambaNova`, `Cohere`, `Cerebras`), in addition to a deterministic local rule engine fallback.

While this ensures near-100% uptime against individual provider rate limits, it introduces:
1. **Configuration Complexity:** 16 separate environment variables for keys and models.
2. **Maintenance Overhead:** Distinct payload adapters and error handshakes (e.g. Cohere v2 format vs. OpenAI-compatible format).
3. **Dead Code in Frontend:** Multiple unused provider classes left in `frontend/src/services/ai/`.

### Recommendation
For production reliability and architectural simplicity:
- **Primary AI Provider:** `Groq` (extreme speed for conversational check-ins) or `OpenRouter` (universal model access).
- **Secondary AI Provider:** `OpenAI` or `OpenRouter` as fallback.
- **Terminal Fallback:** Existing deterministic rule engine (`buildDeterministicFallbackResponse()`).
This configuration reduces active secret keys from 11 down to 2–3, while preserving full application resilience and zero-downtime tolerance.

---

## 6. Final Decision Section

```
CURRENT API COUNT: 17
ACTIVE SECRET KEYS: 11
ACTIVE PUBLIC CLIENT CONFIG: 8
MINIMUM REQUIRED KEYS: 6 (5 Public Firebase client config + 1 Server AI Key)
OPTIONAL KEYS: 11
FALLBACK KEYS: 7
UNUSED/REDUNDANT KEYS: 3 (VITE_API_URL, GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH)
NEW KEYS REQUIRED FOR 3D DASHBOARD: 0
NEW EXTERNAL SERVICES REQUIRED FOR 3D DASHBOARD: 0
```

**3D Dashboard requires NO additional API key.**
