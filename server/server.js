// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors({
    origin: '*', // Allow all origins for testing; adjust for production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

let worker, router;

(async () => {
    try {
        worker = await mediasoup.createWorker();
        router = await worker.createRouter({
            mediaCodecs: [
                { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
                { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
            ],
        });
        console.log('Mediasoup worker and router created successfully.');
    } catch (error) {
        console.error('Failed to create Mediasoup worker or router:', error);
    }
})();

app.use(express.static('public'));

app.get('/sender', (req, res) => {
    res.sendFile(__dirname + '/../public/sender.html');
});

app.get('/receiver', (req, res) => {
    res.sendFile(__dirname + '/../public/receiver.html');
});

io.on('connection', (socket) => {
    socket.on('join', async ({ roomId, role }) => {
        try {
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            socket.emit('transport', {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });

            if (role === 'sender') {
                socket.on('produce', async ({ kind, rtpParameters }) => {
                    const producer = await transport.produce({ kind, rtpParameters });
                    socket.emit('produced', { id: producer.id });
                    socket.broadcast.emit('newProducer', { producerId: producer.id, kind });
                });

                socket.on('stop-share', async ({ producerId }) => {
                    socket.broadcast.emit('producerClosed', { producerId });
                });
            } else if (role === 'receiver') {
                socket.on('consume', async ({ producerId, rtpCapabilities }) => {
                    if (router.canConsume({ producerId, rtpCapabilities })) {
                        const consumer = await transport.consume({ producerId, rtpCapabilities });
                        socket.emit('consumed', {
                            id: consumer.id,
                            producerId,
                            kind: consumer.kind,
                            rtpParameters: consumer.rtpParameters,
                        });
                    }
                });
            }

            socket.on('connect-transport', async ({ dtlsParameters }) => {
                await transport.connect({ dtlsParameters });
            });
        } catch (error) {
            console.error('Error in join event:', error);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
