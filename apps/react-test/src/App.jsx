import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Guild from './pages/Guild'
import GuildSettings from './pages/GuildSettings'
import theme from './theme'

export default function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <HashRouter>
            <Navbar />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/guilds/:id" element={
                <ProtectedRoute>
                  <Guild />
                </ProtectedRoute>
              } />
              <Route path="/guilds/:id/settings" element={
                <ProtectedRoute>
                  <GuildSettings />
                </ProtectedRoute>
              } /> 
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ChakraProvider>
    </>
  )
}
