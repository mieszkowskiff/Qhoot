import { BrowserRouter, Routes, Route } from "react-router-dom";
import Join from "./pages/Join";
import Play from "./pages/Play";
import Results from "./pages/Results";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Join />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play/:roomId" element={<Play />} />
        <Route path="/results/:roomId" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;