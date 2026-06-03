import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Rocket, KeyRound } from "lucide-react";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function LaunchRoom() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  async function handleLaunch() {
    const roomId = generateRoomCode();
    await setDoc(doc(db, "rooms", roomId), {
      quizId,
      hostUid: auth.currentUser.uid,
      status: "waiting",
      currentQuestionIndex: 0,
      createdAt: new Date(),
    });
    navigate(`/lobby/${roomId}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-line bg-ivory px-10 py-12 text-center shadow-[0_1px_2px_rgba(42,39,36,0.04),0_20px_48px_-24px_rgba(42,39,36,0.18)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-alabaster text-camel">
          <KeyRound className="h-6 w-6" strokeWidth={1.5} />
        </span>

        <p className="mt-7 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
          New Session
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
          Ready to launch?
        </h1>
        <p className="mt-4 text-sm leading-relaxed tracking-wide text-stone">
          A room code will be generated for your players to join.
        </p>

        <button
          onClick={handleLaunch}
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-oxford px-8 py-3 text-sm font-medium tracking-wide text-alabaster shadow-[0_8px_24px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft"
        >
          <Rocket className="h-4 w-4" strokeWidth={1.75} />
          Launch Room
        </button>
      </div>
    </div>
  );
}
