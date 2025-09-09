import React, { useEffect } from 'react';
import '../styles/LandingPage.css';
import { Link, useNavigate } from 'react-router-dom';
import anime from 'animejs';

export default function Landing() {
    const router = useNavigate();

    useEffect(() => {
        // Navigation animation
        anime({
            targets: '.nav-header',
            translateY: [-50, 0],
            opacity: [0, 1],
            duration: 800,
            easing: 'easeOutExpo',
            delay: 500 // increased by 500ms
        });

        anime({
            targets: '.nav-list p, .nav-list div',
            translateY: [-30, 0],
            opacity: [0, 1],
            duration: 600,
            delay: anime.stagger(100, { start: 700 }), // original + 500ms
            easing: 'easeOutExpo'
        });

        // Hero content animation
        anime({
            targets: '.hero-title',
            translateY: [100, 0],
            opacity: [0, 1],
            duration: 1000,
            delay: 900, // original 400 + 500
            easing: 'easeOutExpo'
        });

        anime({
            targets: '.hero-subtitle',
            translateY: [50, 0],
            opacity: [0, 1],
            duration: 800,
            delay: 1100, // original 600 + 500
            easing: 'easeOutExpo'
        });

        anime({
            targets: '.cta-button',
            scale: [0.8, 1],
            opacity: [0, 1],
            duration: 600,
            delay: 1300, // original 800 + 500
            easing: 'easeOutElastic(1, .8)'
        });

        // Background particles animation
        anime({
            targets: '.particle',
            translateY: [
                { value: -20, duration: 2000 },
                { value: 20, duration: 2000 }
            ],
            translateX: [
                { value: 10, duration: 1500 },
                { value: -10, duration: 1500 }
            ],
            opacity: [
                { value: 0.3, duration: 1000 },
                { value: 0.8, duration: 1000 },
                { value: 0.3, duration: 1000 }
            ],
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutSine',
            delay: anime.stagger(700) // increased by 500ms
        });

        // Floating animation for decorative elements
        anime({
            targets: '.floating-element',
            translateY: [
                { value: -15, duration: 3000 },
                { value: 15, duration: 3000 }
            ],
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutSine',
            delay: anime.stagger(1000) // increased by 500ms
        });
    }, []);

    const handleGuestJoin = () => {
        anime({
            targets: '.nav-list p:first-child',
            scale: [1, 0.95, 1],
            duration: 200,
            complete: () => {
                localStorage.setItem("token", "tester");
                localStorage.setItem("name", "Guest");
                router("/game");
            }
        });
    };

    const handleNavClick = (target, path) => {
        anime({
            targets: target,
            scale: [1, 0.95, 1],
            duration: 200,
            complete: () => router(path)
        });
    };

    return (
        <div className="landing-page-container">
            <div className="particles-container">
                {[...Array(15)].map((_, i) => (
                    <div key={i} className="particle" style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 3}s`
                    }}></div>
                ))}
            </div>

            <div className="floating-element floating-element-1"></div>
            <div className="floating-element floating-element-2"></div>
            <div className="floating-element floating-element-3"></div>

            <nav className="navigation">
                <div className="nav-header">
                    <h2 className="logo">
                        <span className="logo-meta">Swaric</span>
                    </h2>
                </div>
                <div className="nav-list">
                    <p className="nav-item guest-btn" onClick={handleGuestJoin}>
                        Join as Guest
                    </p>
                    <p className="nav-item" onClick={(e) => handleNavClick(e.target, "/auth")}>
                        Register
                    </p>
                    <div className="nav-item login-btn" 
                         onClick={(e) => handleNavClick(e.currentTarget, "/auth")} 
                         role="button">
                        <p>Login</p>
                    </div>
                </div>
            </nav>

            <div className="hero-container">
                <div className="hero-content">
                    <h1 className="hero-title">
                        <span className="highlight">Connect</span> with your
                        <br />
                        <span className="gradient-text">loved ones</span>
                    </h1>
                    
                    <p className="hero-subtitle">
                        Bridge distances through immersive video experiences
                    </p>
                    
                    <div className="cta-button" role="button">
                        <Link to="/game" className="cta-link">
                            Get Started
                            <svg className="arrow-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M4.16667 10H15.8333M15.8333 10L10 4.16667M15.8333 10L10 15.8333" 
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
