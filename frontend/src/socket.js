import { io } from 'socket.io-client'

export function createSocket() {
  // Cookies include the JWT for auth
  const socket = io('/', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket'],
  })
  return socket
}


