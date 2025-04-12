import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../services/socket.js';
import webRTCService from '../../services/webrtc.js';
import API from '../../services/api';

const ChatWindow = ({ selectedUser }) => {
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isStreamAccepted, setIsStreamAccepted] = useState(false);
  const screenVideoRef = useRef(null);
  useEffect(() => {
    webRTCService.onRemoteStreamAvailable = (stream) => {
        console.log('Remote stream received in ChatWindow');
        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
            screenVideoRef.current.muted = true; // Prevent audio feedback
            screenVideoRef.current.play().catch(err => {
                console.error('Error playing video:', err);
            });
            setIsStreamAccepted(true);
        }
    };
    
    return () => {
        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
        }
        webRTCService.cleanup();
    };
}, []);
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

  const handleScreenShare = async () => {
    try {
        if (!webRTCService) {
            throw new Error('WebRTC service not available');
        }

        if (!selectedUser?.id) {
            throw new Error('No user selected');
        }

        if (!isScreenSharing) {
            const screenStream = await webRTCService.startScreenShare(selectedUser.id);
            if (!screenVideoRef.current) {
                throw new Error('Video element not found');
            }
            screenVideoRef.current.srcObject = screenStream;
            setIsScreenSharing(true);
        } else {
            await webRTCService.stopScreenShare(selectedUser.id);
            if (screenVideoRef.current) {
                screenVideoRef.current.srcObject = null;
            }
            setIsScreenSharing(false);
        }
    } catch (error) {
        console.error('Screen sharing error:', error);
        setIsScreenSharing(false);
        // Show error to user
        alert(`Screen sharing failed: ${error.message}`);
    }
};

  const handleAcceptStream = () => {
    if (webRTCService.remoteStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = webRTCService.remoteStream;
      setIsStreamAccepted(true);
    } else {
      console.error('Remote stream or video element is missing.');
    }
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

    sock.on('screen-sharing-started', () => {
      console.log('Receiver: Screen sharing started');
      setIsStreamAccepted(false); // Reset accept button state on new share
    });

    sock.on('screen-sharing-stopped', () => {
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }
      setIsStreamAccepted(false);
    });

    sock.on('screen-share-offer', async (data) => {
      console.log('Received screen share offer:', data);
      await webRTCService.handleIncomingOffer(data.offer, selectedUser.id);
    });

    sock.on('screen-share-answer', async (data) => {
      console.log('Received screen share answer:', data);
      await webRTCService.handleAnswer(data.answer);
    });

    sock.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate:', data);
      await webRTCService.handleIceCandidate(data.candidate);
    });

    return () => {
      sock.off('private_message', handleIncoming);
      sock.off('error');
      sock.off('screen-sharing-started');
      sock.off('screen-sharing-stopped');
      sock.off('screen-share-offer');
      sock.off('screen-share-answer');
      sock.off('ice-candidate');
    };
  }, [selectedUser, storedUser]);

  useEffect(() => {
    // Ensure WebRTC service is imported and available
    if (!webRTCService) {
        console.error('WebRTC service not initialized');
        return;
    }

    const sock = getSocket();
    if (!sock) {
        console.error('Socket not connected');
        return;
    }

    // Socket event handlers with error boundaries
    const socketHandlers = {
        'screen-share-offer': async (data) => {
            try {
                console.log('Received screen share offer:', data);
                if (!data?.offer || !selectedUser?.id) {
                    throw new Error('Invalid offer data or user ID');
                }
                await webRTCService.handleIncomingOffer(data.offer, selectedUser.id);
            } catch (error) {
                console.error('Error handling screen share offer:', error);
            }
        },
        'screen-share-answer': async (data) => {
            try {
                console.log('Received screen share answer:', data);
                if (!data?.answer) {
                    throw new Error('Invalid answer data');
                }
                await webRTCService.handleAnswer(data.answer);
            } catch (error) {
                console.error('Error handling screen share answer:', error);
            }
        },
        'ice-candidate': async (data) => {
            try {
                console.log('Received ICE candidate:', data);
                if (!data?.candidate) {
                    throw new Error('Invalid ICE candidate');
                }
                await webRTCService.handleIceCandidate(data.candidate);
            } catch (error) {
                console.error('Error handling ICE candidate:', error);
            }
        }
    };

    // Register event handlers
    Object.entries(socketHandlers).forEach(([event, handler]) => {
        sock.on(event, handler);
    });

    // Cleanup
    return () => {
        Object.keys(socketHandlers).forEach((event) => {
            sock.off(event);
        });
    };
}, [selectedUser, webRTCService]);

  return (
    <div className="flex flex-col flex-1 p-4 bg-white rounded shadow h-full">
      <h2 className="text-xl font-semibold mb-4 border-b pb-2">
        Chat with {selectedUser?.name || 'Select a friend'}
      </h2>

      {/* Screen sharing video */}
      <div className="mb-4">
        <video
          ref={screenVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full bg-black rounded ${!isScreenSharing && !isStreamAccepted ? 'hidden' : ''}`}
        />
      </div>

      {/* Screen sharing controls */}
      <div className="mb-4">
        <button
          onClick={handleScreenShare}
          className={`px-4 py-2 rounded ${
            isScreenSharing 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>
      </div>

      {/* Accept stream button */}
      {!isStreamAccepted && !isScreenSharing && (
        <div className="mb-4">
          <button
            onClick={handleAcceptStream}
            className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
          >
            Accept Stream
          </button>
        </div>
      )}

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
