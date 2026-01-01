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
    // 创建/加入房间逻辑
    socket.on('createRoom', (data) => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        rooms[roomId] = { players: [{ id: socket.id, name: data.name, roll: null, isReady: false }] };
        socket.join(roomId);
        socket.emit('roomJoined', { roomId });
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

    // 掷骰子逻辑
    socket.on('rollDice', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.roll = Math.floor(Math.random() * 6) + 1;
            player.isReady = true;
            io.to(data.roomId).emit('updatePlayers', room.players);

            // 检查是否所有人都掷完了
            if (room.players.every(p => p.isReady)) {
                let sorted = [...room.players].sort((a, b) => a.roll - b.roll);
                room.loser = sorted[0]; // 最低分
                room.winner = sorted[sorted.length - 1]; // 最高分

                // 核心：发送包含输家和赢家ID的数据
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

    // 接收输家的选择
    socket.on('loserMadeChoice', (data) => {
        const room = rooms[data.roomId];
        io.to(data.roomId).emit('systemBroadcast', `${room.loser.name} 选择了：${data.choice}`);
        // 只给赢家发送“轮到你了”
        io.to(room.winner.id).emit('yourTurnToPunish', { choice: data.choice });
    });

    // 接收国王的惩罚
    socket.on('winnerSetChallenge', (data) => {
        const room = rooms[data.roomId];
        io.to(data.roomId).emit('finalResult', {
            winnerName: room.winner.name,
            content: data.content
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
