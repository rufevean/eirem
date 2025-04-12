import { useState } from 'react';

export default function AuthForm({type, onSubmit}) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return(
        <form onSubmit={handleSubmit} className="auth-form">
            {type === 'register' && (
                <input
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={formData.name}
                    onChange={handleChange}
                />
            )}
            <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
            />
            <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange} 
            />
            <button type="submit">
                {type === 'register' ? 'Register' : 'Login'}
            </button> 
            </form>
            
    );

}