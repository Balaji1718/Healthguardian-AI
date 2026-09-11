import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./config";
import { ensureUserRoot } from "./repositories";

export { getFirebaseAuth };

export async function register(email: string, password: string, displayName: string) {
  const auth = getFirebaseAuth();
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn("Could not set browserLocalPersistence:", err);
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  await ensureUserRoot(cred.user.uid, email, displayName || email.split("@")[0]!);
  return cred.user;
}

export async function login(email: string, password: string) {
  const auth = getFirebaseAuth();
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn("Could not set browserLocalPersistence:", err);
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserRoot(cred.user.uid, cred.user.email ?? email, cred.user.displayName ?? "");
  return cred.user;
}

export const logout = () => signOut(getFirebaseAuth());
export const resetPassword = (email: string) => sendPasswordResetEmail(getFirebaseAuth(), email);
export const watchAuth = (cb: (u: User | null) => void) =>
  onAuthStateChanged(getFirebaseAuth(), cb);

/** Account deletion requires a recent login; we re-authenticate with the password. */
export async function deleteAccount(password: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) throw new Error("Not signed in");
  const cred = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, cred);
  await deleteUser(user);
}

export async function getCurrentUserIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
