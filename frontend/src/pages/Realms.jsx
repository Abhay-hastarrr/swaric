import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Realms() {
  const [realms, setRealms] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/api/realms')
      setRealms(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const realm = await apiFetch('/api/realms', { method: 'POST', body: { name } })
      navigate(`/realms/${realm.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Your Realms</h1>
        <form onSubmit={onCreate} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Realm name" className="border rounded px-3 py-2 flex-1" />
          <button disabled={creating} className="bg-blue-600 text-white px-4 py-2 rounded">{creating ? 'Creating...' : 'Create'}</button>
        </form>
        {loading ? (
          <div>Loading...</div>
        ) : realms.length === 0 ? (
          <div className="text-gray-600">No realms yet. Create one above.</div>
        ) : (
          <ul className="space-y-2">
            {realms.map((r) => (
              <li key={r.id} className="flex items-center justify-between bg-white border rounded px-4 py-2">
                <div>{r.name}</div>
                <Link className="text-blue-600" to={`/realms/${r.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


