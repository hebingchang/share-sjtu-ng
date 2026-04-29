import { AnimatePresence, motion } from 'motion/react'
import { BrowserRouter, Route, Routes, useLocation, useParams } from 'react-router'
import { useAuth } from './auth/use-auth'
import InitialLoader from './components/initial-loader'
import Layout from './components/layout'
import CoursePage from './pages/course'
import HomePage from './pages/home'
import OAuthCallbackPage from './pages/oauth-callback'
import SearchPage from './pages/search'
import UserPage from './pages/user'

function OAuthCallbackRoute() {
  const { channel = '' } = useParams()

  return <OAuthCallbackPage channel={channel} />
}

function AnimatedRoutes() {
  const location = useLocation()
  const courseMatch = location.pathname.match(/^(\/course\/[^/]+)/)
  const userMatch = location.pathname.match(/^\/user(?:\/|$)/)
  const animationKey = courseMatch ? courseMatch[1] : userMatch ? '/user' : location.pathname

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={animationKey}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -2 }}
        initial={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      >
        <Routes location={location}>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/user/*" element={<UserPage />} />
          <Route path="/course/:id" element={<CoursePage />} />
          <Route path="/course/:id/material/:materialId" element={<CoursePage />} />
          <Route path="/course/:id/class/:classId" element={<CoursePage />} />
          <Route
            path="/course/:id/class/:classId/material/:materialId"
            element={<CoursePage />}
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const { isInitializing } = useAuth()

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/:channel/callback" element={<OAuthCallbackRoute />} />
          <Route
            path="*"
            element={
              <Layout>
                <AnimatedRoutes />
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
      <InitialLoader isVisible={isInitializing} />
    </>
  )
}
