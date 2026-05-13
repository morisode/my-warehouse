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
let bgCameraStream = null;

// ========== Question History (localStorage) ==========
const HISTORY_KEY = 'quiz_question_history';

function getQuestionHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveQuestionHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function recordQuestionAttempt(questionId, isCorrect) {
  const history = getQuestionHistory();
  if (!history[questionId]) {
    history[questionId] = { total: 0, correct: 0 };
  }
  history[questionId].total++;
  if (isCorrect) history[questionId].correct++;
  saveQuestionHistory(history);
}

function getQuestionAttemptInfo(questionId) {
  const history = getQuestionHistory();
  return history[questionId] || { total: 0, correct: 0 };
}

// Get total stats across all questions
function getOverallAttemptStats() {
  const history = getQuestionHistory();
  let totalAttempts = 0;
  let totalCorrect = 0;
  let questionCount = Object.keys(history).length;
  for (const id in history) {
    totalAttempts += history[id].total;
    totalCorrect += history[id].correct;
  }
  return { totalAttempts, totalCorrect, questionCount };
}

// Reset history for a specific question
function resetQuestionHistory(questionId) {
  const history = getQuestionHistory();
  delete history[questionId];
  saveQuestionHistory(history);
}

// Reset all question history
function resetAllQuestionHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

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

// ========== Admin / Usage Stats ==========
function getAdminStats() {
  const raw = localStorage.getItem('quiz_admin_stats');
  if (raw) return JSON.parse(raw);
  return { totalVisits: 0, totalAnswers: 0, todayVisits: 0, todayAnswers: 0, lastDate: '' };
}

function saveAdminStats(stats) {
  localStorage.setItem('quiz_admin_stats', JSON.stringify(stats));
}

function recordVisit() {
  const stats = getAdminStats();
  const today = new Date().toISOString().slice(0, 10);
  stats.totalVisits++;
  if (stats.lastDate !== today) {
    stats.todayVisits = 1;
    stats.todayAnswers = 0;
    stats.lastDate = today;
  } else {
    stats.todayVisits++;
  }
  saveAdminStats(stats);
}

function recordAnswer() {
  const stats = getAdminStats();
  const today = new Date().toISOString().slice(0, 10);
  stats.totalAnswers++;
  if (stats.lastDate !== today) {
    stats.lastDate = today;
    stats.todayAnswers = 1;
  } else {
    stats.todayAnswers++;
  }
  saveAdminStats(stats);
}

function updateAdminPanel() {
  const stats = getAdminStats();
  const today = new Date().toISOString().slice(0, 10);
  const isToday = stats.lastDate === today;
  document.getElementById('adminTotalVisits').textContent = stats.totalVisits;
  document.getElementById('adminTotalAnswers').textContent = stats.totalAnswers;
  document.getElementById('adminTodayVisits').textContent = isToday ? stats.todayVisits : 0;
  document.getElementById('adminTodayAnswers').textContent = isToday ? stats.todayAnswers : 0;

  // Update history stats
  const histStats = getOverallAttemptStats();
  document.getElementById('adminHistQuestions').textContent = histStats.questionCount;
  document.getElementById('adminHistAttempts').textContent = histStats.totalAttempts;
  document.getElementById('adminHistCorrect').textContent = histStats.totalCorrect;
  document.getElementById('adminHistRate').textContent =
    histStats.totalAttempts > 0 ? `${Math.round((histStats.totalCorrect / histStats.totalAttempts) * 100)}%` : '-';
}

function handleResetHistory() {
  if (!confirm('确定要清空所有做题历史记录吗？此操作不可撤销。')) return;
  resetAllQuestionHistory();
  updateAdminPanel();
  renderQuestion();
}

function resetAdminStats() {
  if (!confirm('确定要重置所有统计数据吗？此操作不可撤销。')) return;
  saveAdminStats({ totalVisits: 0, totalAnswers: 0, todayVisits: 0, todayAnswers: 0, lastDate: '' });
  updateAdminPanel();
}

// Admin panel: long press header title for 3 seconds
let adminPressTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  const headerTitle = document.getElementById('headerTitle');
  let pressStart = 0;
  headerTitle.addEventListener('pointerdown', (e) => {
    pressStart = Date.now();
    adminPressTimer = setTimeout(() => {
      openAdminModal();
    }, 3000);
  });
  headerTitle.addEventListener('pointerup', () => clearTimeout(adminPressTimer));
  headerTitle.addEventListener('pointerleave', () => clearTimeout(adminPressTimer));
  headerTitle.addEventListener('pointercancel', () => clearTimeout(adminPressTimer));
});

function openAdminModal() {
  updateAdminPanel();
  loadBgPreview();
  document.getElementById('adminModal').classList.add('show');
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('show');
  stopBgCamera();
}

// ========== Custom Background ==========
function getCustomBg() {
  return localStorage.getItem('quiz_custom_bg') || '';
}

function setCustomBg(dataUrl) {
  localStorage.setItem('quiz_custom_bg', dataUrl);
  applyBackground(dataUrl);
}

function applyBackground(dataUrl) {
  const bgLayer = document.getElementById('bgLayer');
  if (dataUrl) {
    bgLayer.style.backgroundImage = `url(${dataUrl})`;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
    bgLayer.style.backgroundAttachment = 'fixed';
  } else {
    bgLayer.style.backgroundImage = 'none';
  }
}

function loadBgPreview() {
  const bg = getCustomBg();
  const preview = document.getElementById('bgPreview');
  const uploadBtns = document.getElementById('bgUploadBtns');
  if (bg) {
    document.getElementById('bgPreviewImg').src = bg;
    preview.style.display = '';
    uploadBtns.style.display = 'none';
  } else {
    preview.style.display = 'none';
    uploadBtns.style.display = '';
  }
}

function removeCustomBg() {
  localStorage.removeItem('quiz_custom_bg');
  applyBackground('');
  loadBgPreview();
}

function handleBgFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    setCustomBg(e.target.result);
    loadBgPreview();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// Background Camera
async function startBgCamera() {
  try {
    bgCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const video = document.getElementById('bgCameraVideo');
    video.srcObject = bgCameraStream;
    document.getElementById('bgCameraPreview').style.display = 'block';
  } catch (err) {
    alert('无法访问摄像头：' + err.message);
  }
}

function stopBgCamera() {
  if (bgCameraStream) {
    bgCameraStream.getTracks().forEach(t => t.stop());
    bgCameraStream = null;
  }
  document.getElementById('bgCameraVideo').srcObject = null;
  document.getElementById('bgCameraPreview').style.display = 'none';
}

function captureBgPhoto() {
  const video = document.getElementById('bgCameraVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  stopBgCamera();
  setCustomBg(dataUrl);
  loadBgPreview();
}

// ========== Init ==========
async function init() {
  recordVisit();
  applyBackground(getCustomBg());

  try {
    const resp = await fetch('questions.json');
    allQuestions = (await resp.json()).questions;
  } catch {
    allQuestions = [];
  }

  filteredQuestions = [...allQuestions];
  setupFilters();
  setupDragDrop();

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

// ========== Filters ==========
function setupFilters() {
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.removeEventListener('click', handleFilterClick);
    btn.addEventListener('click', handleFilterClick);
  });
}

function handleFilterClick() {
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
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
  bar.innerHTML = '<button class="filter-chip active" data-filter="all">全部</button>';
  categories.forEach(cat => {
    const display = displayMap[cat] || cat;
    bar.innerHTML += `<button class="filter-chip" data-filter="${cat}">${escapeHtml(display)}</button>`;
  });
  setupFilters();
}

// ========== Render ==========
function renderQuestion() {
  if (filteredQuestions.length === 0) {
    document.getElementById('questionArea').innerHTML =
      '<p style="text-align:center;color:#94a3b8;padding:40px;">该分类下暂无题目</p>';
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
  const diffColors = { 1: 'diff-easy', 2: 'diff-medium', 3: 'diff-hard' };

  // Build attempt info tag
  const attemptInfo = getQuestionAttemptInfo(q.id);
  let attemptsTag = '';
  if (attemptInfo.total > 0) {
    const correctRate = Math.round((attemptInfo.correct / attemptInfo.total) * 100);
    let statusIcon = '📝';
    if (correctRate >= 80) statusIcon = '✅';
    else if (correctRate >= 50) statusIcon = '🔄';
    else statusIcon = '⚠️';
    attemptsTag = `<span class="q-tag tag-attempts">${statusIcon} 已做 ${attemptInfo.total} 次 · 正确 ${attemptInfo.correct} · 正确率 ${correctRate}%</span>`;
  }

  const metaHTML = `
    <span class="q-tag tag-category">${escapeHtml(q.category)}</span>
    <span class="q-tag tag-sub">${escapeHtml(q.subCategory)}</span>
    <span class="q-tag ${diffColors[diffMap[q.difficulty] || 1]}">${escapeHtml(q.difficulty)}</span>
    ${attemptsTag}
  `;
  document.getElementById('questionMeta').innerHTML = metaHTML;
  document.getElementById('questionNumber').textContent = `第 ${currentIndex + 1} 题 / 共 ${total} 题`;

  // Question text
  document.getElementById('questionText').innerHTML = q.question;

  // Options — raw HTML from JSON, KaTeX will process LaTeX delimiters
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

  // Explanation
  const expBox = document.getElementById('explanationBox');
  if (isAnswered) {
    document.getElementById('explanationText').innerHTML = q.explanation || '';
    expBox.classList.add('show');
  } else {
    expBox.classList.remove('show');
  }

  // Navigation
  document.getElementById('prevBtn').disabled = currentIndex === 0;
  const nextBtn = document.getElementById('nextBtn');
  if (currentIndex === total - 1) {
    nextBtn.innerHTML = '查看结果 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    nextBtn.className = 'nav-btn nav-submit';
  } else {
    nextBtn.innerHTML = '下一题 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
    nextBtn.className = 'nav-btn nav-next';
  }

  // Render ALL LaTeX in the question area (question text + options + explanation)
  const questionArea = document.getElementById('questionArea');
  renderLatexInElement(questionArea);
}

// ========== Interactions ==========
function selectOption(questionId, optionIndex) {
  if (userAnswers[questionId] !== undefined) return;
  userAnswers[questionId] = optionIndex;
  recordAnswer();
  // Find the question object to check if answer is correct
  const q = allQuestions.find(q => q.id === questionId);
  if (q) recordQuestionAttempt(questionId, optionIndex === q.answer);
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
  if (rate >= 80) { icon = '🎉'; title = '表现优秀！'; }
  else if (rate >= 60) { icon = '👍'; title = '继续加油！'; }
  else if (rate >= 40) { icon = '📚'; title = '还需努力'; }
  else { icon = '💪'; title = '别灰心，多练习！'; }

  document.getElementById('resultIcon').textContent = icon;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultScore').textContent = `${rate}%`;

  // Build detail with history info
  let detailText = `答对 ${correct} 题 / 答错 ${wrong} 题 / 未答 ${unanswered} 题`;
  const histStats = getOverallAttemptStats();
  if (histStats.totalAttempts > 0) {
    const histRate = Math.round((histStats.totalCorrect / histStats.totalAttempts) * 100);
    detailText += `\n累计做题 ${histStats.totalAttempts} 次 · 历史正确率 ${histRate}%`;
  }
  document.getElementById('resultDetail').textContent = detailText;
  document.getElementById('resultDetail').style.whiteSpace = 'pre-line';
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
  event.target.value = '';
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
  if (photoStep === 1) return;
  if (photoStep === 2) {
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
  document.getElementById('quizCard').style.display = '';
  document.getElementById('emptyState').style.display = 'none';
  renderQuestion();
  closePhotoModal();

  alert('题目添加成功！');
}

// ========== Keyboard Navigation ==========
document.addEventListener('keydown', (e) => {
  const anyModalOpen =
    document.getElementById('uploadModal').classList.contains('show') ||
    document.getElementById('photoModal').classList.contains('show') ||
    document.getElementById('adminModal').classList.contains('show');
  if (anyModalOpen) {
    if (e.key === 'Escape') {
      closeUploadModal();
      closePhotoModal();
      closeAdminModal();
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
