// api.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { MODEL_NAME } from './config.js';

let API_KEY = localStorage.getItem('gemini_api_key') || "";
let genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

let tokenStats = {
    totalPromptTokens: 0,
    totalCachedTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
    sessionStartTime: new Date(),
    totalBilledTokens: 0,
    totalCostUSD: 0
};

const PRICING = {
    INPUT_BASE: 1.25,        // $1.25 per 1M input tokens
    INPUT_LONG: 2.50,        // $2.50 per 1M input tokens (>200K context)
    OUTPUT_BASE: 10.0,       // $10 per 1M output tokens
    OUTPUT_LONG: 15.0,       // $15 per 1M output tokens (>200K context)
    CACHE_DISCOUNT: 0.25,    // 캐시된 토큰은 25%만 청구
    USD_TO_KRW: 1380         // 환율 (대략)
};

const SAFETY_SETTINGS = [
    {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "OFF"
    },
    {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "OFF"
    },
    {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "OFF"
    },
    {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "OFF"
    }
];

const RETRY_DELAY_MS = 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

window.updateApiKey = function(newApiKey) {
    API_KEY = newApiKey;
    genAI = newApiKey ? new GoogleGenerativeAI(newApiKey) : null;
}

function calculateCost(promptTokens, cachedTokens, outputTokens, isLongContext = false) {

    const newInputTokens = promptTokens - cachedTokens;
    const cachedBilledTokens = cachedTokens * PRICING.CACHE_DISCOUNT;
    const totalBilledInputTokens = newInputTokens + cachedBilledTokens;
    
    const totalBilledTokens = totalBilledInputTokens + outputTokens;
    
    const inputPrice = isLongContext ? PRICING.INPUT_LONG : PRICING.INPUT_BASE;
    const outputPrice = isLongContext ? PRICING.OUTPUT_LONG : PRICING.OUTPUT_BASE;
    
    const inputCost = (totalBilledInputTokens / 1_000_000) * inputPrice;
    const outputCost = (outputTokens / 1_000_000) * outputPrice;
    const totalCostUSD = inputCost + outputCost;
    const totalCostKRW = totalCostUSD * PRICING.USD_TO_KRW;
    
    return {
        totalBilledTokens,
        totalBilledInputTokens,
        totalCostUSD,
        totalCostKRW,
        inputCost,
        outputCost
    };
}

function logTokenUsage(usageMetadata, requestType = "채팅") {
    console.log('📊 usageMetadata 원본:', usageMetadata);
    
    if (!usageMetadata) {
        console.warn('⚠️ 토큰 사용량 정보를 찾을 수 없습니다.');
        return;
    }

    const promptTokens = usageMetadata.promptTokenCount || 
                        usageMetadata.prompt_token_count || 
                        usageMetadata.inputTokens || 
                        0;
    const cachedTokens = usageMetadata.cachedContentTokenCount || 
                        usageMetadata.cached_content_token_count ||
                        usageMetadata.cachedTokens ||
                        0;
    const candidatesTokens = usageMetadata.candidatesTokenCount || 
                            usageMetadata.candidates_token_count ||
                            0;
    const thoughtsTokens = usageMetadata.thoughtsTokenCount || 
                          usageMetadata.thoughts_token_count ||
                          0;
    const outputTokens = candidatesTokens + thoughtsTokens;
    
    const totalTokens = usageMetadata.totalTokenCount || 
                       usageMetadata.total_token_count ||
                       (promptTokens + outputTokens) ||
                       0;

    const actualPromptTokens = promptTokens - cachedTokens;
    const cachingRate = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : 0;
    const savedTokens = Math.floor(cachedTokens * 0.75);
    
    const isLongContext = promptTokens > 200_000;
    
    const cost = calculateCost(promptTokens, cachedTokens, outputTokens, isLongContext);

    tokenStats.totalPromptTokens += promptTokens;
    tokenStats.totalCachedTokens += cachedTokens;
    tokenStats.totalOutputTokens += outputTokens;
    tokenStats.totalRequests += 1;
    tokenStats.totalBilledTokens += cost.totalBilledTokens;
    tokenStats.totalCostUSD += cost.totalCostUSD;

    console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`┃ [${requestType}] 토큰 사용량 분석`);
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`┃ 전송한 프롬프트 토큰: ${promptTokens.toLocaleString()} 토큰`);
    console.log(`┃ 캐시 적중 토큰: ${cachedTokens.toLocaleString()} 토큰 (${cachingRate}%)`);
    console.log(`┃ 실제 소비 프롬프트 토큰: ${actualPromptTokens.toLocaleString()} 토큰`);
    console.log(`┃ 캐싱 절감 토큰: ${savedTokens.toLocaleString()} 토큰 (75% 할인)`);
    console.log(`┃ AI 응답 토큰: ${candidatesTokens.toLocaleString()} 토큰`);
    if (thoughtsTokens > 0) {
        console.log(`┃ AI 사고 토큰: ${thoughtsTokens.toLocaleString()} 토큰`);
    }
    console.log(`┃ 총 출력 토큰: ${outputTokens.toLocaleString()} 토큰`);
    console.log(`┃ 총 토큰: ${totalTokens.toLocaleString()} 토큰`);
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`┃ 💰 실제 청구 토큰: ${Math.round(cost.totalBilledTokens).toLocaleString()} 토큰`);
    console.log(`┃    ├─ 입력(청구): ${Math.round(cost.totalBilledInputTokens).toLocaleString()} 토큰`);
    console.log(`┃    │   ├─ 신규: ${actualPromptTokens.toLocaleString()} (100%)`);
    console.log(`┃    │   └─ 캐시: ${cachedTokens.toLocaleString()} → ${Math.round(cachedTokens * 0.25).toLocaleString()} (25%)`);
    console.log(`┃    └─ 출력(청구): ${outputTokens.toLocaleString()} 토큰 (100%)`);
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`┃ 💵 이번 요청 비용`);
    console.log(`┃    ├─ 입력 비용: $${cost.inputCost.toFixed(6)} (₩${Math.round(cost.inputCost * PRICING.USD_TO_KRW).toLocaleString()})`);
    console.log(`┃    ├─ 출력 비용: $${cost.outputCost.toFixed(6)} (₩${Math.round(cost.outputCost * PRICING.USD_TO_KRW).toLocaleString()})`);
    console.log(`┃    └─ 총 비용: $${cost.totalCostUSD.toFixed(6)} (₩${Math.round(cost.totalCostKRW).toLocaleString()})`);
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (cachedTokens > 0) {
        const withoutCacheCost = calculateCost(promptTokens, 0, outputTokens, isLongContext);
        const savedCost = withoutCacheCost.totalCostUSD - cost.totalCostUSD;
        console.log(`✅ 캐싱 적용! ${cachingRate}%의 토큰이 재사용되었습니다.`);
        console.log(`💰 절감 효과: $${savedCost.toFixed(6)} (₩${Math.round(savedCost * PRICING.USD_TO_KRW).toLocaleString()}) 비용 절감`);
    } else {
        console.log(`ℹ️ 캐시 미적용 (최소 토큰 수 미달 또는 새 요청)`);
    }
    
    if (isLongContext) {
        console.log(`⚠️ 긴 컨텍스트 요금 적용됨 (200K 토큰 초과)`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

window.showTokenStats = function() {
    const sessionDuration = Math.floor((new Date() - tokenStats.sessionStartTime) / 1000 / 60);
    const avgCachingRate = tokenStats.totalPromptTokens > 0 
        ? ((tokenStats.totalCachedTokens / tokenStats.totalPromptTokens) * 100).toFixed(1) 
        : 0;
    const totalSaved = Math.floor(tokenStats.totalCachedTokens * 0.75);
    const totalCostKRW = tokenStats.totalCostUSD * PRICING.USD_TO_KRW;

    console.log('\n');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║       📈 세션 토큰 사용량 통계           ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║ 세션 시작: ${tokenStats.sessionStartTime.toLocaleTimeString('ko-KR')}`);
    console.log(`║ 세션 시간: ${sessionDuration}분`);
    console.log(`║ 총 요청 수: ${tokenStats.totalRequests}회`);
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║ 총 프롬프트 토큰: ${tokenStats.totalPromptTokens.toLocaleString()}`);
    console.log(`║ 총 캐시 토큰: ${tokenStats.totalCachedTokens.toLocaleString()}`);
    console.log(`║ 총 응답 토큰: ${tokenStats.totalOutputTokens.toLocaleString()}`);
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║ 평균 캐싱률: ${avgCachingRate}%`);
    console.log(`║ 총 절감 토큰: ${totalSaved.toLocaleString()}`);
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║ 💰 실제 청구 토큰: ${Math.round(tokenStats.totalBilledTokens).toLocaleString()}`);
    console.log(`║ 💵 총 비용: $${tokenStats.totalCostUSD.toFixed(4)}`);
    console.log(`║ 💴 총 비용: ₩${Math.round(totalCostKRW).toLocaleString()}`);
    console.log('╚═══════════════════════════════════════════╝\n');
}

window.resetTokenStats = function() {
    tokenStats = {
        totalPromptTokens: 0,
        totalCachedTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        sessionStartTime: new Date(),
        totalBilledTokens: 0,
        totalCostUSD: 0
    };
    console.log('토큰 통계가 초기화되었습니다.');
}

export async function sendToGemini(prompt, systemInstruction = "") {
    if (!genAI) {
        throw new Error("⚠️ API Key를 먼저 입력해 주세요!");
    }
    
    while (true) {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: systemInstruction,
            safetySettings: SAFETY_SETTINGS
        });
        
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            if (response.usageMetadata) {
                logTokenUsage(response.usageMetadata, "요약");
            }
            
            return response.text();
        } catch (error) {
            
            if (error.status === 503 || error.message?.includes('503')) {
                console.warn("503 응답 수신: 잠시 후 다시 시도합니다.");
                await delay(RETRY_DELAY_MS);
                continue;
            }
            throw error;
        }
    }
}

export async function* sendToGeminiStream(prompt, history = [], systemInstruction = "") {
    if (!genAI) {
        throw new Error("⚠️ API Key를 먼저 입력해 주세요!");
    }
    
    while (true) {
        console.log("🌐 API 요청 시작...");
        
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: systemInstruction,
            safetySettings: SAFETY_SETTINGS
        });
        
        const chat = model.startChat({
            history: history,
            generationConfig: {
                temperature: 0.8, 
                topK: 40,
                topP: 0.95,
            }
        });

        try {
            const result = await chat.sendMessageStream(prompt, {
                thinkingConfig: { thinkingBudget: 5000 }
            });
            
            for await (const chunk of result.stream) {
                yield chunk.text();
            }
            
            try {
                const finalResponse = await result.response;
                console.log("📦 전체 응답 객체:", finalResponse);
                
                const usageMetadata = finalResponse.usageMetadata || 
                                     finalResponse.usage_metadata ||
                                     finalResponse.usage ||
                                     null;
                
                if (usageMetadata) {
                    logTokenUsage(usageMetadata, "채팅");
                } else {
                    console.warn("⚠️ usageMetadata를 찾을 수 없습니다.");
                    console.log("ℹ️ 사용 가능한 속성:", Object.keys(finalResponse));
                }
            } catch (error) {
                console.error("❌ 토큰 사용량 조회 오류:", error);
            }
            
            return;
        } catch (error) {
            if (error.status === 503 || error.message?.includes('503')) {
                console.warn("503 응답 수신: 잠시 후 다시 시도합니다.");
                await delay(RETRY_DELAY_MS);
                continue;
            }
            // 429 오류 (Rate Limit) 처리
            if (error.status === 429 || error.message?.includes('429')) {
                throw new Error("서버 응답: 429\n요청 한도 초과. 잠시 후 다시 시도해 주세요.");
            }
            // 400 오류 (잘못된 요청) 처리
            if (error.status === 400 || error.message?.includes('400')) {
                throw new Error("서버 응답: 400\n요청 형식 오류. API Key와 프롬프트를 확인해 주세요.");
            }
            throw error;
        }
    }
}

console.log('\n토큰 추적 시스템 활성화됨!');
console.log('💡 사용 가능한 명령어:');
console.log('  - showTokenStats() : 세션 통계 보기');
console.log('  - resetTokenStats() : 통계 초기화\n');

console.log('🛡️ Safety Settings: OFF (모든 필터 비활성화)\n');
console.log('⚠️ 안전 설정은 Api.js의 SAFETY_SETTINGS에서 변경할 수 있습니다.');
console.log('💡 각 사용자는 자신의 API 키로 책임있게 사용해주세요.\n');
