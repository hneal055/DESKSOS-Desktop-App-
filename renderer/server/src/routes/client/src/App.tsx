import './App.css'

const App = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 p-6 border-b border-gray-700">
        <h1 className="text-4xl font-bold text-blue-400">DeskSOS Enterprise</h1>
        <p className="text-gray-400 mt-2">Production Ready - Docker Deployment</p>
      </header>
      
      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Production Deployment</h2>
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              <span>✓ React Frontend Container</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              <span>✓ Node Backend Container</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
              <span>✓ PostgreSQL Database</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
              <span>✓ Redis Cache</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
              <span>✓ Nginx Reverse Proxy with SSL</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
