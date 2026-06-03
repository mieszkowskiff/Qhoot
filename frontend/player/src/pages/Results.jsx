import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Award, Trophy } from "lucide-react";

export default function Results() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);

  const playerId = sessionStorage.getItem("playerId");
  const nickname = sessionStorage.getItem("nickname");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snap) => {
        const sorted = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.score - a.score);
        setPlayers(sorted);
      }
    );
    return () => unsubscribe();
  }, [roomId]);

  const myPosition = players.findIndex((p) => p.id === playerId) + 1;
  const myScore = players.find((p) => p.id === playerId)?.score ?? 0;

  return (
    <div className="min-h-screen bg-parchment px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/")}
            className="rounded-full border border-line bg-transparent px-6 py-2 text-sm tracking-wide text-stone transition-colors duration-300 hover:bg-alabaster hover:text-ink"
          >
            Join Another Session
          </button>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
            CloudVote
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
            Quiz Finished
          </h1>
        </div>

        {/* Result certificate card */}
        <div className="mt-8 rounded-3xl border border-line bg-ivory px-8 py-10 text-center shadow-[0_1px_2px_rgba(42,39,36,0.05),0_20px_48px_-24px_rgba(42,39,36,0.18)]">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-alabaster text-camel">
            <Award className="h-6 w-6" strokeWidth={1.5} />
          </span>

          <p className="mt-6 text-xs uppercase tracking-widest text-stone-soft">
            Your result
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-ink">
            {nickname}
          </h2>

          <div className="my-7 h-px bg-line" />

          <p className="font-serif text-7xl font-semibold leading-none tracking-tight text-oxford">
            {myScore}
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-stone-soft">
            Points
          </p>

          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-line bg-cashmere px-5 py-2">
            <span className="font-serif text-lg text-ink">#{myPosition}</span>
            <span className="text-xs uppercase tracking-widest text-stone">
              Place
            </span>
          </div>
        </div>

        {/* Leaderboard */}
        <section className="mt-10">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-camel" strokeWidth={1.75} />
            <h2 className="font-serif text-xl font-semibold tracking-tight text-ink">
              Leaderboard
            </h2>
          </div>

          <ol className="mt-5 space-y-2.5">
            {players.map((p, idx) => {
              const isMe = p.id === playerId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl border px-5 py-3.5 transition-colors duration-300 ${
                    isMe
                      ? "border-oxford/30 bg-oxford/5 shadow-[0_1px_2px_rgba(27,42,74,0.06)]"
                      : "border-line bg-ivory shadow-[0_1px_2px_rgba(42,39,36,0.03)]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full font-serif text-base ${
                        idx === 0
                          ? "bg-oxford text-alabaster"
                          : "border border-line-strong bg-alabaster text-stone"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`text-[0.95rem] tracking-wide ${
                        isMe
                          ? "font-semibold text-oxford"
                          : "font-medium text-ink"
                      }`}
                    >
                      {p.nickname}
                    </span>
                  </div>
                  <span className="font-serif text-lg text-ink">
                    {p.score}
                    <span className="ml-1.5 font-sans text-[0.7rem] uppercase tracking-[0.18em] text-stone-soft">
                      pts
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
