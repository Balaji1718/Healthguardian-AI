import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "./config";
import {
  assessmentsCol,
  checkinsCol,
  goalsCol,
  guidanceCol,
  deviceTokensCol,
  healthProfileDoc,
  messagesCol,
  notificationsCol,
  profileDoc,
  recordsCol,
  reportsCol,
  resultsCol,
  sessionsCol,
  supportCol,
  userDoc,
} from "./paths";
import type {
  AgentMessage,
  AgentSession,
  AppNotification,
  DailyCheckin,
  Goal,
  HealthProfile,
  HealthRecord,
  MedicalReport,
  MedicalResult,
  Profile,
  RiskAssessment,
  SpecialistGuidance,
  SupportRequest,
  UserRoot,
} from "@/models";

/** Firestore rejects `undefined`; unknown values must be omitted, never faked as 0. */
export function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const map = <T>(d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as T) });

export const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && v !== null && "seconds" in (v as Record<string, unknown>)) {
    return new Date(((v as { seconds: number }).seconds ?? 0) * 1000);
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/* ------------------------------- user root ------------------------------- */

export async function ensureUserRoot(uid: string, email: string, displayName: string) {
  const ref = userDoc(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // role/accountStatus are set once at creation and never elevated by the client.
    await setDoc(ref, {
      uid,
      email,
      displayName,
      role: "user",
      accountStatus: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
    await setDoc(profileDoc(uid), {
      firstName: displayName.split(" ")[0] ?? "",
      lastName: displayName.split(" ").slice(1).join(" "),
      preferredLanguage: "en",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(healthProfileDoc(uid), {
      knownConditions: [],
      allergies: [],
      familyHistory: [],
      currentMedications: [],
      healthPreferences: {},
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { lastActiveAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function getUserRoot(uid: string): Promise<UserRoot | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as UserRoot) : null;
}

export async function saveDeviceToken(uid: string, token: string) {
  await setDoc(
    doc(deviceTokensCol(uid), token),
    clean({ token, platform: "web", updatedAt: serverTimestamp() }),
    { merge: true },
  );
}

/* -------------------------------- profile -------------------------------- */

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

export async function saveProfile(uid: string, data: Partial<Profile>) {
  await setDoc(profileDoc(uid), clean({ ...data, updatedAt: serverTimestamp() }), { merge: true });
}

export async function getHealthProfile(uid: string): Promise<HealthProfile | null> {
  const snap = await getDoc(healthProfileDoc(uid));
  return snap.exists() ? (snap.data() as HealthProfile) : null;
}

export async function saveHealthProfile(uid: string, data: Partial<HealthProfile>) {
  await setDoc(healthProfileDoc(uid), clean({ ...data, updatedAt: serverTimestamp() }), {
    merge: true,
  });
}

/* ------------------------------- check-ins -------------------------------- */

export const checkinIdForDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function getCheckin(uid: string, id: string): Promise<DailyCheckin | null> {
  const snap = await getDoc(doc(checkinsCol(uid), id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as DailyCheckin) } : null;
}

/** Deterministic per-day document id keeps offline/online writes idempotent. */
export async function saveCheckin(uid: string, date: Date, data: Partial<DailyCheckin>) {
  const id = checkinIdForDate(date);
  const existing = await getCheckin(uid, id).catch(() => null);
  await setDoc(
    doc(checkinsCol(uid), id),
    clean({
      ...data,
      date: Timestamp.fromDate(date),
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
  await syncCheckinToHealthRecords(uid, id, date, data);
  return id;
}

export async function listCheckins(uid: string, max = 60): Promise<DailyCheckin[]> {
  const q = query(checkinsCol(uid), orderBy("date", "desc"), fbLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => map<DailyCheckin>(d));
}

/* ----------------------------- health records ----------------------------- */

async function syncCheckinToHealthRecords(
  uid: string,
  checkinId: string,
  date: Date,
  data: Partial<DailyCheckin>,
) {
  const metrics: Array<[string, number | null | undefined, string]> = [
    ["weight", data.weightKg, "kg"],
    ["sleep", data.sleepHours, "h"],
    ["water", data.waterGlasses, "glasses"],
    ["exercise", data.exerciseMinutes, "min"],
    ["glucose", data.bloodGlucose, data.bloodGlucoseUnit ?? "mg/dL"],
    ["systolicBP", data.systolicBP, "mmHg"],
    ["diastolicBP", data.diastolicBP, "mmHg"],
  ];
  const batch = writeBatch(getDb());
  for (const [metric, value, unit] of metrics) {
    if (value === undefined || value === null || Number.isNaN(value)) continue;
    // Deterministic id => re-saving a check-in updates instead of duplicating.
    const ref = doc(recordsCol(uid), `${checkinId}_${metric}`);
    batch.set(ref, {
      metric,
      numericValue: value,
      unit,
      sourceType: "daily_checkin",
      sourceId: checkinId,
      recordedAt: Timestamp.fromDate(date),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function listHealthRecords(
  uid: string,
  metric?: string,
  max = 200,
): Promise<HealthRecord[]> {
  const base = metric
    ? query(
        recordsCol(uid),
        where("metric", "==", metric),
        orderBy("recordedAt", "desc"),
        fbLimit(max),
      )
    : query(recordsCol(uid), orderBy("recordedAt", "desc"), fbLimit(max));
  const snap = await getDocs(base);
  return snap.docs.map((d) => map<HealthRecord>(d));
}

export async function addHealthRecord(uid: string, rec: HealthRecord, id?: string) {
  const payload = clean({ ...rec, createdAt: serverTimestamp() });
  if (id) await setDoc(doc(recordsCol(uid), id), payload);
  else await addDoc(recordsCol(uid), payload);
}

/* ----------------------------- medical reports ---------------------------- */

export async function createReport(uid: string, report: MedicalReport) {
  const ref = await addDoc(reportsCol(uid), clean({ ...report, uploadedAt: serverTimestamp() }));
  return ref.id;
}

export async function updateReport(uid: string, id: string, data: Partial<MedicalReport>) {
  await updateDoc(doc(reportsCol(uid), id), clean(data));
}

export async function getReport(uid: string, id: string): Promise<MedicalReport | null> {
  const snap = await getDoc(doc(reportsCol(uid), id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as MedicalReport) } : null;
}

export async function listReports(uid: string, max = 50): Promise<MedicalReport[]> {
  const snap = await getDocs(query(reportsCol(uid), orderBy("uploadedAt", "desc"), fbLimit(max)));
  return snap.docs.map((d) => map<MedicalReport>(d));
}

export async function deleteReport(uid: string, id: string) {
  const results = await getDocs(resultsCol(uid, id));
  await Promise.all(results.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(reportsCol(uid), id));
}

export async function saveResult(
  uid: string,
  reportId: string,
  result: MedicalResult,
  id?: string,
) {
  const payload = clean({ ...result, createdAt: serverTimestamp() });
  if (id) {
    await setDoc(doc(resultsCol(uid, reportId), id), payload, { merge: true });
    return id;
  }
  const ref = await addDoc(resultsCol(uid, reportId), payload);
  return ref.id;
}

export async function listResults(uid: string, reportId: string): Promise<MedicalResult[]> {
  const snap = await getDocs(resultsCol(uid, reportId));
  return snap.docs.map((d) => map<MedicalResult>(d));
}

/** Only verified results are trusted by the risk engine and the agent. */
export async function listVerifiedResults(uid: string, reportId: string): Promise<MedicalResult[]> {
  return (await listResults(uid, reportId)).filter((r) => r.userVerified);
}

/* ---------------------------- risk assessments ---------------------------- */

export async function saveAssessment(uid: string, a: RiskAssessment) {
  const ref = await addDoc(assessmentsCol(uid), clean({ ...a, createdAt: serverTimestamp() }));
  return ref.id;
}

export async function listAssessments(uid: string, max = 20): Promise<RiskAssessment[]> {
  const snap = await getDocs(
    query(assessmentsCol(uid), orderBy("createdAt", "desc"), fbLimit(max)),
  );
  return snap.docs.map((d) => map<RiskAssessment>(d));
}

/* ---------------------------------- goals --------------------------------- */

export async function createGoal(uid: string, g: Goal) {
  const ref = await addDoc(
    goalsCol(uid),
    clean({ ...g, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
  return ref.id;
}

export async function updateGoal(uid: string, id: string, data: Partial<Goal>) {
  await updateDoc(doc(goalsCol(uid), id), clean({ ...data, updatedAt: serverTimestamp() }));
}

export async function deleteGoal(uid: string, id: string) {
  await deleteDoc(doc(goalsCol(uid), id));
}

export async function listGoals(uid: string, max = 50): Promise<Goal[]> {
  const snap = await getDocs(query(goalsCol(uid), orderBy("createdAt", "desc"), fbLimit(max)));
  return snap.docs.map((d) => map<Goal>(d));
}

/* ------------------------------ notifications ----------------------------- */

export async function createNotification(uid: string, n: AppNotification) {
  const ref = await addDoc(notificationsCol(uid), clean({ ...n, createdAt: serverTimestamp() }));
  return ref.id;
}

export async function listNotifications(uid: string, max = 50): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(notificationsCol(uid), orderBy("createdAt", "desc"), fbLimit(max)),
  );
  return snap.docs.map((d) => map<AppNotification>(d));
}

export async function updateNotification(uid: string, id: string, data: Partial<AppNotification>) {
  await updateDoc(doc(notificationsCol(uid), id), clean(data));
}

/* ----------------------------- agent sessions ----------------------------- */

export async function createSession(uid: string, s: AgentSession) {
  const ref = await addDoc(
    sessionsCol(uid),
    clean({
      ...s,
      createdAt: serverTimestamp(),
      startedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export async function updateSession(uid: string, id: string, data: Partial<AgentSession>) {
  await updateDoc(doc(sessionsCol(uid), id), clean({ ...data, lastActivityAt: serverTimestamp() }));
}

export async function listSessions(uid: string, max = 25): Promise<AgentSession[]> {
  const snap = await getDocs(
    query(sessionsCol(uid), orderBy("lastActivityAt", "desc"), fbLimit(max)),
  );
  return snap.docs.map((d) => map<AgentSession>(d));
}

export async function addMessage(uid: string, sessionId: string, m: AgentMessage) {
  const ref = await addDoc(
    messagesCol(uid, sessionId),
    clean({ ...m, timestamp: serverTimestamp() }),
  );
  return ref.id;
}

/** Bounded history: never load an unlimited conversation. */
export async function listMessages(
  uid: string,
  sessionId: string,
  max = 50,
): Promise<AgentMessage[]> {
  const snap = await getDocs(
    query(messagesCol(uid, sessionId), orderBy("timestamp", "asc"), fbLimit(max)),
  );
  return snap.docs.map((d) => map<AgentMessage>(d));
}

/* --------------------------- specialist guidance -------------------------- */

export async function createGuidance(uid: string, g: SpecialistGuidance) {
  const ref = await addDoc(guidanceCol(uid), clean({ ...g, createdAt: serverTimestamp() }));
  return ref.id;
}

export async function listGuidance(uid: string, max = 30): Promise<SpecialistGuidance[]> {
  const snap = await getDocs(query(guidanceCol(uid), orderBy("createdAt", "desc"), fbLimit(max)));
  return snap.docs.map((d) => map<SpecialistGuidance>(d));
}

export async function acknowledgeGuidance(uid: string, id: string) {
  await updateDoc(doc(guidanceCol(uid), id), { userAcknowledged: true });
}

/* ---------------------------- support requests ---------------------------- */

export async function createSupportRequest(uid: string, r: SupportRequest) {
  const ref = await addDoc(
    supportCol(uid),
    clean({ ...r, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
  return ref.id;
}

export async function listSupportRequests(uid: string, max = 30): Promise<SupportRequest[]> {
  const snap = await getDocs(query(supportCol(uid), orderBy("createdAt", "desc"), fbLimit(max)));
  return snap.docs.map((d) => map<SupportRequest>(d));
}

export async function updateSupportRequest(uid: string, id: string, data: Partial<SupportRequest>) {
  await updateDoc(doc(supportCol(uid), id), clean({ ...data, updatedAt: serverTimestamp() }));
}

/* ------------------------------ data deletion ----------------------------- */

const SUBCOLLECTIONS = [
  "dailyCheckins",
  "healthRecords",
  "riskAssessments",
  "goals",
  "notifications",
  "specialistGuidance",
  "supportRequests",
] as const;

/** Deletes health data owned by the signed-in user only. */
export async function deleteAllHealthData(uid: string) {
  for (const name of SUBCOLLECTIONS) {
    const snap = await getDocs(collectionRef(uid, name));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  const reports = await getDocs(reportsCol(uid));
  for (const r of reports.docs) {
    const results = await getDocs(resultsCol(uid, r.id));
    await Promise.all(results.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(r.ref);
  }
  const sessions = await getDocs(sessionsCol(uid));
  for (const s of sessions.docs) {
    const msgs = await getDocs(messagesCol(uid, s.id));
    await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(s.ref);
  }
}

function collectionRef(uid: string, name: string) {
  const lookup: Record<string, (userId: string) => ReturnType<typeof query>> = {
    dailyCheckins: checkinsCol,
    healthRecords: recordsCol,
    riskAssessments: assessmentsCol,
    goals: goalsCol,
    notifications: notificationsCol,
    specialistGuidance: guidanceCol,
    supportRequests: supportCol,
  };

  const collection = lookup[name];
  if (!collection) {
    throw new Error(`Unknown health collection: ${name}`);
  }

  return query(collection(uid));
}

export async function deleteUserDocuments(uid: string) {
  await deleteAllHealthData(uid);
  await deleteDoc(profileDoc(uid)).catch(() => undefined);
  await deleteDoc(healthProfileDoc(uid)).catch(() => undefined);
  await deleteDoc(userDoc(uid)).catch(() => undefined);
}
