import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

export default function Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
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
    const unsubscribe = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snapshot) => {
        setPlayers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, [roomId]);

  async function handleStart() {
    await updateDoc(doc(db, "rooms", roomId), {
      status: "question",
      currentQuestionIndex: 0,
    });
    navigate(`/live/${roomId}`);
  }

  if (!room) return <div style={{ padding: "2rem" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1>Lobby</h1>
      <p>
        Room code: <strong style={{ fontSize: "2rem" }}>{roomId}</strong>
      </p>
      <p>Share this code with your players.</p>

      <h2>Players ({players.length})</h2>
      {players.length === 0 ? (
        <p style={{ color: "#999" }}>Waiting for players to join...</p>
      ) : (
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.nickname}</li>
          ))}
        </ul>
      )}

      <button
        onClick={handleStart}
        disabled={players.length === 0}
        style={{ marginTop: "2rem" }}
      >
        Start Quiz
      </button>
    </div>
  );
}