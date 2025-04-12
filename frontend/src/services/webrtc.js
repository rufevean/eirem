import { getSocket } from './socket';

const EXPRESS_TURN_CREDENTIALS = {
    iceServers: [
        {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efG45XZ8SUYCNIDODZ',
            credential: '1WR9yaEat5UIfHYe'
        }
    ]
};

class WebRTCService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = new MediaStream();
        this.socket = getSocket();
        this.onRemoteStreamAvailable = null;
        this.currentTargetUser = null;
    }

    async initializePeerConnection() {
        // Cleanup existing connection
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Using ExpressTURN credentials for ICE servers
        this.peerConnection = new RTCPeerConnection(EXPRESS_TURN_CREDENTIALS);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetUserId: this.currentTargetUser
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.streams[0]);
            this.remoteStream = event.streams[0];
            // Trigger immediate UI update
            if (this.onRemoteStreamAvailable) {
                this.onRemoteStreamAvailable(this.remoteStream);
            }
        };

        // Add logging for connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'failed') {
                this.peerConnection.restartIce();
            }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };
        this.peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state:', this.peerConnection.signalingState);
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
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(candidate);
                console.log('Added ICE candidate');
            } else {
                console.warn('Remote description not set yet');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
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

export default new WebRTCService();
