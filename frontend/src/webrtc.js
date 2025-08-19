import Peer from 'simple-peer/simplepeer.min.js'

export function createMediaStream({ audio = true, video = true } = {}) {
  return navigator.mediaDevices.getUserMedia({ audio, video })
}

export function createPeer(isInitiator, stream, onSignal, onStream, onClose) {
  const peer = new Peer({ initiator: isInitiator, trickle: true, stream })
  peer.on('signal', (data) => onSignal?.(data))
  peer.on('stream', (remoteStream) => onStream?.(remoteStream))
  peer.on('close', () => onClose?.())
  peer.on('error', () => onClose?.())
  return peer
}


