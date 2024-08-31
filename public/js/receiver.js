const socket = io('http://192.168.101.123:3000/sender.html'); // Adjust to your server's actual IP and port

socket.on('connect', () => {
    console.log('Connected to server');
});

// Handle incoming stream
socket.on('newProducer', async ({ producerId, kind }) => {
    const { id, iceParameters, iceCandidates, dtlsParameters } = await fetchTransportDetails();

    const transport = new mediasoupClient.WebRtcTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
    });

    await transport.connect({ dtlsParameters });

    socket.emit('consume', {
        producerId,
        rtpCapabilities: transport.rtpCapabilities,
    });

    socket.on('consumed', async ({ id, producerId, kind, rtpParameters }) => {
        const consumer = await transport.consume({ id, producerId, kind, rtpParameters });
        const videoElement = document.getElementById('remoteVideo');
        videoElement.srcObject = new MediaStream([consumer.track]);
        videoElement.onloadedmetadata = () => {
            videoElement.play();
        };
    });
});

async function fetchTransportDetails() {
    return new Promise((resolve) => {
        socket.emit('join', { roomId: 'yourRoomId', role: 'receiver' });

        socket.once('transport', (data) => {
            resolve(data);
        });
    });
}
