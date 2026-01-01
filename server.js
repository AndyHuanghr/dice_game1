// server.js 核心逻辑更新
let rooms = {};

io.on('connection', (socket) => {
    // ... 前面的加入房间逻辑保持不变 ...

    socket.on('rollDice', (data) => {
        const room = rooms[data.roomId];
        const player = room.players.find(p => p.id === socket.id);
        player.roll = Math.floor(Math.random() * 6) + 1;
        player.isReady = true;

        // 检查是否所有人都掷完了
        if (room.players.every(p => p.isReady)) {
            // 计算最高和最低
            let sorted = [...room.players].sort((a, b) => a.roll - b.roll);
            room.loser = sorted[0]; // 点数最小
            room.winner = sorted[sorted.length - 1]; // 点数最大

            // 向所有人播报结果，并点名倒霉蛋
            io.to(data.roomId).emit('allRolled', {
                players: room.players,
                loserId: room.loser.id,
                loserName: room.loser.name,
                winnerId: room.winner.id,
                winnerName: room.winner.name
            });
        }
    });

    // 处理倒霉蛋的选择
    socket.on('loserMadeChoice', (data) => {
        const room = rooms[data.roomId];
        io.to(data.roomId).emit('systemBroadcast', `${room.loser.name} 选择了：${data.choice}`);
        // 只给赢家发指令框
        io.to(room.winner.id).emit('yourTurnToPunish', { choice: data.choice });
    });

    // 处理国王的惩罚指令
    socket.on('winnerSetChallenge', (data) => {
        const room = rooms[data.roomId];
        io.to(data.roomId).emit('finalResult', {
            winnerName: room.winner.name,
            content: data.content
        });
    });
});
