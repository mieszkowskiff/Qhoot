import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { ArrowRight, Flag, Trophy, Users } from "lucide-react";

const COLORS = ["#23395b", "#b08d57", "#6e2433", "#2c3e63"];
const CORRECT_COLOR = "#1b2a4a";

export default function LiveDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data();
      if (data?.hostUid !== auth.currentUser?.uid) {
        navigate("/");
        return;
      }
      setRoom({ id: snap.id, ...data });
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!room?.quizId) return;
    const q = query(
      collection(db, "quizzes", room.quizId, "questions"),
      orderBy("order")
    );
    getDocs(q).then((snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [room?.quizId]);

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

  async function handleNext() {
    const nextIndex = room.currentQuestionIndex + 1;
    if (nextIndex >= questions.length) {
      await updateDoc(doc(db, "rooms", roomId), { status: "finished" });
    } else {
      await updateDoc(doc(db, "rooms", roomId), {
        currentQuestionIndex: nextIndex,
      });
    }
  }

  if (!room || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment">
        <p className="font-serif text-2xl italic text-stone">Loading…</p>
      </div>
    );
  }

  if (room.status === "finished") {
    return (
      <div className="relative min-h-screen bg-parchment px-6 py-16">
        <button
          onClick={() => navigate("/")}
          className="absolute left-6 top-8 transition-transform duration-300 hover:scale-105 focus:outline-none"
          title="CLOUDVOTE | HOME"
        >
          <img src="/favicon.svg" alt="CloudVote Logo" className="h-11 w-11 drop-shadow-sm" />
        </button>

        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ivory px-4 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-camel">
              <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} />
              The Final Standing
            </span>
            <h1 className="mt-6 font-serif text-5xl font-semibold tracking-tight text-ink">
              Quiz Concluded
            </h1>
            <p className="mt-3 text-sm tracking-wide text-stone">
              With gratitude for your participation.
            </p>
          </div>

          <ol className="mt-12 space-y-3">
            {players.map((p, idx) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-ivory px-6 py-4 shadow-[0_1px_2px_rgba(42,39,36,0.04)]"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-serif text-lg ${
                      idx === 0
                        ? "bg-oxford text-alabaster"
                        : "border border-line-strong bg-alabaster text-stone"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-base font-medium tracking-wide text-ink">
                    {p.nickname}
                  </span>
                </div>
                <span className="font-serif text-xl text-ink">
                  {p.score}
                  <span className="ml-1.5 font-sans text-xs uppercase tracking-[0.18em] text-stone-soft">
                    pts
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[room.currentQuestionIndex];

  const voteCounts = currentQuestion.answers.map((answer, i) => ({
    name: answer || `Answer ${i + 1}`,
    votes: players.filter((p) => p.lastAnswer === i).length,
    correct: i === currentQuestion.correctAnswer,
  }));

  const isLastQuestion = room.currentQuestionIndex + 1 === questions.length;

  return (
    <div className="min-h-screen bg-parchment px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-camel">
              Live Session
            </p>
            <h1 className="mt-1.5 font-serif text-2xl font-semibold tracking-tight text-ink">
              Question{" "}
              <span className="text-oxford">
                {room.currentQuestionIndex + 1}
              </span>
              <span className="mx-1.5 text-stone-soft">/</span>
              <span className="text-stone">{questions.length}</span>
            </h1>
          </div>

          <button
            onClick={handleNext}
            className="group inline-flex items-center gap-2 rounded-full bg-oxford px-7 py-3 text-sm font-medium tracking-wide text-alabaster shadow-[0_8px_24px_-12px_rgba(27,42,74,0.6)] transition-colors duration-300 hover:bg-oxford-soft"
          >
            {isLastQuestion ? (
              <>
                <Flag className="h-4 w-4" strokeWidth={1.75} />
                End Quiz
              </>
            ) : (
              <>
                Next Question
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </>
            )}
          </button>
        </header>

        {/* Question + Chart card */}
        <section className="mt-8 rounded-3xl border border-line bg-ivory p-8 shadow-[0_1px_2px_rgba(42,39,36,0.04),0_12px_32px_-16px_rgba(42,39,36,0.12)]">
          <h2 className="font-serif text-3xl leading-snug tracking-tight text-ink">
            {currentQuestion.text}
          </h2>

          <div className="mt-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={voteCounts}
                margin={{ top: 24, right: 8, left: 8, bottom: 8 }}
                barCategoryGap="28%"
              >
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: "#e0dace" }}
                  tick={{
                    fill: "#6b6557",
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                  }}
                  dy={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{
                    fill: "#8c8576",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <Bar
                  dataKey="votes"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={88}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="votes"
                    position="top"
                    fill="#2a2724"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 18,
                    }}
                  />
                  {voteCounts.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.correct ? CORRECT_COLOR : COLORS[i % COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-xs tracking-wide text-stone-soft">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-oxford" />
            Correct response.
          </div>
        </section>

        {/* Leaderboard */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-camel" strokeWidth={1.75} />
            <h2 className="font-serif text-xl font-semibold tracking-tight text-ink">
              Leaderboard
            </h2>
          </div>

          {players.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-line bg-ivory px-6 py-8 text-center text-sm italic tracking-wide text-stone-soft">
              No players yet.
            </p>
          ) : (
            <ol className="mt-5 space-y-2.5">
              {players.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-ivory px-5 py-3.5 shadow-[0_1px_2px_rgba(42,39,36,0.03)] transition-colors duration-300 hover:bg-alabaster"
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
                    <span className="text-[0.95rem] font-medium tracking-wide text-ink">
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
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}