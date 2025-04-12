import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socket.js';
import API from '../../services/api';

const ChatWindow = ({ selectedUser }) => {
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const handleSend = () => {
    console.log("🔹 handleSend triggered");
    
    if (newMessage.trim() === '') return;
    
    const socket = getSocket();
    console.log("🔸 socket:", socket);
    
    if (!socket) {
      console.error("No socket connection available");
      return;
    }
    
    if (!selectedUser?.id || !storedUser?.id) {
      console.error("Missing user information");
      return;
    }
  
    const messageObj = {
      from: String(storedUser.id), // Ensure IDs are strings
      to: String(selectedUser.id),
      text: newMessage,
    };
  
    console.log("Sending message:", messageObj);
    
    socket.emit('private_message', messageObj, (response) => {
      if (response?.error) {
        console.error("Error sending message:", response.error);
        return;
      }
      setMessages((prev) => [...prev, { from: 'me', text: newMessage }]);
      setNewMessage('');
    });
  };
  

  useEffect(() => {
    // Load chat history when user is selected
    const loadChatHistory = async () => {
      if (!selectedUser?.id) return;
      
      try {
        const response = await API.get(`/auth/messages/${selectedUser.id}`);
        if (response.data.success) {
          setMessages(response.data.messages);
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };

    loadChatHistory();
    // Setup socket listeners
    const sock = getSocket();
  
    if (!sock) {
      console.error("No socket connection available");
      return;
    }

    const handleIncoming = (msg) => {
      console.log("Received message:", msg); // Add logging
      // Convert IDs to strings for comparison
      if (String(msg.from) === String(selectedUser?.id)) {
        setMessages((prev) => [...prev, { from: 'them', text: msg.text }]);
      }
    };

    sock.on('private_message', handleIncoming);
    sock.on('error', (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      sock.off('private_message', handleIncoming);
      sock.off('error');
    };
  }, [selectedUser, storedUser]);
  

  return (
    <div className="flex flex-col flex-1 p-4 bg-white rounded shadow h-full">
      <h2 className="text-xl font-semibold mb-4 border-b pb-2">
        Chat with {selectedUser?.name || 'Select a friend'}
      </h2>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 rounded max-w-xs ${
              msg.from === 'me' ? 'bg-blue-200 self-end' : 'bg-gray-200 self-start'
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border p-2 rounded"
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
