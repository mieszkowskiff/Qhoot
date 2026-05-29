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
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  // Waiting for host to start
  if (room.status === "waiting") {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "2rem" }}>
        <h1>Waiting for host to start...</h1>
        <p>Get ready!</p>
      </div>
    );
  }

  const currentQuestion = questions[room.currentQuestionIndex];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem" }}>
      <p style={{ color: "#999" }}>
        Question {room.currentQuestionIndex + 1} / {questions.length}
      </p>

      <h2>{currentQuestion.text}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: "1.5rem" }}>
        {currentQuestion.answers.map((answer, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            disabled={answered}
            style={{
              padding: "1rem",
              fontSize: "1rem",
              borderRadius: 8,
              border: "2px solid",
              cursor: answered ? "default" : "pointer",
              borderColor:
                answered && selectedAnswer === i
                  ? i === currentQuestion.correctAnswer ? "#4fcf70" : "#f74f4f"
                  : "#ddd",
              backgroundColor:
                answered && selectedAnswer === i
                  ? i === currentQuestion.correctAnswer ? "#e6faf0" : "#fde8e8"
                  : "white",
            }}
          >
            {answer}
          </button>
        ))}
      </div>

      {answered && (
        <p style={{ marginTop: "1.5rem", textAlign: "center", color: "#999" }}>
          {selectedAnswer === currentQuestion.correctAnswer
            ? "✅ Correct! Waiting for next question..."
            : "❌ Wrong! Waiting for next question..."}
        </p>
      )}
    </div>
  );
}