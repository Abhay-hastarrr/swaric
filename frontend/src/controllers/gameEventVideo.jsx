import { useState, useEffect } from "react";
import "../styles/gameEventVideo.css";
import { useNavigate } from "react-router-dom";

function GameEventVideo({ data }) {
    let { socketRef, localVideoref2, remoteVideoref2 } = data;
    let [show, setShow] = useState(false);
    const router = useNavigate();

    useEffect(() => {
        const handleVideoOn = () => setShow(true);
        const handleVideoOff = () => {
            setShow(false);
            localVideoref2 = null;
            remoteVideoref2 = null;
        };

        try {
            socketRef.current.on('video-event-on', handleVideoOn);
            socketRef.current.on('video-event-off', handleVideoOff);
        } catch {
            router('/game');
        }

        return () => {
            try {
                socketRef.current.off('video-event-on', handleVideoOn);
                socketRef.current.off('video-event-off', handleVideoOff);
            } catch {}
        };
    }, [socketRef, router, localVideoref2, remoteVideoref2]);

   const handleEndCall = () => {
    // Emit event to notify other users (optional)
    if (socketRef.current) {
        socketRef.current.emit('video-event-off');
    }

    // Refresh the page
    window.location.href = '/';
    // or window.location.reload();  // reloads current page
};


    return (
        <>
            {show && (
                <div className='event-videos-container'>
                    <div className='event-videos'>
                        <video ref={localVideoref2} autoPlay playsInline></video>
                        <video ref={remoteVideoref2} autoPlay playsInline></video>
                    </div>
                </div>
            )}

            {/* Floating End Call Button always rendered */}
            <button
                onClick={handleEndCall}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: 'red',
                    color: 'white',
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: '50px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    zIndex: 9999, // ensure it's on top
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                }}
            >
                End Call
            </button>
        </>
    );
}

export default GameEventVideo;
