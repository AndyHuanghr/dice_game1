const socket = io();
let currentRoomId = null;
let myName = "";

// 聊天控制
const chatSidebar = document.getElementById('chat-sidebar');
const chatBox = document.getElementById('chat-box');
document.getElementById('toggle-chat').onclick = () => {
    chatBox.classList.toggle('hidden');
    chatSidebar.classList.toggle('chat-collapsed');
};

// 自动匹配昵称显示
socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    myName = data.nickname;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('current-room-id').innerText = data.roomId;
});

// 聊天发送
const sendMsg = (content, type = 'text') => {
    if(!content) return;
    socket.emit('chatMessage', { roomId: currentRoomId, sender: myName, content, type });
};

document.getElementById('send-msg').onclick = () => {
    const input = document.getElementById('chat-input');
    sendMsg(input.value);
    input.value = "";
};

document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => sendMsg(reader.result, file.type.startsWith('image') ? 'image' : 'video');
    reader.readAsDataURL(file);
};

socket.on('newChatMessage', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg-item';
    let html = `<strong>${data.sender}:</strong> `;
    if (data.type === 'text') html += `<span>${data.content}</span>`;
    else if (data.type === 'image') html += `<img src="${data.content}" class="chat-media">`;
    else if (data.type === 'video') html += `<video src="${data.content}" controls class="chat-media"></video>`;
    msgDiv.innerHTML = html;
    const container = document.getElementById('chat-messages');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
});

// 游戏逻辑
document.getElementById('btn-no-room').onclick = () => socket.emit('createRoom', { name: document.getElementById('nickname').value });
document.getElementById('btn-has-room').onclick = () => document.getElementById('room-input-area').classList.remove('hidden');
document.getElementById('btn-join').onclick = () => socket.emit('joinRoom', { roomId: document.getElementById('room-code-input').value, name: document.getElementById('nickname').value });

document.getElementById('btn-roll').onclick = () => {
    socket.emit('rollDice', { roomId: currentRoomId });
    document.getElementById('btn-roll').disabled = true;
};

socket.on('updatePlayers', (players) => {
    document.getElementById('players-list').innerHTML = players.map(p => `<div>👤 ${p.name}: ${p.roll || '⌛'}</div>`).join('');
});

socket.on('allRolled', (data) => {
    if (socket.id === data.loserId) document.getElementById('modal-loser').classList.remove('hidden');
    else if (socket.id === data.winnerId) {
        document.getElementById('modal-winner').classList.remove('hidden');
        document.getElementById('status-broadcast').innerText = "等待受罚者选择...";
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
    document.getElementById('final-challenge-text').innerText = `${data.winnerName} 的指令: ${data.content}`;
});

function handlePlayAgain() { socket.emit('playAgain', { roomId: currentRoomId }); }

socket.on('resetGameClient', () => {
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('btn-roll').disabled = false;
});

socket.on('systemBroadcast', (t) => document.getElementById('status-broadcast').innerText = t);
socket.on('error', (e) => alert(e));
