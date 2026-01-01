const socket = io();
let currentRoomId = null;

// UI切换逻辑
document.getElementById('btn-has-room').onclick = () => document.getElementById('room-input-area').classList.remove('hidden');

document.getElementById('btn-no-room').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    socket.emit('createRoom', { name });
};

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    const roomId = document.getElementById('room-code-input').value;
    if (roomId) socket.emit('joinRoom', { roomId, name });
};

socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
});

// 监听房间成员更新
socket.on('updatePlayers', (players) => {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map(p => `
        <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span>👤 ${p.name} ${p.id === socket.id ? '(我)' : ''}</span>
            <span style="color:${p.isReady ? '#4caf50' : '#888'}">${p.isReady ? '✅ 已掷' : '⌛ 等待中'}</span>
        </div>
    `).join('');
});

document.getElementById('btn-roll').onclick = () => {
    socket.emit('rollDice', { roomId: currentRoomId });
    document.getElementById('btn-roll').disabled = true;
    document.getElementById('btn-roll').innerText = "已投掷";
};

socket.on('allRolled', (data) => {
    const myId = socket.id;
    // 展示点数结果
    const list = document.getElementById('players-list');
    list.innerHTML = data.players.map(p => `
        <div style="display:flex; justify-content:space-between; padding:5px;">
            <span>👤 ${p.name}</span>
            <span style="color:#ffd700; font-weight:bold;">${p.roll} 点</span>
        </div>
    `).join('');

    if (myId === data.loserId) {
        document.getElementById('modal-loser').classList.remove('hidden');
    } else {
        document.getElementById('status-broadcast').innerText = `等待 ${data.loserName} 选择...`;
    }
});

function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

socket.on('yourTurnToPunish', (data) => {
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
});

function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (content) {
        document.getElementById('modal-winner').classList.add('hidden');
        socket.emit('winnerSetChallenge', { roomId: currentRoomId, content });
    }
}

socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = `赢家 <strong style="color:#ffd700">${data.winnerName}</strong> 发出的指令：<br><br><span style="font-size:1.2rem;">${data.content}</span>`;
});

// 核心：再来一局的处理逻辑
function handlePlayAgain() {
    socket.emit('playAgain', { roomId: currentRoomId });
}

// 接收到重置信号，回到掷骰子界面
socket.on('resetGameClient', () => {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    // 恢复按钮状态
    const rollBtn = document.getElementById('btn-roll');
    rollBtn.disabled = false;
    rollBtn.innerText = "🎲 掷骰子";
    document.getElementById('status-broadcast').innerText = "新一局开始，请掷骰子！";
});

socket.on('systemBroadcast', (text) => document.getElementById('status-broadcast').innerText = text);
socket.on('error', (msg) => alert(msg));
