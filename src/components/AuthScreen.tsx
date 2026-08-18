import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from "firebase/auth";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { auth, googleProvider } from "../lib/firebase";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    if (!auth) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setMessage(authMessage(error));
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!auth || !email) {
      setMessage("Enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent.");
    } catch (error) {
      setMessage(authMessage(error));
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Selah Bible">
        <div className="auth-visual-shade" />
        <div className="brand brand-light"><BookOpen size={20} /> Selah Bible</div>
        <div className="auth-quote">
          <p className="eyebrow">Read with intention</p>
          <h1>Open the Word.<br />Keep your place.</h1>
          <p>Build a quiet record of the chapters, time, and rhythm that shape your reading.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand brand"><BookOpen size={19} /> Selah Bible</div>
          <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Create your account"}</p>
          <h2>{mode === "signin" ? "Return to your reading" : "Begin your reading record"}</h2>
          <p className="muted">Your history and progress stay private to your account.</p>
          <button className="google-button" disabled={busy} onClick={googleSignIn}>
            <span className="google-g">G</span> Continue with Google
          </button>
          <div className="or"><span>or use email</span></div>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>First name<input required value={name} onChange={event => setName(event.target.value)} /></label>
            )}
            <label>Email<input autoComplete="email" required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label>Password<input autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
            {mode === "signin" && <button className="text-button reset-link" onClick={resetPassword} type="button">Forgot password?</button>}
            {message && <p className="form-message" role="alert">{message}</p>}
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="switch-mode">
            {mode === "signin" ? "New here?" : "Already have an account?"}
            <button className="text-button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

function authMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account already uses this email.";
  if (code.includes("popup-closed")) return "Google sign-in was canceled.";
  if (code.includes("popup-blocked")) return "Allow pop-ups, then try Google sign-in again.";
  if (code.includes("unauthorized-domain")) return "This site is not authorized for Google sign-in yet.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  return "We could not sign you in. Please try again.";
}
