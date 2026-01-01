const socket = io();
let currentRoomId = null;

// 点击“加入房间”显示输入框
document.getElementById('btn-has-room').onclick = () => {
    document.getElementById('room-input-area').classList.remove('hidden');
};

// 创建房间
document.getElementById('btn-no-room').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    socket.emit('createRoom', { name });
};

// 输入房间号后进入
document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('nickname').value || "无名氏";
    const roomId = document.getElementById('room-code-input').value;
    if (!roomId) return alert("请输入房间号");
    socket.emit('joinRoom', { roomId, name });
};

socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
    document.getElementById('status-broadcast').innerText = "等待所有人掷骰子...";
});

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
    socket.emit('rollDice', { roomId: currentRoomId });
    document.getElementById('btn-roll').disabled = true;
    document.getElementById('btn-roll').innerText = "已投掷";
};

// 所有人掷完后
socket.on('allRolled', (data) => {
    const myId = socket.id;
    const list = document.getElementById('players-list');
    list.innerHTML = data.players.map(p => `<div style="margin:5px 0;">${p.name}: <span style="color:#ffd700">${p.roll} 点</span></div>`).join('');

    if (myId === data.loserId) {
        document.getElementById('modal-loser').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "你是受罚者，请做出选择！";
    } else {
        document.getElementById('status-broadcast').innerText = `等待 ${data.loserName} 选择真心话或大冒险...`;
    }
});

function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

// 赢家收到指令
socket.on('yourTurnToPunish', (data) => {
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
    document.getElementById('status-broadcast').innerText = "你是赢家，请下达惩罚！";
});

socket.on('systemBroadcast', (text) => {
    document.getElementById('status-broadcast').innerText = text;
});

function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (!content) return alert("请输入处罚内容");
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content: content });
}

socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = 
        `赢家 <strong style="color:#ffd700">${data.winnerName}</strong> 发出的指令是：<br><br><span style="font-size:1.4rem;">${data.content}</span>`;
    document.getElementById('status-broadcast').innerText = "本轮结束";
});

socket.on('error', (msg) => alert(msg));
