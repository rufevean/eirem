// src/services/socket.js

import { io } from "socket.io-client";
import { createWebRTCService } from './webrtc';

let socket = null;
let webRTCService = null;

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

  // Initialize WebRTC service after socket is created
  webRTCService = createWebRTCService(socket);

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

    try {
      if (!webRTCService) {
        throw new Error('WebRTC service not initialized');
      }
      await webRTCService.handleIncomingOffer(offer, targetUserId);
    } catch (error) {
      console.error('Error handling screen share offer:', error);
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

export const getWebRTCService = () => webRTCService;
