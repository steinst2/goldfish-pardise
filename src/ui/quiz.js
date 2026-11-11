/** quiz.js — knowledge checks (accessible radio groups with immediate explanations). */
import { QUIZ } from './content.js';
import { esc } from './investigations.js';

export function renderQuiz(root) {
  root.innerHTML = QUIZ.map((item, i) => `
    <fieldset class="quiz-item" data-q="${i}">
      <legend>${i + 1}. ${esc(item.q)}</legend>
      ${item.choices.map((c, j) => `<label class="quiz-choice"><input type="radio" name="q${i}" value="${j}"> ${esc(c)}</label>`).join('')}
      <p class="quiz-feedback" aria-live="polite"></p>
    </fieldset>`).join('') + '<p class="quiz-score" aria-live="polite"></p>';
  const answered = new Map();
  root.querySelectorAll('.quiz-item').forEach((fs) => {
    fs.addEventListener('change', (e) => {
      const i = +fs.dataset.q;
      const pick = +e.target.value;
      const item = QUIZ[i];
      const correct = pick === item.answer;
      answered.set(i, correct);
      const fb = fs.querySelector('.quiz-feedback');
      fb.className = 'quiz-feedback ' + (correct ? 'ok' : 'no');
      fb.innerHTML = `${correct ? '✓ Correct.' : `✗ Not quite — the best answer is “${esc(item.choices[item.answer])}”.`} ${esc(item.why)}`;
      const score = [...answered.values()].filter(Boolean).length;
      root.querySelector('.quiz-score').textContent = `Score so far: ${score} of ${answered.size} answered (${QUIZ.length} questions).`;
    });
  });
}
