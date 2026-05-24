import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function Results() {
  const { roomId } = useParams();

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
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem" }}>
      <h1>Quiz Finished!</h1>

      <div
        style={{
          border: "2px solid #4f8ef7",
          borderRadius: 8,
          padding: "1rem",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "#999" }}>Your result</p>
        <h2 style={{ margin: "0.5rem 0" }}>{nickname}</h2>
        <p style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>
          {myScore} pts
        </p>
        <p style={{ color: "#999" }}>#{myPosition} place</p>
      </div>

      <h2>Leaderboard</h2>
      <ol>
        {players.map((p) => (
          <li
            key={p.id}
            style={{
              fontWeight: p.id === playerId ? "bold" : "normal",
              color: p.id === playerId ? "#4f8ef7" : "inherit",
            }}
          >
            {p.nickname} — {p.score} pts
          </li>
        ))}
      </ol>
    </div>
  );
}