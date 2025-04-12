import React, { useEffect, useState } from 'react';
import { getUsers, sendFriendRequest } from '../../services/api';
import PendingRequests from '../PendingRequests';
const Sidebar = ({ onUserSelect }) => {
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState("");

    const storedUser = JSON.parse(localStorage.getItem('user'));


    useEffect(() => {
        const fetchUsers = async () => {
            const data = await getUsers();
            setUsers(data);
        };
        fetchUsers();
    }, []);

    const handleAddFriend = async (toUserId) => {
        const fromUserId = storedUser?.id;

        if (!fromUserId) {
            alert("You must be logged in.");
            return;
        }

        try {
            const response = await sendFriendRequest(fromUserId, toUserId);
            setMessage(response.message);
        } catch (err) {
            setMessage(err?.response?.data?.message || "Error sending friend request.");
        }

        setTimeout(() => setMessage(""), 3000); // Clear message after 3s
    };

    return (
        <div className="w-64 bg-gray-100 h-screen overflow-y-auto p-4 border-r">
            <PendingRequests />
            <h2 className="text-lg font-semibold mb-4">Available Users</h2>

            {message && (
                <div className="bg-blue-100 text-blue-800 text-sm px-3 py-2 rounded mb-3">
                    {message}
                </div>
            )}

            {users.map((user) => {
                const isFriend = user.isFriend;

                return (
                    <div
                        key={user.id}
                        className="p-2 mb-2 bg-white rounded shadow-sm flex justify-between items-center"
                    >
                        <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="text-sm text-blue-500 hover:underline"
                                onClick={() => onUserSelect(user)} // selects user
                            >
                                Chat
                            </button>

                            {!isFriend && (
                                <button
                                    className="text-sm text-green-500 hover:underline"
                                    onClick={() => handleAddFriend(user.id)}
                                >
                                    Add
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Sidebar;
