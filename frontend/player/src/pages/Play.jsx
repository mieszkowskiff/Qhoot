import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  getDocs,
} from "firebase/firestore";
import { Check, X, Hourglass } from "lucide-react";

// Lettered markers lend each option an engraved, examination-paper feel.
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function Play() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const playerId = sessionStorage.getItem("playerId");

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data();
      setRoom({ id: snap.id, ...data });
      if (data?.status === "finished") {
        navigate(`/results/${roomId}`);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    setAnswered(false);
    setSelectedAnswer(null);
  }, [room?.currentQuestionIndex]);

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

  async function handleAnswer(answerIndex) {
    if (answered) return;
    setAnswered(true);
    setSelectedAnswer(answerIndex);

    await fetch(`${import.meta.env.VITE_API_GATEWAY_URL}/api/v1/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        playerId,
        questionIndex: room.currentQuestionIndex,
        answerIndex,
      }),
    });
  }

  // Loading state
  if (!room || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-6">
        <p className="font-serif text-2xl italic text-stone">Loading…</p>
      </div>
    );
  }

  // Waiting for host to start
  if (room.status === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-6">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-ivory px-8 py-12 text-center shadow-[0_1px_2px_rgba(42,39,36,0.04),0_20px_48px_-24px_rgba(42,39,36,0.18)]">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-alabaster text-camel">
            <Hourglass className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-ink">
            Awaiting the Host
          </h1>
          <p className="mt-3 text-sm tracking-wide text-stone">
            Kindly prepare yourself — the session begins shortly.
          </p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[room.currentQuestionIndex];
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <div className="min-h-screen bg-parchment px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col">
        {/* Progress label */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ivory px-4 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-camel">
            Question {room.currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Question */}
        <div className="mt-8 rounded-3xl border border-line bg-ivory px-7 py-8 text-center shadow-[0_1px_2px_rgba(42,39,36,0.04),0_12px_32px_-16px_rgba(42,39,36,0.12)]">
          <h2 className="font-serif text-2xl leading-snug tracking-tight text-ink">
            {currentQuestion.text}
          </h2>
        </div>

        {/* Answer options */}
        <div className="mt-7 grid grid-cols-1 gap-3.5">
          {currentQuestion.answers.map((answer, i) => {
            const isThisSelected = answered && selectedAnswer === i;
            const isThisCorrect = i === currentQuestion.correctAnswer;

            let stateClasses =
              "border-line bg-alabaster text-ink hover:border-line-strong hover:bg-ivory active:scale-[0.99]";
            if (answered) {
              if (isThisSelected && isThisCorrect) {
                stateClasses = "border-oxford bg-oxford text-alabaster";
              } else if (isThisSelected && !isThisCorrect) {
                stateClasses = "border-burgundy bg-burgundy text-alabaster";
              } else {
                stateClasses = "border-line bg-ivory text-stone-soft opacity-70";
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                  answered ? "cursor-default" : "cursor-pointer"
                } ${stateClasses}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-base ${
                    isThisSelected
                      ? "bg-alabaster/20 text-alabaster"
                      : "border border-line-strong bg-parchment text-stone"
                  }`}
                >
                  {isThisSelected && isThisCorrect ? (
                    <Check className="h-4 w-4" strokeWidth={2} />
                  ) : isThisSelected && !isThisCorrect ? (
                    <X className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    OPTION_LABELS[i]
                  )}
                </span>
                <span className="text-[1.02rem] font-medium tracking-wide">
                  {answer}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {answered && (
          <div className="mt-auto pt-8">
            <div
              className={`flex items-center justify-center gap-2.5 rounded-2xl border px-6 py-4 text-center ${
                isCorrect
                  ? "border-oxford/25 bg-oxford/5 text-oxford"
                  : "border-burgundy/25 bg-burgundy/5 text-burgundy"
              }`}
            >
              {isCorrect ? (
                <Check className="h-4 w-4" strokeWidth={2} />
              ) : (
                <X className="h-4 w-4" strokeWidth={2} />
              )}
              <span className="font-serif text-lg italic">
                {isCorrect ? "Well played." : "Not this time."}
              </span>
            </div>
            <p className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-stone-soft">
              Awaiting the next question
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
