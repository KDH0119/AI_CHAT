document.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const prompt = document.getElementById('prompt').value.trim();
    
    if (!name) {
        alert('캐릭터 이름을 입력해주세요!');
        return false;
    }
    
    if (!prompt) {
        alert('상세 프롬프트를 입력해주세요!');
        return false;
    }
    
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.innerHTML = '⏳ 생성 중...';
    submitBtn.disabled = true;
    
    const formData = {
        name: document.getElementById('name').value.trim(),
        //template: document.getElementById('template').value,
        main_prompt_1: document.getElementById('main_prompt_1').value.trim(),
        profile_name: document.getElementById('profile_name').value.trim(),
        profile_detail: document.getElementById('profile_detail').value.trim(),
        prompt: document.getElementById('prompt').value.trim(),
        prolog: document.getElementById('prolog').value.trim(),
        start_option: document.getElementById('start_option').value.trim(),
        start_situation: document.getElementById('start_situation').value.trim()
    };
    
    localStorage.setItem('characterFormData', JSON.stringify(formData));
    
    window.location.href = 'Main_chat.html';
});

const promptTextarea = document.getElementById('prompt');
const prologTextarea = document.getElementById('prolog');
const promptCount = document.getElementById('prompt-count');
const prologCount = document.getElementById('prolog-count');

promptTextarea.addEventListener('input', function() {
    const currentLength = this.value.length;
    promptCount.textContent = currentLength;
    
    if (currentLength > 3500) {
        promptCount.style.color = '#e74c3c';
    } else {
        promptCount.style.color = '#ff8c00';
    }
});

prologTextarea.addEventListener('input', function() {
    const currentLength = this.value.length;
    prologCount.textContent = currentLength;
    
    if (currentLength > 800) {
        prologCount.style.color = '#e74c3c';
    } else {
        prologCount.style.color = '#ff8c00';
    }
    
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});