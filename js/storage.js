import { STORAGE_KEY } from './config.js';

export function saveToStorage(chatId, data) {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    sessions[chatId] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function loadFromStorage(chatId) {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return sessions[chatId] || null;
}

export function getAllSessions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
}

export function deleteFromStorage(chatId) {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete sessions[chatId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}