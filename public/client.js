const socket = io();
let currentRoomId = null;

// 登录与加入
document.getElementById('btn-no-room').onclick = () => {
    const name = document.getElementById('nickname').value || "玩家";
    socket.emit('createRoom', { name });
};

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('nickname').value || "玩家";
    const roomId = document.getElementById('room-code-input').value;
    socket.emit('joinRoom', { roomId, name });
};

socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
});

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
    socket.emit('rollDice', { roomId: currentRoomId });
    document.getElementById('btn-roll').disabled = true;
};

// 核心逻辑：判断身份
socket.on('allRolled', (data) => {
    const myId = socket.id; // 我自己的ID
    
    // 更新点数显示
    const list = document.getElementById('players-list');
    list.innerHTML = data.players.map(p => `<p>${p.name}: ${p.roll}点</p>`).join('');

    // 判断权限：只有点数最低的 ID 匹配才弹窗
    if (myId === data.loserId) {
        document.getElementById('modal-loser').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "你是最低分，请选择受罚方式！";
    } else {
        document.getElementById('status-broadcast').innerText = `等待 ${data.loserName} 选择...`;
    }
});

function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

// 国王逻辑
socket.on('yourTurnToPunish', (data) => {
    // 只有国王会收到这个私有消息
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
    document.getElementById('status-broadcast').innerText = "你是国王，请发布惩罚指令！";
});

socket.on('systemBroadcast', (text) => {
    document.getElementById('status-broadcast').innerText = text;
});

function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if(!content) return;
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content });
}

socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerText = `${data.winnerName} 的惩罚是：${data.content}`;
});
