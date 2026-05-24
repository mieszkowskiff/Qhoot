import { auth, googleProvider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  async function handleLogin() {
    await signInWithPopup(auth, googleProvider);
    navigate("/");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1>CloudVote</h1>
      <p>Sign in to create and host quizzes.</p>
      <button onClick={handleLogin}>Sign in with Google</button>
    </div>
  );
}