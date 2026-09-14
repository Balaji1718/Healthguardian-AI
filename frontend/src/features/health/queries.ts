import { useQuery } from "@tanstack/react-query";
import {
  listCheckins,
  listGoals,
  listNotifications,
  listReports,
  listResults,
  listAssessments,
  listGuidance,
  listSupportRequests,
  getProfile,
  getHealthProfile,
  listSessions,
  listMessages,
  listHealthRecords,
  listAllVerifiedResults,
} from "@/services/firebase/repositories";
import { calculateHealthScore, detectPatterns } from "@/features/healthRisk/engine";

const opts = { staleTime: 30_000, retry: 1 } as const;

export const useCheckins = (uid: string | null, max = 60) =>
  useQuery({
    queryKey: ["checkins", uid, max],
    queryFn: () => listCheckins(uid!, max),
    enabled: !!uid,
    ...opts,
  });

export const useReports = (uid: string | null) =>
  useQuery({
    queryKey: ["reports", uid],
    queryFn: () => listReports(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useResults = (uid: string | null, reportId: string | null) =>
  useQuery({
    queryKey: ["results", uid, reportId],
    queryFn: () => listResults(uid!, reportId!),
    enabled: !!uid && !!reportId,
    ...opts,
  });

export const useHealthRecords = (uid: string | null, metric?: string, limit = 100) =>
  useQuery({
    queryKey: ["healthRecords", uid, metric, limit],
    queryFn: () => listHealthRecords(uid!, metric, limit),
    enabled: !!uid,
    ...opts,
  });

export const useAllVerifiedResults = (uid: string | null) =>
  useQuery({
    queryKey: ["verifiedMedicalResults", uid],
    queryFn: () => listAllVerifiedResults(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useGoals = (uid: string | null) =>
  useQuery({ queryKey: ["goals", uid], queryFn: () => listGoals(uid!), enabled: !!uid, ...opts });

export const useNotifications = (uid: string | null) =>
  useQuery({
    queryKey: ["notifications", uid],
    queryFn: () => listNotifications(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useNotificationsQuery = useNotifications;

export const useAssessments = (uid: string | null) =>
  useQuery({
    queryKey: ["assessments", uid],
    queryFn: () => listAssessments(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useGuidance = (uid: string | null) =>
  useQuery({
    queryKey: ["guidance", uid],
    queryFn: () => listGuidance(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useSupportRequests = (uid: string | null) =>
  useQuery({
    queryKey: ["supportRequests", uid],
    queryFn: () => listSupportRequests(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useProfile = (uid: string | null) =>
  useQuery({
    queryKey: ["profile", uid],
    queryFn: () => getProfile(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useHealthProfile = (uid: string | null) =>
  useQuery({
    queryKey: ["healthProfile", uid],
    queryFn: () => getHealthProfile(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useSessions = (uid: string | null) =>
  useQuery({
    queryKey: ["sessions", uid],
    queryFn: () => listSessions(uid!),
    enabled: !!uid,
    ...opts,
  });

export const useMessages = (uid: string | null, sessionId: string | null) =>
  useQuery({
    queryKey: ["messages", uid, sessionId],
    queryFn: () => listMessages(uid!, sessionId!),
    enabled: !!uid && !!sessionId,
    ...opts,
  });

/** Deterministic analysis derived from check-ins and canonical verified lab results. */
export function useAnalysis(uid: string | null) {
  const q = useCheckins(uid);
  const qLabs = useAllVerifiedResults(uid);
  const checkins = q.data ?? [];
  const verifiedResults = qLabs.data ?? [];
  const patterns = detectPatterns(checkins, verifiedResults);
  const score = calculateHealthScore(checkins, patterns);
  return {
    ...q,
    isLoading: q.isLoading || qLabs.isLoading,
    isError: q.isError || qLabs.isError,
    checkins,
    verifiedResults,
    patterns,
    score,
  };
}
