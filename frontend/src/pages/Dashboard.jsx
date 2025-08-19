import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome, {user?.name || user?.email}</h1>
          <div className="flex items-center gap-2">
            <Link to="/realms" className="bg-blue-600 text-white px-3 py-1 rounded">Go to Realms</Link>
            <button onClick={logout} className="bg-gray-200 px-3 py-1 rounded">Logout</button>
          </div>
        </div>
        <div className="mt-6 bg-white shadow rounded p-6">
          <p className="text-gray-700">This is a protected dashboard.</p>
        </div>
      </div>
    </div>
  )
}


