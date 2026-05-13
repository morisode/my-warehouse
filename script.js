// ========== State ==========
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let currentFilter = 'all';
let pendingImageData = null;
let cameraStream = null;
let bgCameraStream = null;

let pendingFile = null;
let pendingData = null;

// ========== Custom Questions (IndexedDB persistence) ==========
const DB_NAME = 'MathQuizDB';
const DB_VERSION = 1;
const DB_STORE = 'customQuestions';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveCustomQuestion(question) {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      // Convert base64 image to Blob for efficient IndexedDB storage
      const questionToStore = { ...question };
      if (questionToStore.questionImage && questionToStore.questionImage.startsWith('data:')) {
        questionToStore._hasImage = true;
        const blob = dataURLtoBlob(questionToStore.questionImage);
        questionToStore._imageBlob = blob;
        // Keep a small thumbnail as base64 for quick preview
        questionToStore.questionImage = '';
      } else {
        questionToStore._hasImage = false;
      }
      const req = store.put(questionToStore);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to save question to IndexedDB:', e);
  }
}

async function loadAllCustomQuestions() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const questions = req.result.map(q => {
          // Convert Blob back to data URL
          if (q._hasImage && q._imageBlob) {
            q.questionImage = URL.createObjectURL(q._imageBlob);
          }
          // Clean up internal fields
          delete q._hasImage;
          delete q._imageBlob;
          return q;
        });
        resolve(questions);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to load questions from IndexedDB:', e);
    return [];
  }
}

async function deleteCustomQuestion(id) {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to delete question from IndexedDB:', e);
  }
}

async function clearAllCustomQuestions() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to clear IndexedDB:', e);
  }
}

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

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

function handleClearCustomQuestions() {
  const customCount = allQuestions.filter(q => q._custom).length;
  if (customCount === 0) { alert('没有自定义题目需要清除'); return; }
  if (!confirm(`确定要清除 ${customCount} 道自定义题目吗？此操作不可撤销。`)) return;
  clearAllCustomQuestions().then(() => {
    init();
    alert(`已清除 ${customCount} 道自定义题目`);
  });
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

  // Load persisted custom questions and merge
  const customQs = await loadAllCustomQuestions();
  if (customQs.length > 0) {
    const baseIds = new Set(allQuestions.map(q => q.id));
    customQs.forEach(q => {
      if (!baseIds.has(q.id)) {
        allQuestions.push(q);
      }
    });
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
      if (fq.questionImage) correctCount++; // image questions always count as "done"
      else if (ans === fq.answer) correctCount++;
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

  // Question text — support image-based questions
  const questionTextEl = document.getElementById('questionText');
  if (q.questionImage) {
    questionTextEl.innerHTML = `<img class="question-image" src="${q.questionImage}" alt="题目图片" />`;
    // No LaTeX rendering needed for image questions
  } else {
    questionTextEl.innerHTML = q.question;
  }

  // Options — image-based questions don't have selectable options
  const optionsEl = document.getElementById('optionsList');
  if (q.questionImage) {
    const isAnswered = userAnswers[q.id] !== undefined;
    if (isAnswered) {
      optionsEl.innerHTML = `<div class="image-question-status confirmed">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        已确认此题
      </div>`;
    } else {
      optionsEl.innerHTML = `<button class="image-confirm-btn" onclick="confirmImageQuestion(${q.id})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        确认已看此题
      </button>`;
    }
  } else {
    // Text-based questions with options
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
    optionsEl.innerHTML = optionsHTML;
  }

  // Explanation — image-based questions have no explanation
  const expBox = document.getElementById('explanationBox');
  const isAnswered = userAnswers[q.id] !== undefined;
  if (isAnswered && !q.questionImage && q.explanation) {
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

function confirmImageQuestion(questionId) {
  if (userAnswers[questionId] !== undefined) return;
  userAnswers[questionId] = -1; // special marker for image questions
  recordAnswer();
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
    else if (q.questionImage) correct++; // image questions: just marking as "done" counts
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
    // Mark all as base questions (not custom)
    allQuestions.forEach(q => delete q._custom);
  } else {
    const maxId = allQuestions.reduce((max, q) => Math.max(max, q.id || 0), 0);
    const newQuestions = pendingData.questions.map((q, i) => ({
      ...q,
      id: maxId + i + 1,
      _custom: true,
      createdAt: new Date().toISOString()
    }));
    allQuestions = [...allQuestions, ...newQuestions];
    // Save each to IndexedDB
    newQuestions.forEach(q => saveCustomQuestion(q));
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
  pendingImageData = null;
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
  document.getElementById('cameraPreview').style.display = 'none';
  document.getElementById('photoPreviewContainer').style.display = 'none';
  document.getElementById('photoAddBtn').style.display = 'none';
}

// --- Camera ---
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }
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
  // Use high quality PNG for best clarity
  const dataUrl = canvas.toDataURL('image/png');
  stopCamera();
  showPhotoPreview(dataUrl);
}

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => showPhotoPreview(e.target.result);
  reader.readAsDataURL(file);
  event.target.value = '';
}

function showPhotoPreview(imageSrc) {
  pendingImageData = imageSrc;
  document.getElementById('photoStep1').style.display = 'none';
  document.getElementById('photoStep2').style.display = '';
  document.getElementById('photoPreviewImg').src = imageSrc;
  document.getElementById('photoPreviewContainer').style.display = 'block';
  document.getElementById('photoAddBtn').style.display = '';
}

function retakePhoto() {
  pendingImageData = null;
  document.getElementById('photoStep1').style.display = '';
  document.getElementById('photoStep2').style.display = 'none';
  document.getElementById('photoPreviewContainer').style.display = 'none';
  document.getElementById('photoAddBtn').style.display = 'none';
}

function photoAddQuestion() {
  const maxId = allQuestions.reduce((max, q) => Math.max(max, q.id || 0), 0);

  if (pendingImageData) {
    // Image-based question
    const newQuestion = {
      id: maxId + 1,
      category: document.getElementById('photoCategory').value,
      subCategory: document.getElementById('photoSubCategory').value.trim() || '未分类',
      difficulty: document.getElementById('photoDifficulty').value,
      question: '[图片题目]',
      questionImage: pendingImageData,
      options: [],
      answer: -1,
      explanation: '',
      _custom: true,
      createdAt: new Date().toISOString()
    };

    allQuestions.push(newQuestion);
    saveCustomQuestion(newQuestion);
  } else {
    // Text-based question
    const question = document.getElementById('photoQuestion').value.trim();
    const optA = document.getElementById('photoOptA').value.trim();
    const optB = document.getElementById('photoOptB').value.trim();
    const optC = document.getElementById('photoOptC').value.trim();
    const optD = document.getElementById('photoOptD').value.trim();

    if (!question) { alert('请输入题目内容'); return; }
    if (!optA || !optB || !optC || !optD) { alert('请填写全部四个选项'); return; }

    const newQuestion = {
      id: maxId + 1,
      category: document.getElementById('photoCategory').value,
      subCategory: document.getElementById('photoSubCategory').value.trim() || '未分类',
      difficulty: document.getElementById('photoDifficulty').value,
      question: question,
      options: [optA, optB, optC, optD],
      answer: parseInt(document.getElementById('photoAnswer').value),
      explanation: document.getElementById('photoExplanation').value.trim(),
      _custom: true,
      createdAt: new Date().toISOString()
    };

    allQuestions.push(newQuestion);
    saveCustomQuestion(newQuestion);
  }
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
