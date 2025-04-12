// src/services/socket.js

import { io } from "socket.io-client";

let socket = null;

export const initSocket = () => {
  const storedUser = JSON.parse(localStorage.getItem("user"));
  if (!storedUser?.token) {
    console.error("🚫 No token found for WebSocket connection.");
    return null;
  }

  try {
    const tokenPayload = JSON.parse(atob(storedUser.token.split('.')[1]));
    console.log('Token payload:', tokenPayload);
    if (tokenPayload.exp < Date.now() / 1000) {
      console.error('Token has expired');
      return null;
    }
  } catch (e) {
    console.error('Invalid token format:', e);
    return null;
  }

    socket = io("https://eirem.onrender.com", {
      query: { 
        token: storedUser.token,
        userId: storedUser.id
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
  });


  socket.on('connect', () => {
    console.log('Socket connected successfully');
    console.log('Transport:', socket.io.engine.transport.name);
    console.log('User ID:', storedUser.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error details:', error);
    // Try to reconnect if token expired
    if (error.message === "Connection rejected by server") {
      console.log("Attempting to refresh connection...");
      socket.disconnect();
      socket = null;
    }
  });

  socket.on('screen-share-offer', async (data) => {
    console.log('Received screen-share-offer:', data);
    const { offer, targetUserId } = data;

    if (webRTCService) {
        await webRTCService.handleIncomingOffer(offer, targetUserId);
    } else {
        console.error('WebRTCService is not initialized');
    }
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

// Remove the default export and export initSocket as connectSocket
export const connectSocket = initSocket;
