import { state } from './main.js';

export const elements = {
    form: document.getElementById('prompt-form'),
    input: document.getElementById('prompt-input'),
    chatBox: document.getElementById('chat-box'),
    button: document.querySelector('#prompt-form button'),
    saveStatus: document.getElementById('save-status'),
    chatList: document.getElementById('chat-list'),
    characterTitle: document.getElementById('character-title')
};

export function showStatus(message, type = 'info') {
    const colors = {
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#6c757d'
    };
    
    elements.saveStatus.textContent = message;
    elements.saveStatus.style.color = colors[type] || colors.info;
    setTimeout(() => { elements.saveStatus.textContent = ''; }, 3000);
}

export function appendMessage(sender, text, isSummary = false, messageIndex = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (isSummary) messageDiv.classList.add('summary-message');
    if (messageIndex !== null) messageDiv.dataset.messageIndex = messageIndex;
    
    const messageSpan = document.createElement('span');
    if (isSummary) {
        messageSpan.style.whiteSpace = 'pre-wrap';
        messageSpan.textContent = text;
    } else {
        messageSpan.innerHTML = marked.parse(text);
    }
    
    messageDiv.appendChild(messageSpan);

    if (sender === 'bot' && !isSummary) {
    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'reroll-message-btn';
    rerollBtn.innerHTML = '🔄';
    rerollBtn.title = '메시지 리롤';
    messageDiv.appendChild(rerollBtn);
}

    
    // ⭐ 수정 버튼 (onclick 제거)
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-message-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = '메시지 수정';
    messageDiv.appendChild(editBtn);
    
    // ⭐ 삭제 버튼 (onclick 제거)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-message-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '메시지 삭제';
    messageDiv.appendChild(deleteBtn);
    
    elements.chatBox.appendChild(messageDiv);
    elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

export function createBotMessageSpan() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot');
    const messageSpan = document.createElement('span');
    messageSpan.textContent = '...';
    messageDiv.appendChild(messageSpan);
    elements.chatBox.appendChild(messageDiv);
    return messageSpan;
}

export function clearChatBox() {
    elements.chatBox.innerHTML = '';
}

export function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

export function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

window.openModal = openModal;
window.closeModal = closeModal;


window.closeEditModal = () => closeModal('edit-modal');
window.closeSummaryModal = () => closeModal('summary-modal');
window.closeSummaryResultModal = () => closeModal('summary-result-modal');
window.closeEditMessageModal = () => closeModal('edit-message-modal');
window.closeCustomSettingModal = () => closeModal('custom-setting-modal');

// state는 main.js에서 전역으로 접근 가능
window.openCustomSettingModal = function() {
    const customSettingContent = document.getElementById('custom-setting-content');
    const customSettingCount = document.getElementById('custom-setting-count');
    
    // ⭐ state.characterInfo에서 불러오기 (window.state로 접근)
    const savedCustomSetting = window.state?.characterInfo?.customSetting || '';
    customSettingContent.value = savedCustomSetting;
    customSettingCount.textContent = savedCustomSetting.length;
    
    // 글자 수 카운터 이벤트 리스너
    customSettingContent.oninput = function() {
        const currentLength = this.value.length;
        customSettingCount.textContent = currentLength;
        
        if (currentLength > 4500) {
            customSettingCount.style.color = '#e74c3c';
        } else {
            customSettingCount.style.color = '#666666';
        }
    };
    
    openModal('custom-setting-modal');
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

window.toggleOptionsSidebar = function() {
    const optionsSidebar = document.getElementById('options-sidebar');
    const overlay = document.querySelector('.options-overlay');
    
    optionsSidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (optionsSidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

window.closeOptionsSidebar = function() {
    const optionsSidebar = document.getElementById('options-sidebar');
    const overlay = document.querySelector('.options-overlay');
    
    optionsSidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('api-key-input');
    
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        window.updateApiKey(savedApiKey); // 초기화
    }
    
    apiKeyInput.addEventListener('input', function() {
        window.updateApiKey(this.value.trim());
    });
});

window.saveApiKey = function() {
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        apiKeyStatus.textContent = '⚠️ API Key를 입력하세요';
        apiKeyStatus.style.color = '#ffc107';
        setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
        return;
    }
    
    localStorage.setItem('gemini_api_key', apiKey);
    
    apiKeyStatus.textContent = '✅ 저장됨';
    apiKeyStatus.style.color = '#28a745';
    setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
}

// 다크모드 토글 함수
window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
    
    // 다크모드 상태를 localStorage에 저장
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark_mode', isDarkMode ? 'enabled' : 'disabled');
    
    // 버튼 텍스트 변경
    const darkModeBtn = document.querySelector('.dark-mode-button');
    if (darkModeBtn) {
        darkModeBtn.textContent = isDarkMode ? '☀️ 라이트모드' : '🌙 다크모드';
    }
}

// 페이지 로드 시 다크모드 상태 복원
document.addEventListener('DOMContentLoaded', function() {
    const darkModeStatus = localStorage.getItem('dark_mode');
    if (darkModeStatus === 'enabled') {
        document.body.classList.add('dark-mode');
        const darkModeBtn = document.querySelector('.dark-mode-button');
        if (darkModeBtn) {
            darkModeBtn.textContent = '☀️ 라이트모드';
        }
    }
});