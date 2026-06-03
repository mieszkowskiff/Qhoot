import { auth, googleProvider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  async function handleLogin() {
    await signInWithPopup(auth, googleProvider);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-line bg-ivory px-10 py-14 text-center shadow-[0_1px_2px_rgba(42,39,36,0.05),0_24px_56px_-28px_rgba(42,39,36,0.22)]">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-camel">
          Members Only
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-ink">
          Welcome to CloudVote
        </h1>
        <p className="mt-4 text-sm leading-relaxed tracking-wide text-stone">
          Sign in to create and host your quizzes.
        </p>

        <div className="my-9 h-px bg-line" />

        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2.5 rounded-full bg-oxford px-9 py-3.5 text-sm font-medium tracking-wide text-alabaster shadow-[0_10px_28px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft"
        >
          <LogIn className="h-4 w-4" strokeWidth={1.75} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
