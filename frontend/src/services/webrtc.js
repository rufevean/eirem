import { getSocket } from './socket';

class WebRTCService {
    constructor() {
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        this.peerConnection = new RTCPeerConnection(this.configuration);
        this.localStream = null;
        this.socket = getSocket();
        this.remoteStream = new MediaStream();
        
        // Setup ICE handling
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.socket.emit('ice-candidate', { 
                    candidate: event.candidate,
                    targetUserId: this.currentTargetUser 
                });
            }
        };
        this.onRemoteStreamAvailable = null;

        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            this.remoteStream = event.streams[0];
            if (this.onRemoteStreamAvailable) {
                this.onRemoteStreamAvailable(this.remoteStream);
            }
        };
        
        // Handle incoming tracks
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            this.remoteStream = event.streams[0];
        };

        // Enhanced debugging for connection state
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };

        this.peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state:', this.peerConnection.signalingState);
        };
    }

    async startScreenShare(targetUserId) {
        console.log('Starting screen share for user:', targetUserId);
        this.currentTargetUser = targetUserId; // Store current target

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Add tracks to peer connection
            screenStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, screenStream);
            });

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            console.log('Created offer:', offer);
            console.log('Local description set');
            
            this.socket.emit('screen-share-offer', {
                targetUserId,
                offer: offer
            });
            console.log('Offer sent to user:', targetUserId);

            // Handle screen share stop
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
                const videoTrack = this.localStream.getVideoTracks()[0];
                const senders = this.peerConnection.getSenders();
                const videoSender = senders.find(sender => sender.track?.kind === 'video');
                
                if (videoSender && videoTrack) {
                    videoSender.replaceTrack(videoTrack);
                }
            }
            
            this.socket.emit('screen-sharing-stopped', { targetUserId });
        } catch (error) {
            console.error('Error stopping screen share:', error);
            throw error;
        }
    }

    async handleIncomingOffer(offer, targetUserId) {
        console.log('Handling incoming offer from:', targetUserId);
        console.log('Offer:', offer);
        
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('Remote description set');
            console.log('Answer created:', answer);
            console.log('Local description set');
            
            this.socket.emit('screen-share-answer', {
                targetUserId,
                answer: answer
            });
        } catch (error) {
            console.error('Error in handleIncomingOffer:', error);
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
            if (this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(candidate);
                console.log('Added ICE candidate');
            } else {
                console.error('Cannot add ICE candidate without remote description');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
}

export default new WebRTCService();