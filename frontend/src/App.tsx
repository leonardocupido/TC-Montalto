import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Bacheca from "@/pages/Bacheca";
import Proponi from "@/pages/Proponi";
import MiePartite from "@/pages/MiePartite";
import MieCandidature from "@/pages/MieCandidature";
import Soci from "@/pages/Soci";
import Socio from "@/pages/Socio";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Bacheca />} />
        <Route path="/proponi" element={<Proponi />} />
        <Route path="/le-mie-partite" element={<MiePartite />} />
        <Route path="/le-mie-candidature" element={<MieCandidature />} />
        <Route path="/soci" element={<Soci />} />
        <Route path="/soci/:id" element={<Socio />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
