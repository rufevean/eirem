import { getSocket } from './socket';

class WebRTCService {
    constructor() {
        this.peerConnection = new RTCPeerConnection();
        this.localStream = null;
        this.socket = getSocket();
    }

    async startScreenShare(targetUserId) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Replace existing video track if it exists
            const videoTrack = screenStream.getVideoTracks()[0];
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track?.kind === 'video');
            
            if (videoSender) {
                videoSender.replaceTrack(videoTrack);
            } else {
                this.peerConnection.addTrack(videoTrack, screenStream);
            }

            // Handle screen share stop
            videoTrack.onended = () => {
                this.stopScreenShare(targetUserId);
            };

            this.socket.emit('screen-sharing-started', { targetUserId });
            return screenStream;

        } catch (error) {
            console.error('Error starting screen share:', error);
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
}

export default new WebRTCService();