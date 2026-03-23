const btn = document.getElementById('btn');
const message = document.getElementById('message');

btn.addEventListener('click', () => {
  message.textContent = '🎉 GitHub 연동 성공!';
});
