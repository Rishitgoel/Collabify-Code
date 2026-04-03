import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to server.');
  const roomIdToDelete = '4xvMulEjsq'; // Replace with a room ID that exists in workspace/
  console.log(`Requesting deletion of room: ${roomIdToDelete}`);
  socket.emit('room:delete', roomIdToDelete, (res) => {
    console.log('Response:', res);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});
