import AuthForm from '../components/Auth/AuthForm';
import { loginUser } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { connectSocket } from '../services/socket'; // ✅ Import the connectSocket function

export default function Login() {
    const navigate = useNavigate();

    const handleLogin = async (data) => {
        try {
            const { token, user } = await loginUser(data);

            const userData = { ...user, token }; // ✅ Combine user + token
            localStorage.setItem('user', JSON.stringify(userData)); // ✅ Save to localStorage
            connectSocket(); // ✅ Connect WebSocket

            console.log("✅ Login successful:", userData);

            navigate('/dashboard');
        } catch (error) {
            console.error("❌ Login error:", error);
            alert('Login failed');
        }
    };

    return (
        <>
            <h1>Login</h1>
            <AuthForm type="login" onSubmit={handleLogin} />
            <p>
                Don't have an account? <a href="/register">Register</a>
            </p>
        </>
    );
}
