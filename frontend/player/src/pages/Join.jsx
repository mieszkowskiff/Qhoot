import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";

export default function Join() {
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
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
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "2rem" }}>
      <h1>Join Quiz</h1>

      <input
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
        placeholder="Room code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        maxLength={6}
      />

      <input
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
        placeholder="Your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button
        onClick={handleJoin}
        disabled={loading || !roomCode || !nickname}
        style={{ width: "100%" }}
      >
        {loading ? "Joining..." : "Join"}
      </button>
    </div>
  );
}