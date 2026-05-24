import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CreateQuiz from "./pages/CreateQuiz";
import LaunchRoom from "./pages/LaunchRoom";
import Lobby from "./pages/Lobby";
import LiveDashboard from "./pages/LiveDashboard";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/quiz/new" element={<ProtectedRoute><CreateQuiz /></ProtectedRoute>} />
        <Route path="/quiz/:quizId/launch" element={<ProtectedRoute><LaunchRoom /></ProtectedRoute>} />
        <Route path="/lobby/:roomId" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
        <Route path="/live/:roomId" element={<ProtectedRoute><LiveDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;