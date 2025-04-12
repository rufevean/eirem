import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from '../Chat/Chatwindow';

const DashboardLayout = () => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="flex h-screen">
      <Sidebar onUserSelect={setSelectedUser} />
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedUser ? (
          <ChatWindow selectedUser={selectedUser} />
        ) : (
          <div>
            <h1 className="text-2xl font-bold mb-4">Welcome to Eirem 🎥</h1>
            <p>Select a friend to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;
