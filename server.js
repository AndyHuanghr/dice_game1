const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        rooms[roomId] = { players: [{ id: socket.id, name: data.name, roll: null, isReady: false }] };
        socket.join(roomId);
        socket.emit('roomJoined', { roomId });
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            room.players.push({ id: socket.id, name: data.name, roll: null, isReady: false });
            socket.join(data.roomId);
            socket.emit('roomJoined', { roomId: data.roomId });
            io.to(data.roomId).emit('updatePlayers', room.players);
        } else {
            socket.emit('error', '房间不存在');
        }
    });

    socket.on('rollDice', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.roll = Math.floor(Math.random() * 6) + 1;
            player.isReady = true;
            io.to(data.roomId).emit('updatePlayers', room.players);

            if (room.players.every(p => p.isReady)) {
                let sorted = [...room.players].sort((a, b) => a.roll - b.roll);
                room.loser = sorted[0]; 
                room.winner = sorted[sorted.length - 1];
                io.to(data.roomId).emit('allRolled', {
                    players: room.players,
                    loserId: room.loser.id,
                    loserName: room.loser.name,
                    winnerId: room.winner.id,
                    winnerName: room.winner.name
                });
            }
        }
    });

    socket.on('loserMadeChoice', (data) => {
        const room = rooms[data.roomId];
        if(!room) return;
        io.to(data.roomId).emit('systemBroadcast', `${room.loser.name} 选择了：${data.choice}`);
        io.to(room.winner.id).emit('yourTurnToPunish', { choice: data.choice });
    });

    socket.on('winnerSetChallenge', (data) => {
        const room = rooms[data.roomId];
        if(!room) return;
        io.to(data.roomId).emit('finalResult', { winnerName: room.winner.name, content: data.content });
    });

    // 核心修改：处理再来一局
    socket.on('playAgain', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            // 重置所有人的状态，但不踢人
            room.players.forEach(p => {
                p.roll = null;
                p.isReady = false;
            });
            // 通知所有人回到游戏画面
            io.to(data.roomId).emit('resetGameClient');
            io.to(data.roomId).emit('updatePlayers', room.players);
            io.to(data.roomId).emit('systemBroadcast', "新的一局开始了！");
        }
    });

    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            const index = rooms[roomId].players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                rooms[roomId].players.splice(index, 1);
                io.to(roomId).emit('updatePlayers', rooms[roomId].players);
                if (rooms[roomId].players.length === 0) delete rooms[roomId];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
