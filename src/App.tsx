import { useNavigate, Routes, Route } from 'react-router-dom';
import {
  HeroUIProvider,
} from "@heroui/react";
import './App.css'
import CoursePage from "./pages/course.tsx";
import useDarkMode from "use-dark-mode";
import Layout from "./components/layout.tsx";
import OAuthCallbackPage from "./pages/oauth_callback.tsx";
import HomePage from "./pages/home.tsx";

function App() {
  const navigate = useNavigate();
  const darkMode = useDarkMode(false, {
    classNameDark: "dark",
    classNameLight: "light",
    element: document.documentElement,
  });

  return (
    <HeroUIProvider navigate={navigate} className={`${darkMode.value ? 'dark' : ''} text-foreground bg-background`}>
      <Routes>
        <Route path="/" element={<Layout darkMode={darkMode}/>}>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/course/:id" element={<CoursePage/>}/>
        </Route>

        <Route path="/auth/:channel/callback" element={<OAuthCallbackPage/>}/>
      </Routes>
    </HeroUIProvider>
  )
}

export default App
