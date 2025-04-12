import { getSocket } from './socket';

const ICE_SERVERS = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        },
        {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efG45XZ8SUYCNIDODZ',
            credential: '1WR9yaEat5UIfHYe'
        }
    ],
    iceCandidatePoolSize: 10
};

class WebRTCService {
    constructor() {
        if (!navigator.mediaDevices || !window.RTCPeerConnection) {
            throw new Error('WebRTC is not supported in this browser');
        }
        
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = new MediaStream();
        this.socket = getSocket();
        this.onRemoteStreamAvailable = null;
        this.currentTargetUser = null;

        if (!this.socket) {
            throw new Error('Socket connection not available');
        }
    }

    async initializePeerConnection() {
        try {
            this.cleanup();
            
            this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
            
            // Add connection state logging
            this.setupConnectionStateHandlers();
            
            return this.peerConnection;
        } catch (error) {
            console.error('Failed to initialize peer connection:', error);
            throw error;
        }
    }

    setupConnectionStateHandlers() {
        if (!this.peerConnection) return;

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                this.restartConnection();
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection State:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                this.restartConnection();
            }
        };
    }

    async startScreenShare(targetUserId) {
        this.currentTargetUser = targetUserId;

        try {
            await this.initializePeerConnection();
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            this.localStream = screenStream; // ✅ Fix: Save local screen stream

            screenStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, screenStream);
            });

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('screen-share-offer', {
                targetUserId,
                offer
            });

            screenStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare(targetUserId);
            };

            return screenStream;
        } catch (error) {
            console.error('Error in startScreenShare:', error);
            throw error;
        }
    }

    async stopScreenShare(targetUserId) {
        try {
            if (this.localStream) {
                // Stop all tracks
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                });

                // Remove all tracks from peer connection
                if (this.peerConnection) {
                    const senders = this.peerConnection.getSenders();
                    senders.forEach(sender => {
                        this.peerConnection.removeTrack(sender);
                    });
                }

                this.localStream = null;
            }

            this.socket.emit('screen-sharing-stopped', { targetUserId });
        } catch (error) {
            console.error('Error stopping screen share:', error);
            throw error;
        }
    }

    async handleIncomingOffer(offer, targetUserId) {
        this.currentTargetUser = targetUserId;
        
        // Cleanup and initialize new connection
        this.cleanup();
        await this.initializePeerConnection();

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create and set local answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('screen-share-answer', {
                targetUserId,
                answer
            });
            
            console.log('Successfully created and sent answer');
        } catch (error) {
            console.error('Error in handleIncomingOffer:', error);
            this.cleanup();
            throw error;
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (!this.peerConnection) {
                console.warn('No peer connection available');
                return;
            }

            if (!this.peerConnection.remoteDescription) {
                console.warn('Waiting for remote description...');
                // Queue the candidate for later if remote description isn't set
                setTimeout(() => this.handleIceCandidate(candidate), 1000);
                return;
            }

            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Successfully added ICE candidate');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    async restartConnection() {
        console.log('Attempting to restart connection...');
        
        if (!this.peerConnection) return;
        
        try {
            // Create and set new offer with iceRestart: true
            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('screen-share-offer', {
                targetUserId: this.currentTargetUser,
                offer
            });
        } catch (error) {
            console.error('Error restarting connection:', error);
            this.cleanup();
        }
    }

    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.remoteStream = new MediaStream();
        this.currentTargetUser = null;
    }
}

// Export as singleton instance with error handling
let webRTCServiceInstance = null;

try {
    webRTCServiceInstance = new WebRTCService();
} catch (error) {
    console.error('Failed to initialize WebRTC service:', error);
    // Provide a mock service for graceful degradation
    webRTCServiceInstance = {
        initializePeerConnection: () => Promise.reject(new Error('WebRTC not supported')),
        startScreenShare: () => Promise.reject(new Error('WebRTC not supported')),
        stopScreenShare: () => Promise.reject(new Error('WebRTC not supported')),
        handleIncomingOffer: () => Promise.reject(new Error('WebRTC not supported')),
        handleAnswer: () => Promise.reject(new Error('WebRTC not supported')),
        handleIceCandidate: () => Promise.reject(new Error('WebRTC not supported')),
        cleanup: () => {}
    };
}

export default webRTCServiceInstance;
