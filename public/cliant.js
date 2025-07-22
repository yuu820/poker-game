// クライアントサイドJavaScript
let socket;
let currentUser = null;
let currentRoom = null;
let isRegistrationMode = false;

// ページ読み込み後の初期化
document.addEventListener('DOMContentLoaded', function() {
    // Socket.IOサーバーに接続
    socket = io();
    
    // Socket.IOイベントリスナーの設定
    setupSocketListeners();
    
    // 初期画面表示
    showAuthScreen();
});

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('サーバーに接続しました');
    });
    
    socket.on('disconnect', () => {
        console.log('サーバーから切断されました');
    });
    
    socket.on('auth-success', (data) => {
        currentUser = data.userId;
        document.getElementById('authMessage').textContent = '';
        showLobbyScreen();
        updateUserInfo(data.userId, data.chips);
    });
    
    socket.on('auth-error', (message) => {
        document.getElementById('authMessage').textContent = message;
    });
    
    socket.on('lobby-update', (data) => {
        updateLobbyRooms(data.rooms);
    });
    
    socket.on('joined-room', (data) => {
        currentRoom = data.roomId;
        showGameScreen();
        updateGameDisplay(data.room);
    });
    
    socket.on('game-started', (data) => {
        updateGameDisplay(data.room);
        addGameMessage('ゲームが開始されました！');
    });
    
    socket.on('game-update', (data) => {
        updateGameDisplay(data.room);
        showBetControls(data.isYourTurn);
    });
    
    socket.on('game-ended', (data) => {
        updateGameDisplay(data.room);
        addGameMessage(`${data.winner}が${data.pot}チップを獲得しました！`);
        hideBetControls();
    });
    
    socket.on('player-joined', (data) => {
        addGameMessage(`${data.player.userId}が参加しました`);
    });
    
    socket.on('player-left', (data) => {
        addGameMessage(`${data.userId}が退室しました`);
    });
    
    socket.on('error', (message) => {
        alert(message);
    });
}

function toggleAuthMode() {
    isRegistrationMode = !isRegistrationMode;
    const title = document.getElementById('authTitle');
    const button = document.querySelector('button[onclick="handleAuth()"]');
    const toggleButton = document.querySelector('button[onclick="toggleAuthMode()"]');
    
    if (isRegistrationMode) {
        title.textContent = '新規登録';
        button.textContent = '新規登録';
        toggleButton.textContent = 'ログイン';
    } else {
        title.textContent = 'ログイン';
        button.textContent = 'ログイン';
        toggleButton.textContent = '新規登録';
    }
}

function handleAuth() {
    const userId = document.getElementById('userId').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!userId || !password) {
        document.getElementById('authMessage').textContent = 'ユーザーIDとパスワードを入力してください';
        return;
    }
    
    socket.emit('authenticate', {
        userId: userId,
        password: password,
        isRegistration: isRegistrationMode
    });
}

function logout() {
    if (currentRoom) {
        socket.emit('leave-room');
    }
    currentUser = null;
    currentRoom = null;
    showAuthScreen();
}

function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
}

function showLobbyScreen() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
}

function showGameScreen() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
}

function updateUserInfo(userId, chips) {
    document.getElementById('currentUser').textContent = userId;
    document.getElementById('userChips').textContent = chips;
    
    const gameChipsElement = document.getElementById('gameUserChips');
    if (gameChipsElement) {
        gameChipsElement.textContent = chips;
    }
}

function updateLobbyRooms(rooms) {
    rooms.forEach(room => {
        const element = document.getElementById(`room${room.id}Players`);
        if (element) {
            element.textContent = room.playerCount;
        }
    });
}

function joinRoom(roomId, bigBlind) {
    socket.emit('join-room', {
        roomId: roomId,
        bigBlind: bigBlind
    });
}

function leaveGame() {
    socket.emit('leave-room');
    currentRoom = null;
    showLobbyScreen();
}

function updateGameDisplay(room) {
    // ポット情報更新
    document.getElementById('potAmount').textContent = room.pot;
    
    // ゲームフェーズ更新
    const phaseText = {
        'waiting': 'ゲーム待機中...',
        'preflop': 'プリフロップ',
        'flop': 'フロップ',
        'turn': 'ターン',
        'river': 'リバー',
        'showdown': 'ショーダウン'
    };
    document.getElementById('gamePhase').textContent = phaseText[room.phase] || room.phase;
    
    // コミュニティカード表示
    updateCommunityCards(room.communityCards);
    
    // プレイヤー席表示
    updatePlayerSeats(room.players, room.currentPlayerIndex);
}

function updateCommunityCards(cards) {
    const container = document.getElementById('communityCards');
    container.innerHTML = '';
    
    // 最大5枚まで表示（空のカードスロットも含める）
    for (let i = 0; i < 5; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        if (i < cards.length && cards[i]) {
            const card = cards[i];
            cardDiv.classList.add(card.color);
            cardDiv.innerHTML = `
                <span class="value">${card.value}</span>
                <span class="suit">${card.suit}</span>
                <span class="value" style="transform: rotate(180deg);">${card.value}</span>
            `;
        } else {
            cardDiv.classList.add('hidden');
            cardDiv.innerHTML = '?';
        }
        
        container.appendChild(cardDiv);
    }
}

function updatePlayerSeats(players, currentPlayerIndex) {
    const container = document.getElementById('playerSeats');
    container.innerHTML = '';
    
    players.forEach((player, index) => {
        const seatDiv = document.createElement('div');
        seatDiv.className = `player-seat seat-${index}`;
        
        // 現在のプレイヤーをハイライト
        if (index === currentPlayerIndex) {
            seatDiv.classList.add('current-player');
        }
        
        // フォールドしたプレイヤーを表示
        if (player.folded) {
            seatDiv.classList.add('folded');
        }
        
        seatDiv.innerHTML = `
            <div class="player-name">${player.userId}</div>
            <div class="player-chips">💰 ${player.chips}</div>
            <div class="player-cards">
                ${createPlayerCards(player.cards)}
            </div>
            <div style="font-size: 0.8em; color: #ffd700;">
                ベット: ${player.bet}
            </div>
        `;
        
        container.appendChild(seatDiv);
    });
}

function createPlayerCards(cards) {
    return cards.map(card => {
        if (card.hidden) {
            return '<div class="card hidden">?</div>';
        } else {
            return `<div class="card ${card.color}">
                <span style="font-size: 8px;">${card.value}</span>
                <span style="font-size: 8px;">${card.suit}</span>
            </div>`;
        }
    }).join('');
}

function showBetControls(isYourTurn) {
    const controls = document.getElementById('betControls');
    if (isYourTurn) {
        controls.style.display = 'flex';
    } else {
        controls.style.display = 'none';
    }
}

function hideBetControls() {
    document.getElementById('betControls').style.display = 'none';
}

function playerAction(action) {
    const raiseInput = document.getElementById('raiseAmount');
    const amount = action === 'raise' ? parseInt(raiseInput.value) || 0 : 0;
    
    socket.emit('player-action', {
        action: action,
        amount: amount
    });
    
    // レイズ額をクリア
    raiseInput.value = '';
    
    hideBetControls();
}

function addGameMessage(message) {
    const messageArea = document.getElementById('gameMessages');
    const timestamp = new Date().toLocaleTimeString();
    messageArea.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    messageArea.scrollTop = messageArea.scrollHeight;
}
