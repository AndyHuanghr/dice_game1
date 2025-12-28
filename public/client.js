const socket = io();

// 状态变量
let myRoomId = null;
let myNickname = "";

// DOM 元素
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const roomInputArea = document.getElementById('room-input-area');
const playersList = document.getElementById('players-list');
const btnRoll = document.getElementById('btn-roll');
const modalLoser = document.getElementById('modal-loser');
const modalWinner = document.getElementById('modal-winner');
const resultDisplay = document.getElementById('result-display');

// --- 房间选择逻辑 ---

// 选项A: 无房间号 -> 随机生成并进入
document.getElementById('btn-no-room').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value;
    if (!nickname) return alert("请先输入昵称！");
    
    // 生成6位随机数
    const randomRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    enterRoom(randomRoomId, nickname);
});

// 选项B: 有房间号 -> 显示输入框
document.getElementById('btn-has-room').addEventListener('click', () => {
    roomInputArea.classList.remove('hidden');
});

// 点击进入房间按钮
document.getElementById('btn-join').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value;
    const code = document.getElementById('room-code-input').value;
    if (!nickname || !code) return alert("请填写昵称和房间号！");
    enterRoom(code, nickname);
});

function enterRoom(roomId, nickname) {
    myRoomId = roomId;
    myNickname = nickname;
    
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    document.getElementById('current-room-id').innerText = roomId;

    socket.emit('joinRoom', { roomId, nickname });
}

// --- 游戏逻辑 ---

// 更新玩家列表
socket.on('updatePlayerList', (players) => {
    playersList.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.id = `player-${p.id}`;
        div.innerHTML = `<div>${p.nickname}</div><div class="dice-val">-</div>`;
        playersList.appendChild(div);
    });
});

// 点击掷骰子
btnRoll.addEventListener('click', () => {
    socket.emit('rollDice', { roomId: myRoomId });
    btnRoll.disabled = true;
    btnRoll.innerText = "已投掷";
});

// 显示某人投掷的结果
socket.on('playerRolled', ({ id, roll }) => {
    const pCard = document.querySelector(`#player-${id} .dice-val`);
    if (pCard) pCard.innerText = `${roll} 点`;
});

// --- 结算逻辑 ---

socket.on('gameResult', ({ minId, maxId, minVal, maxVal }) => {
    alert(`结果出炉！\n最低点: ${minVal}\n最高点: ${maxVal}`);

    if (socket.id === minId) {
        // 我是倒霉蛋
        modalLoser.classList.remove('hidden');
    } else if (socket.id === maxId) {
        // 我是国王，等待倒霉蛋选择
        modalWinner.classList.remove('hidden');
        document.getElementById('loser-choice-display').innerText = "等待对方选择...";
    } else {
        // 围观群众
        document.getElementById('my-status').innerText = "等待惩罚结果...";
    }
});

// 最低分做出选择
function makeChoice(choice) {
    socket.emit('selectChoice', { roomId: myRoomId, choice });
    modalLoser.classList.add('hidden');
    document.getElementById('my-status').innerText = `你选择了 ${choice}，等待国王出题...`;
}

// 所有人接收最低分的选择
socket.on('playerMadeChoice', ({ choice }) => {
    // 只有国王的弹窗需要更新这个信息
    const loserChoiceDisplay = document.getElementById('loser-choice-display');
    if (loserChoiceDisplay) {
        loserChoiceDisplay.innerText = choice;
    }
    // 可以在公屏上也显示一下
    const status = document.getElementById('my-status');
    if(status) status.innerText = `受罚者选择了：${choice}`;
});

// 国王提交挑战
function submitChallenge() {
    const text = document.getElementById('challenge-input').value;
    if (!text) return alert("请输入内容");
    socket.emit('sendChallenge', { roomId: myRoomId, challengeText: text });
    modalWinner.classList.add('hidden');
}

// 所有人展示最终挑战
socket.on('receiveChallenge', ({ challengeText }) => {
    modalLoser.classList.add('hidden'); // 确保关闭
    modalWinner.classList.add('hidden'); // 确保关闭
    resultDisplay.classList.remove('hidden');
    
    document.getElementById('final-challenge-text').innerText = challengeText;
});