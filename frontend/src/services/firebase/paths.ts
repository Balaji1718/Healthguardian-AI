import { collection, doc } from "firebase/firestore";
import { getDb } from "./config";

/** All Firestore access is user-scoped. Never build a path without the owner uid. */
export const userDoc = (uid: string) => doc(getDb(), "users", uid);
export const profileDoc = (uid: string) => doc(getDb(), "users", uid, "profile", "main");
export const healthProfileDoc = (uid: string) =>
  doc(getDb(), "users", uid, "healthProfile", "main");
export const checkinsCol = (uid: string) => collection(getDb(), "users", uid, "dailyCheckins");
export const reportsCol = (uid: string) => collection(getDb(), "users", uid, "medicalReports");
export const resultsCol = (uid: string, reportId: string) =>
  collection(getDb(), "users", uid, "medicalReports", reportId, "results");
export const recordsCol = (uid: string) => collection(getDb(), "users", uid, "healthRecords");
export const assessmentsCol = (uid: string) => collection(getDb(), "users", uid, "riskAssessments");
export const goalsCol = (uid: string) => collection(getDb(), "users", uid, "goals");
export const notificationsCol = (uid: string) => collection(getDb(), "users", uid, "notifications");
export const sessionsCol = (uid: string) => collection(getDb(), "users", uid, "agentSessions");
export const messagesCol = (uid: string, sessionId: string) =>
  collection(getDb(), "users", uid, "agentSessions", sessionId, "messages");
export const guidanceCol = (uid: string) => collection(getDb(), "users", uid, "specialistGuidance");
export const supportCol = (uid: string) => collection(getDb(), "users", uid, "supportRequests");
export const deviceTokensCol = (uid: string) => collection(getDb(), "users", uid, "deviceTokens");
