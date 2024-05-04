import { useNavigate, Routes, Route } from 'react-router-dom';
import { NextUIProvider } from "@nextui-org/react";
import './App.css'
import LoginPage from "./pages/login.tsx";

function App() {
  const navigate = useNavigate();

  return (
    <NextUIProvider navigate={navigate}>
      <div className='min-h-dvh'>
        <Routes>
          <Route path="/" element={<LoginPage/>}/>
        </Routes>
      </div>
    </NextUIProvider>
  )
}

export default App
