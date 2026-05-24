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
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#4f8ef7", "#f7a74f", "#4fcf70", "#f74f4f"];

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
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  if (room.status === "finished") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
        <h1>Quiz Finished!</h1>
        <h2>Final Leaderboard</h2>
        <ol>
          {players.map((p) => (
            <li key={p.id}>
              {p.nickname} — {p.score} pts
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const currentQuestion = questions[room.currentQuestionIndex];

  const voteCounts = currentQuestion.answers.map((answer, i) => ({
    name: answer || `Answer ${i + 1}`,
    votes: players.filter((p) => p.lastAnswer === i).length,
    correct: i === currentQuestion.correctAnswer,
  }));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Question {room.currentQuestionIndex + 1} / {questions.length}</h1>
        <button onClick={handleNext}>
          {room.currentQuestionIndex + 1 === questions.length ? "End Quiz" : "Next Question"}
        </button>
      </div>

      <h2>{currentQuestion.text}</h2>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={voteCounts}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Bar dataKey="votes">
            {voteCounts.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.correct ? "#4fcf70" : COLORS[i % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <h2>Leaderboard</h2>
      {players.length === 0 ? (
        <p style={{ color: "#999" }}>No players yet.</p>
      ) : (
        <ol>
          {players.map((p) => (
            <li key={p.id}>
              {p.nickname} — {p.score} pts
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}