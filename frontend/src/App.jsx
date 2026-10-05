import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "./components/SmoothScroll";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Ai from "./pages/Ai";
import Repo from "./pages/Repo";
import Feedback from "./pages/Feedback";

function App() {
  return (
    <AuthProvider>
      <SmoothScroll>
        <div className="grain-overlay" aria-hidden="true" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/home" element={<Home />} />
            <Route path="/ai" element={<Ai />} />
            <Route path="/repo" element={<Repo />} />
            <Route path="/feedback" element={<Feedback />} />
          </Routes>
        </BrowserRouter>
      </SmoothScroll>
    </AuthProvider>
  );
}

export default App;