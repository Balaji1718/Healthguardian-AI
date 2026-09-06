import { saveCheckin, createGoal, deleteAllHealthData } from "@/services/firebase/repositories";

export const SAMPLE_STORAGE_KEY = "healthguardian_is_sample_profile";

export function isSampleProfileActive(): boolean {
  try {
    return localStorage.getItem(SAMPLE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSampleProfileActive(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(SAMPLE_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(SAMPLE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Generates 7 realistic days of health check-ins and an initial wellness goal
 * so first-time users can immediately see how HealthGuardian analyzes data.
 */
export async function loadSampleHealthProfile(uid: string): Promise<void> {
  const sampleHabits = [
    { sleep: 7.5, water: 7, exercise: 30, type: "Walking", sys: 120, dia: 80, bg: 92, mood: "great" as const },
    { sleep: 7.0, water: 6, exercise: 25, type: "Jogging", sys: 118, dia: 78, bg: 95, mood: "good" as const },
    { sleep: 6.5, water: 8, exercise: 40, type: "Cycling", sys: 122, dia: 82, bg: 96, mood: "good" as const },
    { sleep: 7.0, water: 7, exercise: 30, type: "Walking", sys: 121, dia: 80, bg: 94, mood: "great" as const },
    { sleep: 8.0, water: 6, exercise: 35, type: "Yoga", sys: 119, dia: 79, bg: 90, mood: "great" as const },
    { sleep: 7.5, water: 8, exercise: 30, type: "Walking", sys: 120, dia: 80, bg: 93, mood: "good" as const },
    { sleep: 7.5, water: 7, exercise: 30, type: "Walking", sys: 120, dia: 80, bg: 92, mood: "great" as const },
  ];

  const now = new Date();

  // Save 7 consecutive days of check-ins
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const data = sampleHabits[6 - i]!;

    await saveCheckin(uid, d, {
      date: d,
      sleepHours: data.sleep,
      waterGlasses: data.water,
      exerciseMinutes: data.exercise,
      exerciseType: data.type,
      systolicBp: data.sys,
      diastolicBp: data.dia,
      fastingBloodGlucose: data.bg,
      wellbeing: data.mood,
      notes: i === 0 ? "Felt energized after morning walk." : undefined,
      provenance: "manual",
      verificationStatus: "user_verified",
    });
  }

  // Create an active goal
  try {
    await createGoal(uid, {
      title: "Daily Hydration & Sleep Rhythm",
      description: "Maintain 7+ hours of sleep and at least 6 glasses of water daily.",
      targetValue: 7,
      currentValue: 7,
      unit: "hours",
      status: "active",
      category: "sleep",
    });
  } catch {
    // Goal creation is non-blocking for sample load
  }

  setSampleProfileActive(true);
}

/**
 * Wipes the sample health data and resets the user profile to clean state.
 */
export async function clearSampleHealthProfile(uid: string): Promise<void> {
  await deleteAllHealthData(uid);
  setSampleProfileActive(false);
}
