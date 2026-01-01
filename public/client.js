const socket = io();
let currentRoomId = null;
let myNickname = "";

// UI 元素
const statusBroadcast = document.getElementById('status-broadcast');

// 登录逻辑
document.getElementById('btn-no-room').onclick = () => {
    myNickname = document.getElementById('nickname').value || "无名氏";
    socket.emit('createRoom', { name: myNickname });
};

document.getElementById('btn-has-room').onclick = () => {
    document.getElementById('room-input-area').classList.remove('hidden');
};

document.getElementById('btn-join').onclick = () => {
    myNickname = document.getElementById('nickname').value || "无名氏";
    const code = document.getElementById('room-code-input').value;
    if (code) {
        socket.emit('joinRoom', { roomId: code, name: myNickname });
    }
};

// 房间进入成功
socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
    statusBroadcast.innerText = "等待所有人加入并掷骰子...";
});

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
    document.getElementById('btn-roll').disabled = true;
    socket.emit('rollDice', { roomId: currentRoomId });
};

// 核心逻辑：所有人掷完后
socket.on('allRolled', (data) => {
    const myId = socket.id;
    
    // 清除列表展示新点数
    const list = document.getElementById('players-list');
    list.innerHTML = data.players.map(p => `<div>${p.name}: ${p.roll}点</div>`).join('');

    if (myId === data.loserId) {
        // 只有倒霉蛋看到选择框
        document.getElementById('modal-loser').classList.remove('hidden');
        statusBroadcast.innerText = "你是最低分，请选择！";
    } else {
        statusBroadcast.innerText = `等待点数最低的 ${data.loserName} 选择真心话或大冒险...`;
    }
});

// 倒霉蛋做出选择
function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

// 国王收到指令
socket.on('yourTurnToPunish', (data) => {
    // 只有点数最高的人会触发这个监听
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
    statusBroadcast.innerText = "你是国王，请设置惩罚指令！";
});

// 播报倒霉蛋选了什么
socket.on('systemBroadcast', (text) => {
    statusBroadcast.innerText = text;
});

// 国王提交惩罚
function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (!content) return alert("请输入内容！");
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content: content });
}

// 展示最终结果
socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = 
        `国王 <strong>${data.winnerName}</strong> 发布了指令：<br><br>${data.content}`;
    statusBroadcast.innerText = "本轮游戏结束。";
});

socket.on('error', (msg) => alert(msg));
