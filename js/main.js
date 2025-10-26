import { elements, showStatus, appendMessage, createBotMessageSpan, clearChatBox } from './ui.js';
import { loadChatList, applyTemplate, saveChat } from './chat.js';
import { sendToGeminiStream } from './Api.js';
import { editMessage, deleteMessage, rerollMessage } from './message.js';
import { openSummaryModal } from './summary.js'; // ⭐ import 추가

export const state = {
    chatHistory: [],
    chatMessages: [],
    currentChatId: null,
    systemPrompt: "",
    characterInfo: {},
    currentSummary: null
};

// ⭐ window 객체에도 추가하여 다른 파일에서 접근 가능하게
window.state = state;

marked.setOptions({ gfm: true, breaks: true });

document.addEventListener('DOMContentLoaded', function() {

    
    const summaryBtn = document.getElementById('summary-btn') || document.querySelector('.summary-button');
    const saveBtn = document.getElementById('save-btn') || document.querySelector('.save-button');
    const clearBtn = document.getElementById('clear-btn') || document.querySelector('.clear-button');
    
    if (summaryBtn) {
        summaryBtn.addEventListener('click', openSummaryModal);
        console.log('요약 버튼 이벤트 등록 완료');
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            window.saveChatHistory();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            window.clearChat();
        });
    }
    
    elements.chatBox.addEventListener('click', function(e) {

        if (e.target.classList.contains('reroll-message-btn') || e.target.closest('.reroll-message-btn')) {
            e.stopPropagation();
            const btn = e.target.classList.contains('reroll-message-btn') ? e.target : e.target.closest('.reroll-message-btn');
            const messageDiv = btn.closest('.message');
            const index = parseInt(messageDiv.dataset.messageIndex);
            if (!isNaN(index)) {
                rerollMessage(index);
            }
        }
        if (e.target.classList.contains('edit-message-btn') || e.target.closest('.edit-message-btn')) {
            e.stopPropagation();
            const btn = e.target.classList.contains('edit-message-btn') ? e.target : e.target.closest('.edit-message-btn');
            const messageDiv = btn.closest('.message');
            const index = parseInt(messageDiv.dataset.messageIndex);
            console.log('수정 버튼 클릭:', index);
            if (!isNaN(index)) {
                editMessage(index);
            }
        }
        
        if (e.target.classList.contains('delete-message-btn') || e.target.closest('.delete-message-btn')) {
            e.stopPropagation();
            const btn = e.target.classList.contains('delete-message-btn') ? e.target : e.target.closest('.delete-message-btn');
            const messageDiv = btn.closest('.message');
            const index = parseInt(messageDiv.dataset.messageIndex);
            console.log('삭제 버튼 클릭:', index);
            if (!isNaN(index)) {
                deleteMessage(index);
            }
        }
    });
    
    const characterData = JSON.parse(localStorage.getItem('characterFormData') || '{}');
    
    if (Object.keys(characterData).length > 0) {
            state.characterInfo = {
                name: characterData.name || "테스트 캐릭터",
                main_prompt_1: characterData.main_prompt_1,
                profile_name: characterData.profile_name || "",
                profile_detail: characterData.profile_detail || "",
                prompt: characterData.prompt || "",
                prolog: characterData.prolog || "",
                start_option: characterData.start_option || "",
                start_situation: characterData.start_situation || "",
                customSetting: ""  // ⭐ 항상 빈 값으로 시작
        };
        
        elements.characterTitle.textContent = characterData.name;
        state.systemPrompt = applyTemplate(state.characterInfo);
        
        if (characterData.chatId) state.currentChatId = characterData.chatId;
        
        if (characterData.prolog && characterData.prolog.trim()) {
            const firstMessage = { 
                type: 'bot', 
                content: characterData.prolog, 
                timestamp: new Date() 
            };
            state.chatMessages.push(firstMessage);
            appendMessage('bot', characterData.prolog, false, 0);
            
            if (characterData.start_situation && characterData.start_situation.trim()) {
                const systemContext = `[시작 상황: ${characterData.start_situation.trim()}]`;
                state.chatHistory.push({ role: "user", parts: [{ text: systemContext }] });
                state.chatHistory.push({ role: "model", parts: [{ text: characterData.prolog }] });
            } else {
                state.chatHistory.push({ role: "user", parts: [{ text: "[대화 시작]" }] });
                state.chatHistory.push({ role: "model", parts: [{ text: characterData.prolog }] });
            }
        }
        
        localStorage.removeItem('characterFormData');
        showStatus('캐릭터가 로드되었습니다.', 'success');
    } else {
        state.characterInfo = {
            name: "테스트 캐릭터",
            template: "main_prompt_1",
            profile_name: "",
            profile_detail: "",
            prompt: "",
            prolog: "",
            start_option: "",
            start_situation: "",
            customSetting: localStorage.getItem('custom_setting') || ""
        };
        state.systemPrompt = "You are a helpful AI assistant.";
        showStatus('기본 캐릭터로 시작합니다.', 'info');
    }
    
    loadChatList();
});

elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = elements.input.value.trim();
    if (!prompt) return;

    const userMessage = { 
        type: 'user', 
        content: prompt, 
        timestamp: new Date() 
    };
    state.chatMessages.push(userMessage);
    const userIndex = state.chatMessages.length - 1;
    appendMessage('user', prompt, false, userIndex);
    elements.input.value = '';
    elements.button.disabled = true;
    
    state.chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    console.log(state.chatHistory);
    const botMessageSpan = createBotMessageSpan();

    try {
        let fullBotResponse = '';
        
        for await (const chunkText of sendToGeminiStream(
            prompt, 
            state.chatHistory.slice(0, -1), 
            state.systemPrompt
        )) {
            fullBotResponse += chunkText;
            botMessageSpan.innerHTML = marked.parse(fullBotResponse);
            elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
        }
        
        const botMessage = { 
            type: 'bot', 
            content: fullBotResponse, 
            timestamp: new Date() 
        };
        state.chatMessages.push(botMessage);
        state.chatHistory.push({ role: "model", parts: [{ text: fullBotResponse }] });

        const botMessageDiv = botMessageSpan.parentElement;
        const botIndex = state.chatMessages.length - 1;
        botMessageDiv.dataset.messageIndex = botIndex;
        const rerollBtn = document.createElement('button');
        rerollBtn.className = 'reroll-message-btn';
        rerollBtn.innerHTML = '🔄';
        rerollBtn.title = '메시지 리롤';
        botMessageDiv.appendChild(rerollBtn);
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-message-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = '메시지 수정';
        botMessageDiv.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-message-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '메시지 삭제';
        botMessageDiv.appendChild(deleteBtn);

        saveChat();
        loadChatList();

    } catch (error) {
        botMessageSpan.textContent = '오류: ' + error.message;
        console.error('API Error:', error);
        state.chatHistory.pop();
        state.chatMessages.pop();
    } finally {
        elements.button.disabled = false;
        elements.input.focus();
    }
});

// PC: Shift+Enter로 줄바꿈, Enter로 전송
// 모바일: Enter로 줄바꿈, 전송 버튼으로만 전송
elements.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // 모바일: Enter만 누르면 줄바꿈 (기본 동작)
            // 아무것도 하지 않음 (줄바꿈이 자동으로 됨)
            return;
        } else {
            // PC: Shift 없이 Enter만 누르면 전송
            if (!e.shiftKey) {
                e.preventDefault();
                elements.form.dispatchEvent(new Event('submit'));
            }
        }
    }
});

// textarea 자동 높이 조절
elements.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px'; // 최대 200px
});


document.getElementById('edit-modal').addEventListener('click', function(e) {
    if (e.target === this) window.closeEditModal();
});

document.getElementById('summary-modal').addEventListener('click', function(e) {
    if (e.target === this) window.closeSummaryModal();
});

document.getElementById('summary-result-modal').addEventListener('click', function(e) {
    if (e.target === this) window.closeSummaryResultModal();
});

document.getElementById('edit-message-modal').addEventListener('click', function(e) {
    if (e.target === this) window.closeEditMessageModal();
});

document.getElementById('custom-setting-modal').addEventListener('click', function(e) {
    if (e.target === this) window.closeCustomSettingModal();
});

// 커스텀 설정 저장 버튼
document.getElementById('save-custom-setting-btn').addEventListener('click', function() {
    const customSettingContent = document.getElementById('custom-setting-content').value.trim();
    
    // ⭐ localStorage 제거, characterInfo에만 저장
    state.characterInfo.customSetting = customSettingContent;
    
    // systemPrompt 재생성
    state.systemPrompt = applyTemplate(state.characterInfo);
    
    // 현재 세션 저장 (있으면)
    if (state.currentChatId) {
        saveChat();
    }
    
    window.closeCustomSettingModal();
    showStatus('커스텀 설정이 저장되었습니다.', 'success');
});

elements.input.focus();