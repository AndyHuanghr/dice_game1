const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 存储房间数据: { roomId: { players: [], rolls: {}, gameState: 'waiting' } }
const rooms = {};

io.on('connection', (socket) => {
    console.log('有新用户连接:', socket.id);

    // 1. 加入房间
    socket.on('joinRoom', ({ roomId, nickname }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [], rolls: {}, choice: null };
        }
        
        const player = { id: socket.id, nickname: nickname };
        rooms[roomId].players.push(player);
        
        // 通知房间内所有人更新玩家列表
        io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
        // 如果是中途加入，且已经有结果，可能需要同步状态（此处简化为重置）
    });

    // 2. 玩家掷骰子
    socket.on('rollDice', ({ roomId }) => {
        if (!rooms[roomId]) return;

        const roll = Math.floor(Math.random() * 6) + 1;
        rooms[roomId].rolls[socket.id] = roll;

        // 告诉所有人这个玩家掷出了多少点
        io.to(roomId).emit('playerRolled', { id: socket.id, roll: roll });

        // 检查是否所有人都掷完了
        if (Object.keys(rooms[roomId].rolls).length === rooms[roomId].players.length) {
            calculateResults(roomId);
        }
    });

    // 3. 计算结果
    function calculateResults(roomId) {
        const room = rooms[roomId];
        let minVal = 7, maxVal = 0;
        let minId = null, maxId = null;

        // 简单的逻辑：如果有平局，取第一个找到的人
        for (const [id, val] of Object.entries(room.rolls)) {
            if (val < minVal) { minVal = val; minId = id; }
            if (val > maxVal) { maxVal = val; maxId = id; }
        }

        // 发送结果给所有人
        io.to(roomId).emit('gameResult', { minId, maxId, minVal, maxVal });
        
        // 重置由于下一轮
        room.rolls = {}; 
    }

    // 4. 最低分玩家选择了真心话还是大冒险
    socket.on('selectChoice', ({ roomId, choice }) => {
        // choice 是 "真心话" 或 "大冒险"
        io.to(roomId).emit('playerMadeChoice', { choice });
    });

    // 5. 最高分玩家发送了挑战内容
    socket.on('sendChallenge', ({ roomId, challengeText }) => {
        io.to(roomId).emit('receiveChallenge', { challengeText });
    });

    // 断开连接处理
    socket.on('disconnect', () => {
        // 实际项目中需要在这里清理房间里的玩家数据
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});