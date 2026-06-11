import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { AlertCircle } from "lucide-react";

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError("");
    setLoading(true);

    try {
      const roomRef = doc(db, "rooms", roomCode.toUpperCase());
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setError("Room not found. Check the code and try again.");
        setLoading(false);
        return;
      }

      if (roomSnap.data().status !== "waiting") {
        setError("This room has already started.");
        setLoading(false);
        return;
      }

      const playersRef = collection(db, "rooms", roomCode.toUpperCase(), "players");
      const playerDoc = await addDoc(playersRef, {
        nickname,
        score: 0,
        joinedAt: new Date(),
      });

      // Store playerId in sessionStorage so we can update score later
      sessionStorage.setItem("playerId", playerDoc.id);
      sessionStorage.setItem("nickname", nickname);

      navigate(`/play/${roomCode.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-ivory px-8 py-10 shadow-[0_1px_2px_rgba(42,39,36,0.05),0_20px_48px_-24px_rgba(42,39,36,0.18)]">
        <div className="text-center">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
            CloudVote
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
            Join Quiz
          </h1>
          <p className="mt-3 text-sm tracking-wide text-stone">
            Enter your code to take a seat.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="block text-[0.7rem] font-medium uppercase tracking-[0.2em] text-stone">
              Room Code
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-line bg-alabaster px-4 py-3.5 text-center font-serif text-xl uppercase tracking-[0.3em] text-ink placeholder:font-sans placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-soft focus:border-oxford focus:outline-none focus:ring-2 focus:ring-oxford/15"
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-[0.7rem] font-medium uppercase tracking-[0.2em] text-stone">
              Nickname
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-line bg-alabaster px-4 py-3.5 text-center text-base text-ink placeholder:text-stone-soft focus:border-oxford focus:outline-none focus:ring-2 focus:ring-oxford/15"
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-burgundy/25 bg-burgundy/5 px-4 py-3 text-sm tracking-wide text-burgundy">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || !roomCode || !nickname}
          className="mt-7 w-full rounded-full bg-oxford px-7 py-3.5 text-sm font-medium tracking-wide text-alabaster shadow-[0_10px_28px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? "Joining…" : "Join"}
        </button>
      </div>
    </div>
  );
}