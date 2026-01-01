const socket = io();
let currentRoomId = null;
let myName = "";

// UI 控制
const chatSidebar = document.getElementById('chat-sidebar');
const chatBox = document.getElementById('chat-box');
const toggleChatBtn = document.getElementById('toggle-chat');

toggleChatBtn.onclick = () => {
    const isCollapsed = chatSidebar.classList.toggle('chat-collapsed');
    chatBox.classList.toggle('hidden', isCollapsed);
    toggleChatBtn.innerText = isCollapsed ? "💬 展开聊天" : "💬 收起聊天";
};

// 登录与房间逻辑
document.getElementById('btn-no-room').onclick = () => {
    socket.emit('createRoom', { name: document.getElementById('nickname').value });
};

document.getElementById('btn-has-room').onclick = () => {
    document.getElementById('room-input-area').classList.remove('hidden');
};

document.getElementById('btn-join').onclick = () => {
    const roomId = document.getElementById('room-code-input').value;
    if (roomId) socket.emit('joinRoom', { roomId, name: document.getElementById('nickname').value });
};

socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    myName = data.nickname;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
});

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
    const btn = document.getElementById('btn-roll');
    btn.disabled = true;
    btn.innerText = "🎲 正在投掷...";
    setTimeout(() => {
        socket.emit('rollDice', { roomId: currentRoomId });
        btn.innerText = "已投掷";
    }, 1000);
};

// 更新玩家列表
socket.on('updatePlayers', (players) => {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map(p => `
        <div class="player-item">
            <span>👤 ${p.name} ${p.id === socket.id ? '(我)' : ''}</span>
            <span style="color: ${p.isReady ? '#4caf50' : '#888'}">
                ${p.isReady ? (p.roll ? `🎲 ${p.roll}点` : '✅ 已投') : '⌛ 准备中'}
            </span>
        </div>
    `).join('');
});

// --- 身份隔离逻辑：只有对应身份的人才能操作 ---
socket.on('allRolled', (data) => {
    const myId = socket.id;
    
    // 隐藏所有弹窗作为初始化
    document.getElementById('modal-loser').classList.add('hidden');
    document.getElementById('modal-winner').classList.add('hidden');

    if (myId === data.loserId) {
        // 只有输家能选真心话/大冒险
        document.getElementById('modal-loser').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "你是受罚者，请选择惩罚类型！";
    } else if (myId === data.winnerId) {
        // 赢家等待输家选择，不显示弹窗，只显示状态
        document.getElementById('status-broadcast').innerText = `你是赢家！等待 ${data.loserName} 做出选择...`;
    } else {
        document.getElementById('status-broadcast').innerText = `结果已出，赢家是 ${data.winnerName}，输家是 ${data.loserName}`;
    }
});

// 输家选完后，通知赢家出题
socket.on('yourTurnToPunish', (data) => {
    const myId = socket.id;
    // 只有真正的赢家才会收到这个事件并弹出输入框
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
    document.getElementById('status-broadcast').innerText = "对方已选好，请你输入惩罚内容！";
});

function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (!content) return alert("请输入内容！");
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content });
}

socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = `
        <div style="font-size:0.9rem; color:#aaa;">赢家 ${data.winnerName} 的指令：</div>
        <div style="font-size:1.5rem; color:#ffd700; font-weight:bold; margin-top:10px;">${data.content}</div>
    `;
});

function handlePlayAgain() {
    socket.emit('playAgain', { roomId: currentRoomId });
}

socket.on('resetGameClient', () => {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('modal-loser').classList.add('hidden');
    document.getElementById('modal-winner').classList.add('hidden');
    const rollBtn = document.getElementById('btn-roll');
    rollBtn.disabled = false;
    rollBtn.innerText = "🎲 掷骰子";
    document.getElementById('challenge-input').value = "";
    document.getElementById('status-broadcast').innerText = "新一局开始！";
});

// 聊天与系统通知
socket.on('newChatMessage', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg-item';
    let contentHtml = data.type === 'text' ? `<span>${data.content}</span>` : 
                     (data.type === 'image' ? `<img src="${data.content}" class="chat-media">` : 
                     `<video src="${data.content}" controls class="chat-media"></video>`);
    msgDiv.innerHTML = `<strong>${data.sender}:</strong><br>${contentHtml}`;
    const container = document.getElementById('chat-messages');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
});

document.getElementById('send-msg').onclick = () => {
    const input = document.getElementById('chat-input');
    if (input.value) {
        socket.emit('chatMessage', { roomId: currentRoomId, sender: myName, content: input.value, type: 'text' });
        input.value = "";
    }
};

document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 2 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => socket.emit('chatMessage', { 
            roomId: currentRoomId, sender: myName, content: reader.result, 
            type: file.type.startsWith('image') ? 'image' : 'video' 
        });
        reader.readAsDataURL(file);
    } else { alert("文件过大"); }
};

socket.on('systemBroadcast', (t) => document.getElementById('status-broadcast').innerText = t);
