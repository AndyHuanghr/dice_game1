const socket = io();
let currentRoomId = null;
let myName = "";

// --- 1. 聊天框与 UI 交互逻辑 ---

const chatSidebar = document.getElementById('chat-sidebar');
const chatBox = document.getElementById('chat-box');
const toggleChatBtn = document.getElementById('toggle-chat');

// 切换聊天框显示/隐藏
toggleChatBtn.onclick = () => {
    const isCollapsed = chatSidebar.classList.toggle('chat-collapsed');
    chatBox.classList.toggle('hidden', isCollapsed);
    toggleChatBtn.innerText = isCollapsed ? "💬 展开聊天" : "💬 收起聊天";
};

// --- 2. 登录与房间逻辑 ---

document.getElementById('btn-no-room').onclick = () => {
    const nameInput = document.getElementById('nickname').value;
    // 发送给后端，若为空则由后端匹配潮流名字
    socket.emit('createRoom', { name: nameInput });
};

document.getElementById('btn-has-room').onclick = () => {
    document.getElementById('room-input-area').classList.remove('hidden');
};

document.getElementById('btn-join').onclick = () => {
    const nameInput = document.getElementById('nickname').value;
    const roomId = document.getElementById('room-code-input').value;
    if (!roomId) return alert("请输入6位房间号");
    socket.emit('joinRoom', { roomId, name: nameInput });
};

// 成功进入房间
socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    myName = data.nickname; // 接收后端分配的（或自己输入的）昵称
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
    document.getElementById('status-broadcast').innerText = `你好，${myName}！准备开始吧`;
});

// --- 3. 游戏核心逻辑 (含平局与动画) ---

document.getElementById('btn-roll').onclick = () => {
    const btn = document.getElementById('btn-roll');
    btn.disabled = true;
    btn.innerText = "🎲 正在投掷...";
    
    // 模拟 1 秒的“掷骰子”心理预期动画
    document.getElementById('status-broadcast').innerText = "骰子正在旋转中... 祝你好运！";
    
    setTimeout(() => {
        socket.emit('rollDice', { roomId: currentRoomId });
        btn.innerText = "等待他人...";
    }, 1000);
};

// 实时更新房间成员列表
socket.on('updatePlayers', (players) => {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map(p => `
        <div class="player-item">
            <span>👤 ${p.name} ${p.id === socket.id ? '<small>(我)</small>' : ''}</span>
            <span style="color: ${p.isReady ? '#4caf50' : '#888'}">
                ${p.isReady ? (p.roll ? `🎲 ${p.roll}点` : '✅ 已准备') : '⌛ 思考中'}
            </span>
        </div>
    `).join('');
});

// 所有人投掷完成
socket.on('allRolled', (data) => {
    if (socket.id === data.loserId) {
        document.getElementById('modal-loser').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "不幸！你是受罚者！";
    } else if (socket.id === data.winnerId) {
        document.getElementById('status-broadcast').innerText = "恭喜！你是赢家，等待对方选择类型";
    } else {
        document.getElementById('status-broadcast').innerText = "结果已出，正在围观...";
    }
});

// 处理受罚者选择
function makeChoice(type) {
    document.getElementById('modal-loser').classList.add('hidden');
    socket.emit('loserMadeChoice', { roomId: currentRoomId, choice: type });
}

// 赢家收到出题指令
socket.on('yourTurnToPunish', (data) => {
    document.getElementById('modal-winner').classList.remove('hidden');
    document.getElementById('loser-choice-display').innerText = data.choice;
});

// 确认发布惩罚
function submitChallenge() {
    const content = document.getElementById('challenge-input').value;
    if (!content) return alert("写点什么惩罚TA吧！");
    document.getElementById('modal-winner').classList.add('hidden');
    socket.emit('winnerSetChallenge', { roomId: currentRoomId, content });
}

// 展示最终结果
socket.on('finalResult', (data) => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    document.getElementById('final-challenge-text').innerHTML = `
        <div style="font-size:0.9rem; color:#aaa; margin-bottom:10px;">赢家 ${data.winnerName} 的指令：</div>
        <div style="font-size:1.5rem; color:#ffd700; font-weight:bold;">${data.content}</div>
    `;
});

// “再来一局”逻辑
function handlePlayAgain() {
    socket.emit('playAgain', { roomId: currentRoomId });
}

// 接收系统重置信号 (包括手动重开和平局自动重开)
socket.on('resetGameClient', () => {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    const rollBtn = document.getElementById('btn-roll');
    rollBtn.disabled = false;
    rollBtn.innerText = "🎲 掷骰子";
    document.getElementById('challenge-input').value = "";
});

// --- 4. 聊天功能 (文字/图片/视频) ---

const sendMsg = (content, type = 'text') => {
    if (!content) return;
    socket.emit('chatMessage', { 
        roomId: currentRoomId, 
        sender: myName, 
        content, 
        type 
    });
};

document.getElementById('send-msg').onclick = () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
        sendMsg(input.value.trim(), 'text');
        input.value = "";
    }
};

// 处理文件上传（图片/视频）
document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 限制 2MB，防止 Base64 过大卡顿
        return alert("文件太大了，请发送 2MB 以内的图片或视频");
    }

    const reader = new FileReader();
    reader.onload = () => {
        const type = file.type.startsWith('image') ? 'image' : 'video';
        sendMsg(reader.result, type);
    };
    reader.readAsDataURL(file);
};

// 监听新消息
socket.on('newChatMessage', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg-item';
    
    let contentHtml = "";
    if (data.type === 'text') {
        contentHtml = `<span>${data.content}</span>`;
    } else if (data.type === 'image') {
        contentHtml = `<img src="${data.content}" class="chat-media" onclick="window.open(this.src)">`;
    } else if (data.type === 'video') {
        contentHtml = `<video src="${data.content}" controls class="chat-media"></video>`;
    }

    msgDiv.innerHTML = `<strong style="color:#ffd700">${data.sender}:</strong><br>${contentHtml}`;
    const container = document.getElementById('chat-messages');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight; // 自动滚动到底部
});

// 系统通知
socket.on('systemBroadcast', (text) => {
    document.getElementById('status-broadcast').innerText = text;
});

socket.on('error', (msg) => alert(msg));
