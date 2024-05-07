import { useNavigate, Routes, Route } from 'react-router-dom';
import {
  NextUIProvider,
} from "@nextui-org/react";
import './App.css'
import CoursePage from "./pages/course.tsx";
import useDarkMode from "use-dark-mode";
import Layout from "./components/layout.tsx";
import OAuthCallbackPage from "./pages/oauth_callback.tsx";

function App() {
  const navigate = useNavigate();
  const darkMode = useDarkMode(false, {
    classNameDark: "dark",
    classNameLight: "light",
    element: document.documentElement,
  });

  return (
    <NextUIProvider navigate={navigate} className={`${darkMode.value ? 'dark' : ''} text-foreground bg-background`}>
      <Routes>
        <Route path="/" element={<Layout darkMode={darkMode}/>}>
          <Route path="/" element={<CoursePage/>}/>
        </Route>

        <Route path="/auth/:channel/callback" element={<OAuthCallbackPage/>}/>
      </Routes>
    </NextUIProvider>
  )
}

export default App
