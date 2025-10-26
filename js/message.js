import { showStatus, clearChatBox, appendMessage, openModal, closeModal } from './ui.js';
import { saveChat } from './chat.js';
import { state } from './main.js';
import { sendToGeminiStream } from './Api.js';
import { createBotMessageSpan } from './ui.js';

export async function rerollMessage(messageIndex) {
    const message = state.chatMessages[messageIndex];
    
    // 검증
    if (!message || message.type !== 'bot' || message.isSummary) {
        showStatus('리롤할 수 없는 메시지입니다.', 'warning');
        return;
    }
    
    const userMessage = state.chatMessages[messageIndex - 1];
    if (!userMessage || userMessage.type !== 'user') {
        showStatus('이전 사용자 메시지를 찾을 수 없습니다.', 'warning');
        return;
    }
    
    if (!confirm('이 AI 응답을 다시 생성하시겠습니까?')) return;
    
    // USER 메시지 내용 저장
    const userContent = userMessage.content;
    
    // AI 메시지 삭제
    state.chatMessages.splice(messageIndex, 1);
    state.chatHistory.pop();
    
    // USER 메시지도 삭제
    state.chatMessages.splice(messageIndex - 1, 1);
    state.chatHistory.pop();
    
    // UI에서 AI 메시지 삭제
    const aiMessageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
    if (aiMessageDiv) aiMessageDiv.remove();
    
    // UI에서 USER 메시지 삭제
    const userMessageDiv = document.querySelector(`[data-message-index="${messageIndex - 1}"]`);
    if (userMessageDiv) userMessageDiv.remove();
    
    // 기존 입력창에 넣고 전송
    const inputElement = document.getElementById('prompt-input');
    inputElement.value = userContent;
    document.getElementById('prompt-form').dispatchEvent(new Event('submit'));
}

window.rerollMessage = rerollMessage;

window.rerollMessage = rerollMessage;

export function editMessage(messageIndex) {
    const message = state.chatMessages[messageIndex];
    if (!message) return;
    
    const editTextarea = document.getElementById('edit-message-content');
    const saveBtn = document.getElementById('save-message-edit-btn');
    
    editTextarea.value = message.content;
    saveBtn.onclick = () => saveEditedMessage(messageIndex);
    
    openModal('edit-message-modal');
}

export function saveEditedMessage(messageIndex) {
    const newContent = document.getElementById('edit-message-content').value.trim();
    
    if (!newContent) {
        alert('메시지 내용을 입력하세요.');
        return;
    }
    
    const message = state.chatMessages[messageIndex];
    message.content = newContent;
    
    state.chatHistory = [];
    for (let i = 0; i < state.chatMessages.length; i++) {
        const msg = state.chatMessages[i];
        if (msg.type === 'user' && !msg.isSummary) {
            state.chatHistory.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.type === 'bot' && !msg.isSummary) {
            state.chatHistory.push({ role: "model", parts: [{ text: msg.content }] });
        }
    }
    
    if (state.chatHistory.length > 0 && state.chatHistory[0].role === 'model') {
        state.chatHistory.unshift({ role: "user", parts: [{ text: "[대화 시작]" }] });
    }
    
    clearChatBox();
    state.chatMessages.forEach((message, index) => {
        appendMessage(message.type, message.content, message.isSummary, index);
    });
    
    saveChat();
    closeModal('edit-message-modal');
    showStatus('메시지가 수정되었습니다.', 'success');
}

export function deleteMessage(messageIndex) {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
    
    state.chatMessages.splice(messageIndex, 1);
    
    state.chatHistory = [];
    for (let i = 0; i < state.chatMessages.length; i++) {
        const msg = state.chatMessages[i];
        if (msg.type === 'user' && !msg.isSummary) {
            state.chatHistory.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.type === 'bot' && !msg.isSummary) {
            state.chatHistory.push({ role: "model", parts: [{ text: msg.content }] });
        }
    }
    
    if (state.chatHistory.length > 0 && state.chatHistory[0].role === 'model') {
        state.chatHistory.unshift({ role: "user", parts: [{ text: "[대화 시작]" }] });
    }
    
    clearChatBox();
    state.chatMessages.forEach((message, index) => {
        appendMessage(message.type, message.content, message.isSummary, index);
    });
    
    saveChat();
    showStatus('메시지가 삭제되었습니다.', 'success');
}

window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.rerollMessage = rerollMessage;