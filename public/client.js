const socket = io();
let currentRoomId = null;

// UI切换逻辑
document.getElementById('btn-has-room').onclick = () => {
    document.getElementById('room-input-area').classList.remove('hidden');
};

document.getElementById('btn-no-room').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    socket.emit('createRoom', { name });
};

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    const roomId = document.getElementById('room-code-input').value;
    if (!roomId) return alert("请输入房间号");
    socket.emit('joinRoom', { roomId, name });
};

// 房间进入成功
socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
});

// 核心：实时更新玩家列表
socket.on('updatePlayers', (players) => {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map(p => `
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span>👤 ${p.name} ${p.id === socket.id ? '(我)' : ''}</span>
            <span style="color: ${p.isReady ? '#4caf50' : '#888'}">
                ${p.isReady ? '✅ 已掷' : '⌛ 等待中'}
            </span>
        </div>
    `).join('');
});

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
    socket.emit('rollDice', { roomId: currentRoomId });
    document.getElementById('btn-roll').disabled = true;
    document.getElementById('btn-roll').innerText = "骰子已掷出";
};

// 所有人掷完后
socket.on('allRolled', (data) => {
    const myId = socket.id;
    // 掷完后重新展示带点数的列表
    const list = document.getElementById('players-list');
    list.innerHTML = data.players.map(p => `
        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
            <span>👤 ${p.name}</span>
            <span style="color: #ffd700; font-weight: bold;">${p.roll} 点</span>
        </div>
    `).join('');

    if (myId === data.loserId) {
        document.getElementById('modal-loser').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "你是受罚者，请选择！";
    } else {
        document.getElementById('status-broadcast').innerText = `等待 ${data.loserName} 做出选择...`;
    }
});

function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

socket.on('yourTurnToPunish', (data) => {
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
    document.getElementById('status-broadcast').innerText = "你是赢家，请下达处罚！";
});

socket.on('systemBroadcast', (text) => {
    document.getElementById('status-broadcast').innerText = text;
});

function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (!content) return alert("请输入内容");
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content: content });
}

socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = 
        `赢家 <strong style="color:#ffd700">${data.winnerName}</strong> 的指令：<br><br>${data.content}`;
});

socket.on('error', (msg) => alert(msg));
