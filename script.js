// ========== State ==========
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let userAnswers = {};  // { questionId: selectedOptionIndex }
let currentFilter = 'all';

// ========== Init ==========
async function init() {
  try {
    const resp = await fetch('questions.json');
    allQuestions = (await resp.json()).questions;
  } catch {
    // fallback: demo questions
    allQuestions = [];
  }

  if (allQuestions.length === 0) {
    showEmptyState();
    return;
  }

  filteredQuestions = [...allQuestions];
  setupFilters();
  renderQuestion();
}

function showEmptyState() {
  document.getElementById('quizCard').style.display = 'none';
  document.getElementById('uploadArea').classList.add('show');
  document.getElementById('statProgress').textContent = '0/0';
}

// ========== Filters ==========
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = btn.dataset.filter;
      if (currentFilter === 'all') {
        filteredQuestions = [...allQuestions];
      } else {
        const map = { '概率统计': '概率论与数理统计' };
        const cat = map[currentFilter] || currentFilter;
        filteredQuestions = allQuestions.filter(q => q.category === cat);
      }

      currentIndex = 0;
      renderQuestion();
    });
  });
}

// ========== Render ==========
function renderQuestion() {
  if (filteredQuestions.length === 0) {
    document.getElementById('questionArea').innerHTML =
      '<p style="text-align:center;color:#6b7280;padding:40px;">该分类下暂无题目</p>';
    return;
  }

  const q = filteredQuestions[currentIndex];
  const total = filteredQuestions.length;
  const answered = Object.keys(userAnswers).filter(
    id => filteredQuestions.some(fq => fq.id === Number(id))
  ).length;

  // Progress
  document.getElementById('statProgress').textContent = `${currentIndex + 1}/${total}`;
  document.getElementById('progressFill').style.width = `${((currentIndex + 1) / total) * 100}%`;

  // Stats
  let correctCount = 0, wrongCount = 0;
  filteredQuestions.forEach(fq => {
    const ans = userAnswers[fq.id];
    if (ans !== undefined) {
      if (ans === fq.answer) correctCount++;
      else wrongCount++;
    }
  });
  document.getElementById('statCorrect').textContent = correctCount;
  document.getElementById('statWrong').textContent = wrongCount;
  const totalAnswered = correctCount + wrongCount;
  document.getElementById('statRate').textContent =
    totalAnswered > 0 ? `${Math.round((correctCount / totalAnswered) * 100)}%` : '-';

  // Meta tags
  const diffMap = { '基础': 1, '中等': 2, '较难': 3 };
  const metaHTML = `
    <span class="tag category">${q.category}</span>
    <span class="tag sub-category">${q.subCategory}</span>
    <span class="tag difficulty-${diffMap[q.difficulty] || 1}">${q.difficulty}</span>
  `;
  document.getElementById('questionMeta').innerHTML = metaHTML;
  document.getElementById('questionNumber').textContent = `第 ${currentIndex + 1} 题 / 共 ${total} 题`;

  // Question text
  document.getElementById('questionText').innerHTML = q.question;

  // Options
  const letters = ['A', 'B', 'C', 'D'];
  const isAnswered = userAnswers[q.id] !== undefined;
  const optionsHTML = q.options.map((opt, i) => {
    let cls = 'option-item';
    if (isAnswered) {
      cls += ' disabled';
      if (i === q.answer) cls += ' correct';
      else if (i === userAnswers[q.id] && i !== q.answer) cls += ' wrong';
    } else {
      // nothing
    }
    return `
      <div class="${cls}" onclick="selectOption(${q.id}, ${i})" data-index="${i}">
        <div class="option-letter">${letters[i]}</div>
        <div class="option-content">${opt}</div>
      </div>
    `;
  }).join('');
  document.getElementById('optionsList').innerHTML = optionsHTML;

  // Explanation
  const expBox = document.getElementById('explanationBox');
  if (isAnswered) {
    document.getElementById('explanationText').textContent = q.explanation;
    expBox.classList.add('show');
  } else {
    expBox.classList.remove('show');
  }

  // Nav buttons
  document.getElementById('prevBtn').disabled = currentIndex === 0;
  const nextBtn = document.getElementById('nextBtn');
  if (currentIndex === total - 1) {
    nextBtn.innerHTML = '查看结果 <span>&#10003;</span>';
    nextBtn.className = 'nav-btn submit';
  } else {
    nextBtn.innerHTML = '下一题 <span>&#8594;</span>';
    nextBtn.className = 'nav-btn next';
  }

  // Re-render MathJax
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([document.getElementById('questionArea')]).catch(() => {});
  }
}

// ========== Interactions ==========
function selectOption(questionId, optionIndex) {
  if (userAnswers[questionId] !== undefined) return;
  userAnswers[questionId] = optionIndex;
  renderQuestion();
}

function nextQuestion() {
  if (currentIndex < filteredQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showResult();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ========== Result ==========
function showResult() {
  let correct = 0, wrong = 0, unanswered = 0;
  filteredQuestions.forEach(q => {
    const ans = userAnswers[q.id];
    if (ans === undefined) unanswered++;
    else if (ans === q.answer) correct++;
    else wrong++;
  });

  const total = filteredQuestions.length;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

  let icon, title;
  if (rate >= 80) { icon = '\u{1F389}'; title = '表现优秀！'; }
  else if (rate >= 60) { icon = '\u{1F44D}'; title = '继续加油！'; }
  else if (rate >= 40) { icon = '\u{1F4DA}'; title = '还需努力'; }
  else { icon = '\u{1F4AA}'; title = '别灰心，多练习！'; }

  document.getElementById('resultIcon').textContent = icon;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultScore').textContent = `${rate}%`;
  document.getElementById('resultDetail').textContent =
    `答对 ${correct} 题 / 答错 ${wrong} 题 / 未答 ${unanswered} 题`;
  document.getElementById('resultOverlay').classList.add('show');
}

function restartQuiz() {
  userAnswers = {};
  currentIndex = 0;
  document.getElementById('resultOverlay').classList.remove('show');
  renderQuestion();
}

// ========== Upload ==========
function loadCustomQuestions(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        allQuestions = data.questions;
        userAnswers = {};
        currentIndex = 0;
        filteredQuestions = [...allQuestions];

        document.getElementById('quizCard').style.display = '';
        document.getElementById('uploadArea').classList.remove('show');
        document.getElementById('resultOverlay').classList.remove('show');

        setupFilters();
        renderQuestion();
        alert(`成功加载 ${allQuestions.length} 道题目！`);
      } else {
        alert('JSON 格式错误：需要包含 questions 数组');
      }
    } catch (err) {
      alert('文件解析失败：' + err.message);
    }
  };
  reader.readAsText(file);
}

// ========== Keyboard Navigation ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevQuestion();
  if (e.key === 'ArrowRight') nextQuestion();
  const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const idx = keyMap[e.key.toLowerCase()];
  if (idx !== undefined && filteredQuestions.length > 0) {
    const q = filteredQuestions[currentIndex];
    if (userAnswers[q.id] === undefined && idx < q.options.length) {
      selectOption(q.id, idx);
    }
  }
});

// ========== Start ==========
document.addEventListener('DOMContentLoaded', init);
