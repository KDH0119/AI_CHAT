// chat.js
import { saveToStorage, loadFromStorage, getAllSessions, deleteFromStorage, generateChatId } from './storage.js';
import { showStatus, clearChatBox, appendMessage, elements, openModal, closeModal } from './ui.js';
import { state } from './main.js';

export function applyTemplate(characterInfo) {

    const userPrompt = characterInfo.main_prompt_1 || "You are a helpful AI assistant.";
    
    let characterSection = `
# User Information & Character Information\n`;
    
    // User 정보
    if (characterInfo.profile_name || characterInfo.profile_detail) {
        if (characterInfo.profile_name) {
            characterSection += `## [${characterInfo.profile_name}: (main user)] // role: user \n`;
        }
        if (characterInfo.profile_detail) {
            characterSection += `Profile Details: ${characterInfo.profile_detail}\n`;
        }
    }
    
    if (characterInfo.name || characterInfo.start_option || characterInfo.start_situation) {
        if (characterInfo.name) {
            characterSection += `## [ ${characterInfo.name}: (main character)] - role: assistant\n`;
        }
        if (characterInfo.prompt) {
            characterSection += `${characterInfo.prompt}\n`;
        }
    }

    return userPrompt + characterSection;
}

export function saveChat() {
    if (state.chatMessages.length === 0) return;
    if (!state.currentChatId) state.currentChatId = generateChatId();

    const sessionData = {
        id: state.currentChatId,
        title: state.characterInfo.name || "무제",
        date: new Date().toISOString(),
        messages: state.chatMessages,
        history: state.chatHistory,
        characterInfo: state.characterInfo,
        summary: state.currentSummary
    };
    
    saveToStorage(state.currentChatId, sessionData);
}

export function loadChatList() {
    const sessions = getAllSessions();
    const sessionArray = Object.values(sessions);
    sessionArray.sort((a, b) => new Date(b.date) - new Date(a.date));

    elements.chatList.innerHTML = '';
    if (sessionArray.length === 0) {
        elements.chatList.innerHTML = '<div style="text-align:center;color:#8b4513;font-size:0.85em;padding:20px;border:2px dashed #ffe8d6;border-radius:10px;background:#fff5f0;">저장된 채팅이 없습니다.</div>';
        return;
    }

    sessionArray.forEach(session => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        
        const date = new Date(session.date);
        const dateStr = date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
        const firstMessage = session.messages.find(msg => msg.type === 'user');
        const preview = firstMessage ? firstMessage.content.substring(0, 30) + '...' : '아직 대화 없음';

        chatItem.innerHTML = `
            <div class="chat-item-title">${session.title}</div>
            <div class="chat-item-date">${dateStr}</div>
            <div class="chat-item-preview">${preview}</div>
            <button class="edit-chat-btn" title="채팅방 정보 수정">✏️</button>
            <button class="delete-chat-btn" title="채팅방 삭제">🗑️</button>
        `;

        chatItem.querySelector('.edit-chat-btn').onclick = (e) => {
            e.stopPropagation();
            editChatSession(session.id);
        };
        
        chatItem.querySelector('.delete-chat-btn').onclick = (e) => {
            e.stopPropagation();
            deleteChatSession(session.id);
        };

        chatItem.addEventListener('click', () => loadChatSession(session.id));
        elements.chatList.appendChild(chatItem);
    });
}

export function loadChatSession(sessionId) {
    const session = loadFromStorage(sessionId);
    
    if (!session) {
        showStatus('채팅을 불러올 수 없습니다.', 'error');
        return;
    }

    if (state.chatMessages.length > 0 && !confirm('현재 대화를 삭제하고 선택한 채팅을 불러오시겠습니까?')) {
        return;
    }

    state.currentChatId = sessionId;
    state.chatMessages = session.messages || [];
    state.chatHistory = session.history || [];
    state.currentSummary = session.summary || null;
    
    // chatHistory가 model로 시작하면 수정
    if (state.chatHistory.length > 0 && state.chatHistory[0].role === 'model') {
        state.chatHistory.unshift({ role: "user", parts: [{ text: "[대화 시작]" }] });
    }
    
    if (session.characterInfo) {
        state.characterInfo = session.characterInfo;
        elements.characterTitle.textContent = state.characterInfo.name;
        state.systemPrompt = applyTemplate(state.characterInfo);
    }
    
    clearChatBox();
    state.chatMessages.forEach((message, index) => {
        appendMessage(message.type, message.content, message.isSummary, index);
    });

    showStatus('채팅을 불러왔습니다.', 'success');
}

export function editChatSession(sessionId) {
    const session = loadFromStorage(sessionId);
    
    if (!session) {
        showStatus('채팅을 찾을 수 없습니다.', 'error');
        return;
    }
    
    document.getElementById('edit-name').value = session.characterInfo?.name || '';
    document.getElementById('edit-main-prompt').value = session.characterInfo?.main_prompt_1 || 'main_prompt_1';
    document.getElementById('edit-profile-name').value = session.characterInfo?.profile_name || '';
    document.getElementById('edit-profile-detail').value = session.characterInfo?.profile_detail || '';
    document.getElementById('edit-prompt').value = session.characterInfo?.prompt || '';
    document.getElementById('edit-prolog').value = session.characterInfo?.prolog || '';
    document.getElementById('edit-start-option').value = session.characterInfo?.start_option || '';
    document.getElementById('edit-start-situation').value = session.characterInfo?.start_situation || '';
    
    document.getElementById('save-edit-btn').onclick = () => saveEditedSession(sessionId);
    openModal('edit-modal');
}

export function saveEditedSession(sessionId) {
    const session = loadFromStorage(sessionId);
    
    if (!session) {
        showStatus('채팅을 찾을 수 없습니다.', 'error');
        return;
    }
    
    const updatedInfo = {
        name: document.getElementById('edit-name').value || "무제",
        main_prompt_1: document.getElementById('edit-main-prompt').value,
        profile_name: document.getElementById('edit-profile-name').value,
        profile_detail: document.getElementById('edit-profile-detail').value,
        prompt: document.getElementById('edit-prompt').value,
        prolog: document.getElementById('edit-prolog').value,
        start_option: document.getElementById('edit-start-option').value,
        start_situation: document.getElementById('edit-start-situation').value
    };
    
    session.title = updatedInfo.name;
    session.characterInfo = updatedInfo;
    saveToStorage(sessionId, session);
    
    if (state.currentChatId === sessionId) {
        state.characterInfo = updatedInfo;
        elements.characterTitle.textContent = updatedInfo.name;
        state.systemPrompt = applyTemplate(updatedInfo);
        console.log(state.systemPrompt);
        showStatus('캐릭터 정보가 수정되었고 즉시 적용되었습니다.', 'success');
    }
    
    closeModal('edit-modal');
    loadChatList();
}

export function deleteChatSession(sessionId) {
    if (!confirm('정말로 이 채팅방을 삭제하시겠습니까?')) return;
    
    deleteFromStorage(sessionId);
    
    if (state.currentChatId === sessionId) {
        state.chatMessages = [];
        state.chatHistory = [];
        clearChatBox();
        state.currentChatId = null;
        state.currentSummary = null;
        showStatus('현재 채팅방이 삭제되었습니다.', 'warning');
    }
    
    loadChatList();
    showStatus('채팅방이 삭제되었습니다.', 'success');
}

window.saveChatHistory = function() {
    if (state.chatMessages.length === 0) {
        showStatus('저장할 대화가 없습니다.', 'warning');
        return;
    }

    saveChat();
    loadChatList();

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `chat_history_${timestamp}.txt`;
    
    let content = `=== 채팅 대화 저장 파일 ===\n`;
    content += `저장 날짜: ${now.toLocaleString('ko-KR')}\n`;
    content += `캐릭터: ${state.characterInfo.name}\n`;
    content += `총 메시지 수: ${state.chatMessages.length}\n\n`;
    
    if (state.currentSummary) {
        content += `=== 현재 적용된 요약 ===\n${state.currentSummary}\n=== 요약 끝 ===\n\n`;
    }
    
    content += `=== 대화 내용 시작 ===\n\n`;
    state.chatMessages.forEach((message, index) => {
        const timeStr = message.timestamp.toLocaleString('ko-KR');
        const separator = message.type === 'user' ? '[사용자]' : '[봇]';
        content += `${index + 1}. ${separator} (${timeStr})\n${message.content}\n--- 메시지 구분선 ---\n\n`;
    });
    content += `=== 대화 내용 종료 ===\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showStatus(`대화가 localStorage와 파일로 저장되었습니다.`, 'success');
}

window.clearChat = function() {
    if (state.chatMessages.length === 0) {
        showStatus('삭제할 대화가 없습니다.', 'warning');
        return;
    }

    if (confirm('정말로 현재 대화를 삭제하시겠습니까?')) {
        state.chatMessages = [];
        state.chatHistory = [];  // ⭐ 완전히 초기화
        clearChatBox();
        state.currentChatId = null;
        state.currentSummary = null;
        showStatus('대화가 삭제되었습니다.', 'success');
    }
}