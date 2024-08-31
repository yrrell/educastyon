const socket = io('http://192.168.101.123:3000/receiver.html'); // Adjust to your server's actual IP and port
let transport, producer;

document.getElementById('startSharing').addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.error('getDisplayMedia is not supported in this browser.');
        alert('Screen capture is not supported in this browser.');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        document.getElementById('videoElement').srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const { id, iceParameters, iceCandidates, dtlsParameters } = await fetchTransportDetails();

        transport = new mediasoupClient.WebRtcTransport({
            id,
            iceParameters,
            iceCandidates,
            dtlsParameters,
        });

        await transport.connect({ dtlsParameters });
        producer = await transport.produce({ track: videoTrack });

        socket.emit('produced', { id: producer.id });

        videoTrack.addEventListener('ended', () => {
            socket.emit('stop-share', { producerId: producer.id });
            producer.close();
            console.log('Screen sharing stopped.');
        });

    } catch (error) {
        console.error('Error starting screen capture:', error);
        alert('Error starting screen capture: ' + error.message);
    }
});

async function fetchTransportDetails() {
    return new Promise((resolve) => {
        socket.emit('join', { roomId: 'yourRoomId', role: 'sender' });

        socket.once('transport', (data) => {
            resolve(data);
        });
    });
}
