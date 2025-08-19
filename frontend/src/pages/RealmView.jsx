import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Application, Graphics, Container, Text } from 'pixi.js'
import { apiFetch } from '../api'
import { createSocket } from '../socket'
import { useAuth } from '../context/AuthContext'
import { createMediaStream, createPeer } from '../webrtc'

const TILE_SIZE = 32
const MIN_ROWS = 12
const MIN_COLS = 20
const PROXIMITY_THRESHOLD = 3 // Increased threshold for better proximity experience
const VIDEO_W = 160
const VIDEO_H = 120

export default function RealmView() {
  const { id } = useParams()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const appRef = useRef(null)
  const [realm, setRealm] = useState(null)
  const socketRef = useRef(null)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const presenceRef = useRef(new Map())
  const myPosRef = useRef({ x: 0, y: 0 })
  const colorRef = useRef(new Map()) // userId -> color
  const nameRef = useRef(new Map()) // userId -> name
  const peersRef = useRef(new Map()) // userId -> Peer
  const mediaRef = useRef({ stream: null })
  const videoWrapRef = useRef(null)
  const localVideoRef = useRef(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicEnabled, setIsMicEnabled] = useState(true)

  const palette = [
    0xEF4444, // red
    0xF59E0B, // amber
    0x10B981, // emerald
    0x06B6D4, // cyan
    0x3B82F6, // blue
    0x8B5CF6, // violet
    0xEC4899, // pink
    0x84CC16, // lime
    0xF97316, // orange
  ]

  function colorFor(userId) {
    if (colorRef.current.has(userId)) return colorRef.current.get(userId)
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % palette.length
    const color = palette[idx]
    colorRef.current.set(userId, color)
    return color
  }

  useEffect(() => {
    let destroyed = false
    ;(async () => {
      const data = await apiFetch(`/api/realms/${id}`)
      if (destroyed) return
      setRealm(data)
    })()
    return () => {
      destroyed = true
    }
  }, [id])

  useEffect(() => {
    if (!realm) return
    let app
    let canvas
    let avatarsLayer
    let labelsLayer

    const init = async () => {
      const rows = Math.max(MIN_ROWS, realm.mapData.length)
      const cols = Math.max(MIN_COLS, realm.mapData[0].length)
      app = new Application()
      await app.init({ width: cols * TILE_SIZE, height: rows * TILE_SIZE, background: '#f9fafb' })
      appRef.current = app
      canvas = app.canvas
      if (canvasRef.current) canvasRef.current.appendChild(canvas)

      const grid = new Graphics()
      // draw grid using rect + stroke (Pixi v8 API)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          grid.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).stroke({ width: 1, color: 0xE5E7EB, alpha: 1 })
        }
      }
      app.stage.addChild(grid)

      avatarsLayer = new Graphics()
      labelsLayer = new Container()
      app.stage.addChild(avatarsLayer)
      app.stage.addChild(labelsLayer)

      function drawAvatars() {
        avatarsLayer.clear()
        labelsLayer.removeChildren()
        for (const [userId, pos] of presenceRef.current.entries()) {
          const color = userId === 'me' ? 0x2563EB : colorFor(userId)
          avatarsLayer.rect(pos.x * TILE_SIZE + 4, pos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8).fill(color)
          const name = userId === 'me' ? (user?.name || user?.email || 'Me') : (nameRef.current.get(userId) || 'User')
          const label = new Text({ text: name, style: { fontFamily: 'Arial', fontSize: 11, fill: 0x111827 } })
          label.x = pos.x * TILE_SIZE + 4
          label.y = pos.y * TILE_SIZE - 14
          labelsLayer.addChild(label)
        }
      }

      function ensurePeerWith(otherId) {
        if (peersRef.current.has(otherId)) return
        if (!mediaRef.current.stream || !socketRef.current) return
        const peer = createPeer(
          true,
          mediaRef.current.stream,
          (data) => socketRef.current?.emit('webrtc:signal', { realmId: id, toUserId: otherId, data }),
          (remoteStream) => addRemoteVideo(otherId, remoteStream),
          () => removeRemoteVideo(otherId)
        )
        peersRef.current.set(otherId, peer)
      }

      function teardownPeer(otherId) {
        const existing = peersRef.current.get(otherId)
        if (existing) {
          try { existing.destroy() } catch {}
          peersRef.current.delete(otherId)
        }
        removeRemoteVideo(otherId)
      }

      function recalcProximity() {
        for (const [otherId, pos] of presenceRef.current.entries()) {
          if (otherId === 'me') continue
          const dx = Math.abs(pos.x - myPosRef.current.x)
          const dy = Math.abs(pos.y - myPosRef.current.y)
          const distance = Math.sqrt(dx * dx + dy * dy)
          const isNear = distance <= PROXIMITY_THRESHOLD
          
          if (isNear) {
            ensurePeerWith(otherId)
            // Update video visibility and audio volume for existing peers
            updateRemoteVideoPosition(otherId)
          } else {
            teardownPeer(otherId)
          }
        }
      }

      // pick a random starting tile so users don't overlap at (0,0)
      myPosRef.current = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      }
      presenceRef.current.set('me', myPosRef.current)
      drawAvatars()

      const onKey = (e) => {
        const delta = { x: 0, y: 0 }
        if (e.key === 'ArrowUp') delta.y = -1
        else if (e.key === 'ArrowDown') delta.y = 1
        else if (e.key === 'ArrowLeft') delta.x = -1
        else if (e.key === 'ArrowRight') delta.x = 1
        else return
        e.preventDefault()
        const next = { x: Math.max(0, Math.min(cols - 1, myPosRef.current.x + delta.x)), y: Math.max(0, Math.min(rows - 1, myPosRef.current.y + delta.y)) }
        myPosRef.current = next
        presenceRef.current.set('me', next)
        drawAvatars()
        if (socketRef.current) socketRef.current.emit('move', { realmId: id, x: next.x, y: next.y })
        recalcProximity()
      }
      window.addEventListener('keydown', onKey)

      const s = createSocket()
      socketRef.current = s
      s.on('connect', () => {
        s.emit('joinRealm', { realmId: id, position: myPosRef.current })
      })
      s.on('presenceSnapshot', (snapshot) => {
        const map = new Map()
        for (const entry of snapshot) {
          if (user && entry.userId === user.id) continue
          map.set(entry.userId, entry.position)
          if (entry.name) nameRef.current.set(entry.userId, entry.name)
        }
        presenceRef.current = map
        presenceRef.current.set('me', myPosRef.current)
        drawAvatars()
        recalcProximity()
        // position videos by latest positions
        for (const otherId of peersRef.current.keys()) updateRemoteVideoPosition(otherId)
      })
      s.on('presence', (snapshot) => {
        const map = new Map()
        for (const entry of snapshot) {
          if (user && entry.userId === user.id) continue
          map.set(entry.userId, entry.position)
          if (entry.name) nameRef.current.set(entry.userId, entry.name)
        }
        presenceRef.current = map
        presenceRef.current.set('me', myPosRef.current)
        drawAvatars()
        recalcProximity()
        for (const otherId of peersRef.current.keys()) updateRemoteVideoPosition(otherId)
      })
      s.on('userJoined', ({ userId, position, name }) => {
        if (user && userId === user.id) return
        if (name) nameRef.current.set(userId, name)
        presenceRef.current.set(userId, position)
        drawAvatars()
        recalcProximity()
        updateRemoteVideoPosition(userId)
      })
      s.on('userMoved', ({ userId, position, name }) => {
        if (user && userId === user.id) return
        if (name) nameRef.current.set(userId, name)
        presenceRef.current.set(userId, position)
        drawAvatars()
        recalcProximity()
        updateRemoteVideoPosition(userId)
      })
      s.on('userLeft', ({ userId }) => {
        if (user && userId === user.id) return
        presenceRef.current.delete(userId)
        drawAvatars()
        teardownPeer(userId)
      })
      s.on('chat', (msg) => {
        setMessages((prev) => [...prev, msg])
      })

      // WebRTC signaling: receive
      s.on('webrtc:signal', ({ fromUserId, data }) => {
        let peer = peersRef.current.get(fromUserId)
        if (!peer && mediaRef.current.stream) {
          peer = createPeer(
            false,
            mediaRef.current.stream,
            (out) => socketRef.current?.emit('webrtc:signal', { realmId: id, toUserId: fromUserId, data: out }),
            (remoteStream) => addRemoteVideo(fromUserId, remoteStream),
            () => removeRemoteVideo(fromUserId)
          )
          peersRef.current.set(fromUserId, peer)
        }
        try { peer && peer.signal(data) } catch {}
      })

      const history = await apiFetch(`/api/realms/${id}/messages?limit=50`)
      setMessages(history)

      // Media setup (ask once on realm load)
      try {
        const stream = await createMediaStream({ audio: isMicEnabled, video: isCameraEnabled })
        mediaRef.current.stream = stream
        // Add local preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing media devices:', error)
      }

      // store handler for cleanup
      return () => {
        window.removeEventListener('keydown', onKey)
        // Clean up media stream
        if (mediaRef.current.stream) {
          mediaRef.current.stream.getTracks().forEach(track => track.stop())
        }
      }
    }

    let removeKeyHandler
    init().then((cleanup) => (removeKeyHandler = cleanup)).catch(() => {})

    return () => {
      if (removeKeyHandler) removeKeyHandler()
      if (socketRef.current) {
        try { socketRef.current.emit('leaveRealm', { realmId: id }) } catch {}
        try { socketRef.current.close() } catch {}
        socketRef.current = null
      }
      // close peers
      for (const [, peer] of peersRef.current.entries()) {
        try { peer.destroy() } catch {}
      }
      peersRef.current.clear()

      // stop local media
      if (mediaRef.current.stream) {
        for (const track of mediaRef.current.stream.getTracks()) {
          try { track.stop() } catch {}
        }
        mediaRef.current.stream = null
      }
      if (appRef.current) {
        try { appRef.current.destroy(true) } catch {}
        appRef.current = null
      }
      if (canvasRef.current && canvas && canvas.parentNode === canvasRef.current) {
        try { canvasRef.current.removeChild(canvas) } catch {}
      }
    }
  }, [realm, id])

  function sendChat(e) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text || !socketRef.current) return
    socketRef.current.emit('chat', { realmId: id, content: text })
    setChatInput('')
  }

  function addRemoteVideo(userId, stream) {
    if (!videoWrapRef.current) return
    let container = document.getElementById(`vid-${userId}`)
    if (!container) {
      // Create container for video and username label
      const videoContainer = document.createElement('div')
      videoContainer.id = `vid-container-${userId}`
      videoContainer.style.position = 'absolute'
      videoContainer.style.pointerEvents = 'none'
      videoContainer.style.display = 'flex'
      videoContainer.style.flexDirection = 'column'
      videoContainer.style.alignItems = 'center'
      
      // Create video element
      container = document.createElement('video')
      container.id = `vid-${userId}`
      container.autoplay = true
      container.playsInline = true
      container.width = VIDEO_W
      container.height = VIDEO_H
      container.style.borderRadius = '8px'
      container.style.border = '2px solid white'
      container.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
      
      // Create username label
      const label = document.createElement('div')
      label.id = `vid-label-${userId}`
      label.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
      label.style.color = 'white'
      label.style.padding = '2px 8px'
      label.style.borderRadius = '4px'
      label.style.marginTop = '4px'
      label.style.fontSize = '12px'
      label.textContent = nameRef.current.get(userId) || 'User'
      
      videoContainer.appendChild(container)
      videoContainer.appendChild(label)
      videoWrapRef.current.appendChild(videoContainer)
    }
    container.srcObject = stream
    updateRemoteVideoPosition(userId)
  }

  function removeRemoteVideo(userId) {
    const container = document.getElementById(`vid-container-${userId}`)
    if (container && container.parentNode) {
      // Clean up audio context if it exists
      const video = document.getElementById(`vid-${userId}`)
      if (video && video.audioContext) {
        try {
          video.audioContext.close()
          video.audioContext = null
          video.gainNode = null
        } catch (e) {
          console.error('Error closing audio context:', e)
        }
      }
      container.parentNode.removeChild(container)
    }
  }

  function updateRemoteVideoPosition(userId) {
    const container = document.getElementById(`vid-container-${userId}`)
    if (!container) return
    const pos = presenceRef.current.get(userId)
    if (!pos) return
    
    // Update position of video container
    container.style.left = `${pos.x * TILE_SIZE + 8}px`
    container.style.top = `${pos.y * TILE_SIZE - (VIDEO_H + 30)}px`
    
    // Update username in label
    const label = document.getElementById(`vid-label-${userId}`)
    if (label) {
      label.textContent = nameRef.current.get(userId) || 'User'
    }
    
    // Update video visibility and audio volume based on proximity
      const video = document.getElementById(`vid-${userId}`)
      if (video && video.srcObject) {
        const dx = Math.abs(pos.x - myPosRef.current.x)
        const dy = Math.abs(pos.y - myPosRef.current.y)
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Show/hide video based on proximity
        if (distance <= PROXIMITY_THRESHOLD) {
          container.style.display = 'flex'
          
          // Adjust audio volume based on distance
          // Volume decreases linearly with distance
          // At distance 0, volume is 1 (100%)
          // At PROXIMITY_THRESHOLD, volume is 0.2 (20%)
          const audioTracks = video.srcObject.getAudioTracks()
          if (audioTracks.length > 0) {
            const volume = Math.max(0.2, 1 - (distance / PROXIMITY_THRESHOLD) * 0.8)
            // We can't directly set volume on MediaStreamTrack
            // Instead, we need to use a GainNode from the Web Audio API
            if (!video.audioContext) {
              // Set up audio context and connections if not already done
              const audioContext = new (window.AudioContext || window.webkitAudioContext)()
              const source = audioContext.createMediaStreamSource(video.srcObject)
              const gainNode = audioContext.createGain()
              source.connect(gainNode)
              gainNode.connect(audioContext.destination)
              
              // Store references for future updates
              video.audioContext = audioContext
              video.gainNode = gainNode
            }
            
            // Update the gain (volume)
            if (video.gainNode) {
              video.gainNode.gain.value = volume
            }
          }
        } else {
          container.style.display = 'none'
          
          // If we have an audio context, disconnect it when out of range
          if (video.audioContext) {
            try {
              video.audioContext.close()
              video.audioContext = null
              video.gainNode = null
            } catch (e) {
              console.error('Error closing audio context:', e)
            }
          }
        }
      }
  }

  // Toggle camera on/off
  async function toggleCamera() {
    const newState = !isCameraEnabled
    setIsCameraEnabled(newState)
    
    if (mediaRef.current.stream) {
      // Stop all video tracks
      mediaRef.current.stream.getVideoTracks().forEach(track => {
        track.enabled = newState
      })
      
      // If we're turning camera back on and there are no enabled video tracks, recreate the stream
      if (newState && mediaRef.current.stream.getVideoTracks().length === 0) {
        try {
          const newStream = await createMediaStream({ audio: isMicEnabled, video: true })
          
          // Replace the old stream with the new one
          mediaRef.current.stream = newStream
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream
          }
          
          // Update all peers with the new stream
          for (const [peerId, peer] of peersRef.current.entries()) {
            try {
              // Replace the stream in the peer connection
              newStream.getTracks().forEach(track => {
                peer.replaceTrack(
                  peer._senderMap.get(track.kind).track,
                  track,
                  mediaRef.current.stream
                )
              })
            } catch (err) {
              console.error('Error replacing track for peer', peerId, err)
            }
          }
        } catch (error) {
          console.error('Error recreating media stream:', error)
        }
      }
    }
  }

  // Toggle microphone on/off
  async function toggleMicrophone() {
    const newState = !isMicEnabled
    setIsMicEnabled(newState)
    
    if (mediaRef.current.stream) {
      // Toggle all audio tracks
      mediaRef.current.stream.getAudioTracks().forEach(track => {
        track.enabled = newState
      })
      
      // If we're turning mic back on and there are no enabled audio tracks, recreate the stream
      if (newState && mediaRef.current.stream.getAudioTracks().length === 0) {
        try {
          const newStream = await createMediaStream({ audio: true, video: isCameraEnabled })
          
          // Replace the old stream with the new one
          mediaRef.current.stream = newStream
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream
          }
          
          // Update all peers with the new stream
          for (const [peerId, peer] of peersRef.current.entries()) {
            try {
              // Replace the stream in the peer connection
              newStream.getTracks().forEach(track => {
                peer.replaceTrack(
                  peer._senderMap.get(track.kind).track,
                  track,
                  mediaRef.current.stream
                )
              })
            } catch (err) {
              console.error('Error replacing track for peer', peerId, err)
            }
          }
        } catch (error) {
          console.error('Error recreating media stream:', error)
        }
      }
    }
  }

  if (!realm) return <div className="p-6">Loading realm...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{realm.name}</h2>
          <Link className="text-blue-600" to="/realms">Back</Link>
        </div>
        <div className="w-full overflow-auto">
          <div className="relative inline-block">
            <div ref={canvasRef} className="bg-white shadow rounded p-2" />
            <div ref={videoWrapRef} className="absolute inset-0 pointer-events-none" />
          </div>
        </div>
        <div className="mt-4">
          <div className="h-56 overflow-y-auto bg-white border rounded p-2 space-y-1">
            {messages.map((m) => (
              <div key={m.id} className="text-sm"><span className="text-gray-500">{m.senderId.slice(-4)}:</span> {m.content}</div>
            ))}
          </div>
          <form onSubmit={sendChat} className="mt-2 flex gap-2">
            <input className="border rounded px-2 py-2 flex-1" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type message" />
            <button className="bg-blue-600 text-white px-4 rounded">Send</button>
          </form>
          
          {/* Local video preview with controls */}
          <div className="mt-4 relative">
            <div className="bg-gray-800 rounded overflow-hidden shadow-lg w-48 h-36">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover ${!isCameraEnabled ? 'hidden' : ''}`}
              />
              {!isCameraEnabled && (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              You
            </div>
            
            {/* Camera and Mic Controls */}
            <div className="absolute bottom-2 right-2 flex space-x-2">
              <button 
                onClick={() => toggleCamera()}
                className={`p-2 rounded-full ${isCameraEnabled ? 'bg-blue-500' : 'bg-red-500'}`}
                title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button 
                onClick={() => toggleMicrophone()}
                className={`p-2 rounded-full ${isMicEnabled ? 'bg-blue-500' : 'bg-red-500'}`}
                title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


