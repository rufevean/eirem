import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL,
    withCredentials: true,
  });

// ✅ Automatically attach token from localStorage.user.token
API.interceptors.request.use((config) => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// ✅ Login user and store token + user info
export const loginUser = async (formData) => {
    const res = await API.post('/auth/login', formData);

    const token = res.data.token;
    const user = res.data.user;

    const fullUser = { ...user, token };
    localStorage.setItem('user', JSON.stringify(fullUser));
    
    return { token, user };
};

// ✅ Get list of all users
export const getUsers = async () => {
    try {
        const response = await API.get('/auth/users');
        return response.data.users;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// ✅ Send a friend request
export const sendFriendRequest = async (from_user_id, to_user_id) => {
    const res = await API.post('/auth/friend-request', {
        from_user_id,
        to_user_id
    });
    return res.data;
};

// ✅ Get pending friend requests (no need to manually add headers anymore)
export const getPendingRequests = async () => {
    const res = await API.get('/auth/friend-requests/pending');
    return res.data;
};

// ✅ Accept or reject friend request
export const respondToFriendRequest = async (requestId, action) => {
    const res = await API.post('/auth/friend-request/respond', {
        request_id: requestId,
        action
    });
    return res.data;
};

export default API;
