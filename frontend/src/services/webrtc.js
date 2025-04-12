import { getSocket } from './socket';

const METERED_API_KEY = "6de5699cc9b05e26a005193be6aada75ae39";
const METERED_DOMAIN = "eirem.metered.live";

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
        const iceServers = await this.getMeteredTurnServers();
        this.peerConnection = new RTCPeerConnection({ iceServers });

        // ICE candidate handling
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetUserId: this.currentTargetUser
                });
            }
        };

        // Track remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            if (this.onRemoteStreamAvailable) {
                this.onRemoteStreamAvailable(this.remoteStream);
            }
        };

        // Debug logs
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

    async getMeteredTurnServers() {
        try {
            const response = await fetch(`https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
            const iceServers = await response.json();
            console.log("Using Metered TURN servers:", iceServers);
            return iceServers;
        } catch (error) {
            console.error("Error fetching Metered TURN servers:", error);
            return [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ];
        }
    }

    async startScreenShare(targetUserId) {
        this.currentTargetUser = targetUserId;

        if (!this.peerConnection) await this.initializePeerConnection();

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

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
        this.currentTargetUser = targetUserId;

        if (!this.peerConnection) await this.initializePeerConnection();

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('screen-share-answer', {
                targetUserId,
                answer
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
}

export default new WebRTCService();
