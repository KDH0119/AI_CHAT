// summary.js
import { getSummarySystemPrompt, DEFAULT_SUMMARY_LEVEL } from './config.js';
import { sendToGemini } from './Api.js';
import { showStatus, clearChatBox, appendMessage, openModal, closeModal } from './ui.js';
import { saveChat } from './chat.js';
import { state } from './main.js';

const SUMMARY_LEVEL_STORAGE_KEY = 'summary_level';

const clampSummaryLevel = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_SUMMARY_LEVEL;
    return Math.min(10, Math.max(0, num));
};

let summaryLevel = clampSummaryLevel(localStorage.getItem(SUMMARY_LEVEL_STORAGE_KEY));

export function openSummaryModal() {
    if (state.chatMessages.length === 0) {
        showStatus('요약할 대화가 없습니다.', 'warning');
        return;
    }

    const totalTurns = Math.floor(state.chatMessages.length / 2);
    if (totalTurns === 0) {
        showStatus('요약하기에 대화가 부족합니다.', 'warning');
        return;
    }

    document.getElementById('summary-total-info').innerHTML =
        `현재 <strong>${totalTurns}턴</strong>의 대화가 저장돼 있어요.`;
    document.getElementById('summary-hint').textContent =
        `1 ~ ${totalTurns} 사이의 숫자를 입력해 주세요.`;
    document.getElementById('summary-turns').max = totalTurns;
    document.getElementById('summary-turns').value = Math.min(20, totalTurns);

    const summaryLevelInput = document.getElementById('summary-level');
    if (summaryLevelInput) {
        summaryLevelInput.value = summaryLevel;
        summaryLevelInput.oninput = function () {
            if (this.value === '') return;
            const clamped = clampSummaryLevel(this.value);
            if (clamped !== Number(this.value)) {
                this.value = clamped;
            }
        };
    }

    const updatePreview = () => {
        const turns = parseInt(document.getElementById('summary-turns').value, 10) || 0;
        const preview = document.getElementById('summary-preview');
        if (turns > 0 && turns <= totalTurns) {
            const startTurn = Math.max(1, totalTurns - turns + 1);
            preview.innerHTML =
                `<strong>예시:</strong> ${totalTurns}턴 중 ${turns}턴을 입력하면 <br>${startTurn}턴 ~ ${totalTurns}턴이 요약돼요.`;
        } else {
            preview.innerHTML =
                `<strong>예시:</strong> 1 ~ ${totalTurns} 사이의 숫자를 입력해 주세요.`;
        }
    };

    updatePreview();
    document.getElementById('summary-turns').oninput = updatePreview;
    document.getElementById('execute-summary-btn').onclick = executeSummary;
    openModal('summary-modal');
}

export async function executeSummary() {
    const turnsInput = document.getElementById('summary-turns');
    const turns = parseInt(turnsInput.value, 10);
    const totalTurns = Math.floor(state.chatMessages.length / 2);
    const levelInput = document.getElementById('summary-level');

    if (levelInput && levelInput.value === '') {
        alert('0 ~ 10 사이 숫자로 요약 레벨을 입력해 주세요.');
        levelInput.focus();
        return;
    }

    if (!turns || turns < 1 || turns > totalTurns) {
        alert(`1 ~ ${totalTurns} 사이의 값을 입력해 주세요.`);
        return;
    }

    const executeBtn = document.getElementById('execute-summary-btn');
    executeBtn.disabled = true;
    executeBtn.textContent = '요약 중...';

    try {
        if (levelInput) {
            summaryLevel = clampSummaryLevel(levelInput.value);
            localStorage.setItem(SUMMARY_LEVEL_STORAGE_KEY, String(summaryLevel));
            levelInput.value = summaryLevel;
        }

        const preserveTurns = 10;
        const preserveMessages = Math.min(preserveTurns * 2, state.chatMessages.length);

        let dialogueText = '';
        for (let i = 0; i < state.chatMessages.length; i++) {
            const msg = state.chatMessages[i];
            const speaker = msg.type === 'user'
                ? state.characterInfo.profile_name || '사용자'
                : state.characterInfo.name || '캐릭터';
            dialogueText += `${speaker}: ${msg.content}\n\n`;
        }

        let summaryPrompt = dialogueText;
        if (state.currentSummary) {
            summaryPrompt = `${state.currentSummary}\n\n[최신 대화]\n${dialogueText}`;
        }

        const systemPrompt = getSummarySystemPrompt(summaryLevel);
        const summaryText = await sendToGemini(summaryPrompt, systemPrompt);
        state.currentSummary = summaryText;

        const summaryMessage = {
            type: 'bot',
            content: `📌 **채팅 요약 (1~${totalTurns}턴, 레벨 ${summaryLevel})**\n\n${summaryText}`,
            timestamp: new Date(),
            isSummary: true
        };

        let startIndex = Math.max(0, state.chatMessages.length - preserveMessages);

        while (startIndex < state.chatMessages.length &&
               state.chatMessages[startIndex].type !== 'user') {
            startIndex++;
        }

        const recentMessages = state.chatMessages.slice(startIndex);

        state.chatMessages = [...recentMessages, summaryMessage];

        clearChatBox();
        state.chatMessages.forEach((message, index) => {
            appendMessage(message.type, message.content, message.isSummary, index);
        });

        state.chatHistory = [];

        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            if (msg.type === 'user') {
                state.chatHistory.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (!msg.isSummary) {
                state.chatHistory.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }

        if (state.chatHistory.length > 0 && state.chatHistory[0].role === 'model') {
            state.chatHistory.unshift({ role: 'user', parts: [{ text: '[대화 시작]' }] });
        }

        state.chatHistory.push({ role: 'user', parts: [{ text: '지금까지 내용을 요약해 줘.' }] });
        state.chatHistory.push({ role: 'model', parts: [{ text: summaryText }] });

        saveChat();
        closeModal('summary-modal');
        showStatus(`${totalTurns}턴의 대화를 요약했어요. (최근 ${preserveTurns}개 문답 보존)`, 'success');

        document.getElementById('summary-success-text').textContent =
            `${totalTurns}턴의 대화를 성공적으로 요약했어요.`;
        document.getElementById('summary-result-content').textContent = summaryText;
        openModal('summary-result-modal');
    } catch (error) {
        console.error('요약 오류:', error);
        showStatus('요약 실행 중 오류가 발생했어요: ' + error.message, 'error');
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = '요약 실행';
    }
}

window.openSummaryModal = openSummaryModal;
