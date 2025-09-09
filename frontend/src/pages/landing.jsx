import React, { useState, useEffect, useContext } from 'react'
import "../App.css"
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
export default function LandingPage() {
    const router = useNavigate();
    const { handleLogout } = useContext(AuthContext);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [showLogout, setShowLogout] = useState(false);
    
    useEffect(() => {
        const token = localStorage.getItem('token');
        const name = localStorage.getItem('name');
        if (token && name) {
            setIsLoggedIn(true);
            setUsername(name);
        }
    }, []);

    return (
        <div className='landingPageContainer'>
            <nav>
                <div className='navHeader'>
                    <h2>Metaverse</h2>
                </div>
                <div className='navlist'>
                    <p onClick={() => {
                        localStorage.setItem("token", "tester");
                        localStorage.setItem("name", "Guest");
                        router("/game");
                    }}>Join</p>
                    
                    {isLoggedIn ? (
                        <div style={{ position: 'relative' }}>
                            <p onClick={() => setShowLogout(!showLogout)}>{username}</p>
                            {showLogout && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    backgroundColor: '#17151F',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    zIndex: 10
                                }}>
                                    <p onClick={handleLogout}>Logout</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <p onClick={() => {
                                router("/auth")
                            }}>Enter the Realm</p>
                            <div onClick={() => {
                                router("/auth")
                            }} role='button'>
                                <p>Login</p>
                            </div>
                        </>
                    )}
                </div>
            </nav>


            <div className="landingMainContainer">
                <div>
                    <h1><span style={{ color: "#FF9839" }}>Connect</span> with your loved Ones</h1>

                    <p>Cover a distance by Video Call</p>
                    <div role='button'>
                        <Link to={"/game"}>Get Started</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
