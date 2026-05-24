import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function Home() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "quizzes"),
      where("hostUid", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My Quizzes</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => navigate("/quiz/new")}>+ New Quiz</button>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <p style={{ color: "#999" }}>No quizzes yet. Create your first one!</p>
      ) : (
        <div>
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{quiz.title}</strong>
                <p style={{ margin: 0, color: "#999", fontSize: "0.85rem" }}>
                  {quiz.createdAt?.toDate().toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => navigate(`/quiz/${quiz.id}/launch`)}>
                Launch
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}