import AuthForm from "../components/Auth/AuthForm";
import API from "../services/api";
import { useNavigate } from "react-router-dom";


export default function Register() {
    const navigate = useNavigate();

    const handleRegister = async (data) => {
        try {
            const response = await API.post("/auth/register", data);
            if (response.data.success) {
                localStorage.setItem("token", response.data.token);
                navigate("/dashboard");
            } else {
                alert("Registration failed");
            }
        } catch (error) {
            console.error(error);
            alert("Registration failed");
        }
    }
    return (
        <>
            <h1>
                Register
            </h1>
            <AuthForm type="register" onSubmit={handleRegister} />
            <p>
                Already have an account? <a href="/login">Login</a>
            </p>
        </>
    );
}