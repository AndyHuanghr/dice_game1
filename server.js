const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
const trendyNames = ["赛博猎人", "微醺派大星", "快乐修仙者", "代码诗人", "反卷精英", "深夜潜水员"];

io.on('connection', (socket) => {
    // 获取昵称逻辑
    const getNickname = (name) => name && name.trim() !== "" ? name : trendyNames[Math.floor(Math.random() * trendyNames.length)];

    socket.on('createRoom', (data) => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        const nickname = getNickname(data.name);
        rooms[roomId] = { players: [{ id: socket.id, name: nickname, roll: null, isReady: false }] };
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, nickname });
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            const nickname = getNickname(data.name);
            room.players.push({ id: socket.id, name: nickname, roll: null, isReady: false });
            socket.join(data.roomId);
            socket.emit('roomJoined', { roomId: data.roomId, nickname });
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
                // 检查是否有平局情况
                const rolls = room.players.map(p => p.roll);
                const maxRoll = Math.max(...rolls);
                const minRoll = Math.min(...rolls);
                const maxCount = rolls.filter(r => r === maxRoll).length;
                const minCount = rolls.filter(r => r === minRoll).length;

                if (maxCount > 1 || minCount > 1) {
                    io.to(data.roomId).emit('systemBroadcast', "出现平局！系统正在重开...");
                    setTimeout(() => {
                        room.players.forEach(p => { p.roll = null; p.isReady = false; });
                        io.to(data.roomId).emit('resetGameClient');
                        io.to(data.roomId).emit('updatePlayers', room.players);
                    }, 2000);
                } else {
                    let sorted = [...room.players].sort((a, b) => a.roll - b.roll);
                    room.loser = sorted[0]; 
                    room.winner = sorted[sorted.length - 1];
                    io.to(data.roomId).emit('allRolled', {
                        players: room.players,
                        loserId: room.loser.id, loserName: room.loser.name,
                        winnerId: room.winner.id, winnerName: room.winner.name
                    });
                }
            }
        }
    });

    // 聊天逻辑
    socket.on('chatMessage', (data) => {
        io.to(data.roomId).emit('newChatMessage', {
            sender: data.sender,
            content: data.content,
            type: data.type // 'text', 'image', 'video'
        });
    });

    socket.on('loserMadeChoice', (data) => {
        const room = rooms[data.roomId];
        if(room) {
            io.to(data.roomId).emit('systemBroadcast', `${room.loser.name} 选择了：${data.choice}`);
            io.to(room.winner.id).emit('yourTurnToPunish', { choice: data.choice });
        }
    });

    socket.on('winnerSetChallenge', (data) => {
        const room = rooms[data.roomId];
        if(room) io.to(data.roomId).emit('finalResult', { winnerName: room.winner.name, content: data.content });
    });

    socket.on('playAgain', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            room.players.forEach(p => { p.roll = null; p.isReady = false; });
            io.to(data.roomId).emit('resetGameClient');
            io.to(data.roomId).emit('updatePlayers', room.players);
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
