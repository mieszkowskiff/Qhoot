import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1>Ready to launch?</h1>
      <p>A room code will be generated for your players to join.</p>
      <button onClick={handleLaunch}>Launch Room</button>
    </div>
  );
}