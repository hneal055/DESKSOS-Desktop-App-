import { useState } from 'react'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'chat'>('dashboard')

  return (
    <div className="min-h-screen bg-gray-900">
      <h1 className="text-3xl font-bold text-blue-400">DeskSOS Enterprise</h1>
      <p className="text-gray-300 mt-4">React Frontend Connected</p>
      <p className="text-sm text-gray-500 mt-8">API: http://localhost:5000</p>
    </div>
  )
}
