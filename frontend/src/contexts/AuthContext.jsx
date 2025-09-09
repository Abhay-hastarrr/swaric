import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

// Using environment variable directly instead of importing from environment.js
const server = import.meta.env.VITE_API_URL || "http://localhost:8000";



export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 10000 // Add timeout to detect connection issues
})


export const AuthProvider = ({ children }) => {

    const authContext = useContext(AuthContext);


    const [userData, setUserData] = useState(authContext);


    const router = useNavigate();

    const handleRegister = async (name, username, password, email) => {
        try {
            let request = await client.post("/register", {
                name: name,
                username: username,
                password: password,
                email: email || null // Include email if provided, otherwise null
            })


            if (request.status === httpStatus.CREATED) {
                // After successful registration, automatically log the user in
                try {
                    let loginRequest = await client.post("/login", {
                        username: username,
                        password: password
                    });
                    
                    if (loginRequest.status === httpStatus.OK) {
                        localStorage.setItem("token", loginRequest.data.token);
                        localStorage.setItem("name", loginRequest.data.name);
                        router("/"); // Redirect to homepage
                        return "Registration successful! Redirecting...";
                    }
                } catch (loginErr) {
                    console.error('Auto-login after registration failed:', loginErr);
                    // If auto-login fails, still return success message for registration
                    return request.data.message;
                }
                return request.data.message;
            }
        } catch (err) {
            throw err;
        }
    }

    const handleLogin = async (username, password) => {
        try {
            console.log('Making login request to:', `${server}/api/v1/users/login`);
            let request = await client.post("/login", {
                username: username,
                password: password
            });

            console.log('Login response:', request);
            console.log('Login data:', request.data);

            if (request.status === httpStatus.OK) {
                localStorage.setItem("token", request.data.token);
                localStorage.setItem("name", request.data.name);
                router("/") // Redirect to homepage
            }
        } catch (err) {
            console.error('Login error details:', err);
            console.error('Error response:', err.response?.data);
            console.error('Error request:', err.request);
            console.error('Error config:', err.config);
            throw err;
        }
    }


    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("name");
        router("/landing");
    }

    const data = {
        userData, setUserData, handleRegister, handleLogin, handleLogout
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )

}
