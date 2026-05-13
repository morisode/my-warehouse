// ========== State ==========
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let currentFilter = 'all';
let pendingFile = null;
let pendingData = null;
let photoStep = 1;
let cameraStream = null;

// ========== KaTeX Helper ==========
function renderLatexInElement(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== Init ==========
async function init() {
  try {
    const resp = await fetch('questions.json');
    allQuestions = (await resp.json()).questions;
  } catch {
    allQuestions = [];
  }

  filteredQuestions = [...allQuestions];
  setupFilters();
  setupDragDrop();
  updateToolbarInfo();

  if (allQuestions.length === 0) {
    showEmptyState();
  } else {
    document.getElementById('quizCard').style.display = '';
    document.getElementById('emptyState').style.display = 'none';
    renderQuestion();
  }
}

function showEmptyState() {
  document.getElementById('quizCard').style.display = 'none';
  document.getElementById('emptyState').style.display = '';
  document.getElementById('statProgress').textContent = '0/0';
}

function updateToolbarInfo() {
  document.getElementById('toolbarInfo').textContent = `共 ${allQuestions.length} 道题`;
}

// ========== Filters ==========
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.removeEventListener('click', handleFilterClick);
    btn.addEventListener('click', handleFilterClick);
  });
}

function handleFilterClick() {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  this.classList.add('active');

  currentFilter = this.dataset.filter;
  if (currentFilter === 'all') {
    filteredQuestions = [...allQuestions];
  } else {
    const map = { '概率统计': '概率论与数理统计' };
    const cat = map[currentFilter] || currentFilter;
    filteredQuestions = allQuestions.filter(q => q.category === cat);
  }

  currentIndex = 0;
  renderQuestion();
}

function rebuildFilterButtons() {
  const categories = [...new Set(allQuestions.map(q => q.category))];
  const displayMap = { '概率论与数理统计': '概率统计' };
  const bar = document.getElementById('filterBar');
  bar.innerHTML = '<button class="filter-btn active" data-filter="all">全部</button>';
  categories.forEach(cat => {
    const display = displayMap[cat] || cat;
    bar.innerHTML += `<button class="filter-btn" data-filter="${cat}">${escapeHtml(display)}</button>`;
  });
  setupFilters();
}

// ========== Render ==========
function renderQuestion() {
  if (filteredQuestions.length === 0) {
    document.getElementById('questionArea').innerHTML =
      '<p style="text-align:center;color:#6b7280;padding:40px;">该分类下暂无题目</p>';
    document.getElementById('statProgress').textContent = '0/0';
    document.getElementById('progressFill').style.width = '0%';
    return;
  }

  const q = filteredQuestions[currentIndex];
  const total = filteredQuestions.length;

  document.getElementById('statProgress').textContent = `${currentIndex + 1}/${total}`;
  document.getElementById('progressFill').style.width = `${((currentIndex + 1) / total) * 100}%`;

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

  const diffMap = { '基础': 1, '中等': 2, '较难': 3 };
  const metaHTML = `
    <span class="tag category">${escapeHtml(q.category)}</span>
    <span class="tag sub-category">${escapeHtml(q.subCategory)}</span>
    <span class="tag difficulty-${diffMap[q.difficulty] || 1}">${escapeHtml(q.difficulty)}</span>
  `;
  document.getElementById('questionMeta').innerHTML = metaHTML;
  document.getElementById('questionNumber').textContent = `第 ${currentIndex + 1} 题 / 共 ${total} 题`;

  // Set content (HTML with LaTeX)
  document.getElementById('questionText').innerHTML = q.question;

  const letters = ['A', 'B', 'C', 'D'];
  const isAnswered = userAnswers[q.id] !== undefined;
  const optionsHTML = q.options.map((opt, i) => {
    let cls = 'option-item';
    if (isAnswered) {
      cls += ' disabled';
      if (i === q.answer) cls += ' correct';
      else if (i === userAnswers[q.id] && i !== q.answer) cls += ' wrong';
    }
    return `
      <div class="${cls}" onclick="selectOption(${q.id}, ${i})" data-index="${i}">
        <div class="option-letter">${letters[i]}</div>
        <div class="option-content">${opt}</div>
      </div>
    `;
  }).join('');
  document.getElementById('optionsList').innerHTML = optionsHTML;

  // Explanation (also supports LaTeX)
  const expBox = document.getElementById('explanationBox');
  if (isAnswered) {
    document.getElementById('explanationText').innerHTML = q.explanation || '';
    expBox.classList.add('show');
  } else {
    expBox.classList.remove('show');
  }

  document.getElementById('prevBtn').disabled = currentIndex === 0;
  const nextBtn = document.getElementById('nextBtn');
  if (currentIndex === total - 1) {
    nextBtn.innerHTML = '查看结果 <span>&#10003;</span>';
    nextBtn.className = 'nav-btn submit';
  } else {
    nextBtn.innerHTML = '下一题 <span>&#8594;</span>';
    nextBtn.className = 'nav-btn next';
  }

  // Render LaTeX with KaTeX
  const questionArea = document.getElementById('questionArea');
  renderLatexInElement(questionArea);
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

function resetQuiz() {
  if (allQuestions.length === 0) return;
  userAnswers = {};
  currentIndex = 0;
  document.getElementById('resultOverlay').classList.remove('show');
  renderQuestion();
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

// ========== Upload Modal ==========
function openUploadModal() {
  pendingFile = null;
  pendingData = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('dropZone').style.display = '';
  document.getElementById('confirmUploadBtn').disabled = true;
  document.querySelector('input[name="uploadMode"][value="replace"]').checked = true;
  document.getElementById('uploadModal').classList.add('show');
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('show');
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.endsWith('.json')) {
    alert('请选择 JSON 格式的文件');
    return;
  }

  pendingFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileInfo').style.display = 'flex';
  document.getElementById('dropZone').style.display = 'none';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        pendingData = data;
        document.getElementById('confirmUploadBtn').disabled = false;
      } else {
        pendingData = null;
        document.getElementById('confirmUploadBtn').disabled = true;
        alert('JSON 格式不正确：需要包含 questions 数组且数组非空');
      }
    } catch (err) {
      pendingData = null;
      document.getElementById('confirmUploadBtn').disabled = true;
      alert('文件解析失败：' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearFile() {
  pendingFile = null;
  pendingData = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('dropZone').style.display = '';
  document.getElementById('confirmUploadBtn').disabled = true;
}

function confirmUpload() {
  if (!pendingData || !pendingData.questions) return;

  const mode = document.querySelector('input[name="uploadMode"]:checked').value;

  if (mode === 'replace') {
    allQuestions = pendingData.questions;
  } else {
    const maxId = allQuestions.reduce((max, q) => Math.max(max, q.id || 0), 0);
    const newQuestions = pendingData.questions.map((q, i) => ({
      ...q,
      id: maxId + i + 1
    }));
    allQuestions = [...allQuestions, ...newQuestions];
  }

  userAnswers = {};
  currentIndex = 0;
  filteredQuestions = [...allQuestions];

  rebuildFilterButtons();
  updateToolbarInfo();
  document.getElementById('quizCard').style.display = '';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultOverlay').classList.remove('show');
  renderQuestion();
  closeUploadModal();

  const modeText = mode === 'replace' ? '替换' : '追加';
  alert(`${modeText}成功！当前共 ${allQuestions.length} 道题目`);
}

// ========== Drag & Drop ==========
function setupDragDrop() {
  const dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
}

// ========== Template Download ==========
function downloadTemplate() {
  const template = {
    "title": "考研数学题库 - 自定义题目",
    "questions": [
      {
        "id": 1,
        "category": "高等数学",
        "subCategory": "极限与连续",
        "difficulty": "基础",
        "question": "求极限 \\(\\lim_{x \\to 0} \\frac{\\sin x}{x}\\)",
        "options": ["0", "1", "\\infty", "不存在"],
        "answer": 1,
        "explanation": "第一个重要极限，\\(\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\\)。"
      },
      {
        "id": 2,
        "category": "线性代数",
        "subCategory": "行列式",
        "difficulty": "中等",
        "question": "行列式 \\(\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}\\) 的值为？",
        "options": ["-2", "2", "-10", "10"],
        "answer": 0,
        "explanation": "二阶行列式 = ad - bc = 1*4 - 2*3 = -2。"
      }
    ]
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions-template.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ========== Photo Modal ==========
function openPhotoModal() {
  photoStep = 1;
  resetPhotoModalUI();
  document.getElementById('photoModal').classList.add('show');
}

function closePhotoModal() {
  stopCamera();
  document.getElementById('photoModal').classList.remove('show');
}

function resetPhotoModalUI() {
  document.getElementById('photoStep1').style.display = '';
  document.getElementById('photoStep2').style.display = 'none';
  document.getElementById('photoStep3').style.display = 'none';
  document.getElementById('cameraPreview').style.display = 'none';
  document.getElementById('ocrStatus').style.display = 'flex';
  document.getElementById('ocrResultBox').style.display = 'none';
  document.getElementById('photoBackBtn').style.display = 'none';
  document.getElementById('photoNextBtn').style.display = 'none';
  document.getElementById('photoAddBtn').style.display = 'none';
}

// --- Camera ---
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('cameraVideo');
    video.srcObject = cameraStream;
    document.getElementById('cameraPreview').style.display = 'block';
  } catch (err) {
    alert('无法访问摄像头：' + err.message);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  document.getElementById('cameraVideo').srcObject = null;
  document.getElementById('cameraPreview').style.display = 'none';
}

function capturePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  stopCamera();
  processImageForOCR(dataUrl);
}

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => processImageForOCR(e.target.result);
  reader.readAsDataURL(file);
  event.target.value = ''; // reset
}

// --- OCR ---
async function processImageForOCR(imageSrc) {
  document.getElementById('photoStep1').style.display = 'none';
  document.getElementById('photoStep2').style.display = '';
  document.getElementById('ocrPreviewImg').src = imageSrc;
  document.getElementById('ocrStatus').style.display = 'flex';
  document.getElementById('ocrResultBox').style.display = 'none';
  document.getElementById('photoNextBtn').style.display = 'none';

  try {
    const result = await Tesseract.recognize(imageSrc, 'chi_sim+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          document.querySelector('#ocrStatus span').textContent = `正在识别文字... ${pct}%`;
        }
      }
    });

    const text = result.data.text.trim();
    document.getElementById('ocrText').value = text;
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('ocrResultBox').style.display = 'block';
    document.getElementById('photoNextBtn').style.display = '';
  } catch (err) {
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('ocrResultBox').style.display = 'block';
    document.getElementById('ocrText').value = 'OCR 识别失败，请手动输入题目内容。\n错误：' + err.message;
    document.getElementById('photoNextBtn').style.display = '';
  }
}

// --- Photo Step Navigation ---
function photoNext() {
  if (photoStep === 1) return; // should not happen
  if (photoStep === 2) {
    // Go to step 3: edit form
    photoStep = 3;
    document.getElementById('photoStep2').style.display = 'none';
    document.getElementById('photoStep3').style.display = '';
    document.getElementById('photoNextBtn').style.display = 'none';
    document.getElementById('photoBackBtn').style.display = '';
    document.getElementById('photoAddBtn').style.display = '';
  }
}

function photoBack() {
  if (photoStep === 3) {
    photoStep = 2;
    document.getElementById('photoStep3').style.display = 'none';
    document.getElementById('photoStep2').style.display = '';
    document.getElementById('photoAddBtn').style.display = 'none';
    document.getElementById('photoBackBtn').style.display = 'none';
    document.getElementById('photoNextBtn').style.display = '';
  }
}

function photoAddQuestion() {
  const question = document.getElementById('photoQuestion').value.trim();
  const optA = document.getElementById('photoOptA').value.trim();
  const optB = document.getElementById('photoOptB').value.trim();
  const optC = document.getElementById('photoOptC').value.trim();
  const optD = document.getElementById('photoOptD').value.trim();

  if (!question) { alert('请输入题目内容'); return; }
  if (!optA || !optB || !optC || !optD) { alert('请填写全部四个选项'); return; }

  const maxId = allQuestions.reduce((max, q) => Math.max(max, q.id || 0), 0);
  const newQuestion = {
    id: maxId + 1,
    category: document.getElementById('photoCategory').value,
    subCategory: document.getElementById('photoSubCategory').value.trim() || '未分类',
    difficulty: document.getElementById('photoDifficulty').value,
    question: question,
    options: [optA, optB, optC, optD],
    answer: parseInt(document.getElementById('photoAnswer').value),
    explanation: document.getElementById('photoExplanation').value.trim()
  };

  allQuestions.push(newQuestion);
  userAnswers = {};
  currentIndex = 0;
  filteredQuestions = [...allQuestions];

  rebuildFilterButtons();
  updateToolbarInfo();
  document.getElementById('quizCard').style.display = '';
  document.getElementById('emptyState').style.display = 'none';
  renderQuestion();
  closePhotoModal();

  alert('题目添加成功！');
}

// ========== Keyboard Navigation ==========
document.addEventListener('keydown', (e) => {
  // Don't capture keys when any modal is open
  const anyModalOpen =
    document.getElementById('uploadModal').classList.contains('show') ||
    document.getElementById('photoModal').classList.contains('show');
  if (anyModalOpen) {
    if (e.key === 'Escape') {
      closeUploadModal();
      closePhotoModal();
    }
    return;
  }

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
