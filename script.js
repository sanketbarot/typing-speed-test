// ============ STATE ============
let timeLimit = 60, timeLeft = 60, timer = null, started = false;
let currentText = "", difficulty = "easy", category = "general", language = "en";
let correctChars = 0, incorrectChars = 0, totalTyped = 0;
let streak = 0, maxStreak = 0;
let soundOn = true, musicOn = false;
let wpmHistory = [], liveChart = null, resultChart = null, historyChart = null;
let mode = "test";

const $ = id => document.getElementById(id);
const textDisplay = $("textDisplay");
const inputField = $("inputField");

// ============ AUDIO ============
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type = "sine", duration = 0.05, vol = 0.05) {
  if (!soundOn) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
const typeSound = () => playSound(800, "sine", 0.02);
const errorSound = () => playSound(150, "square", 0.1);
const successSound = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playSound(f, "sine", 0.15, 0.08), i * 100));

// ============ LOAD TEXT ============
function loadText() {
  const langData = textsData[language] || textsData.en;
  const cats = langData[difficulty] || textsData.en[difficulty];
  let arr = cats[category] || cats.general || Object.values(cats)[0];
  if (!arr || arr.length === 0) arr = textsData.en[difficulty].general;
  currentText = arr[Math.floor(Math.random() * arr.length)];
  renderText();
  $("wordCount").textContent = currentText.split(" ").length;
}

function renderText() {
  textDisplay.innerHTML = "";
  currentText.split("").forEach((char, i) => {
    const span = document.createElement("span");
    span.classList.add("char");
    if (i === 0) span.classList.add("current");
    span.textContent = char;
    textDisplay.appendChild(span);
  });
}

// ============ INPUT HANDLER ============
inputField.addEventListener("input", (e) => {
  if (!started && mode !== "practice") startTimer();
  else if (mode === "practice" && !started) started = true;
  
  const inputVal = inputField.value;
  const chars = textDisplay.querySelectorAll(".char");
  
  correctChars = 0; incorrectChars = 0;
  let curStreak = 0;
  
  chars.forEach((charSpan, i) => {
    charSpan.classList.remove("correct", "incorrect", "current");
    const typed = inputVal[i];
    if (typed == null) {
      if (i === inputVal.length) charSpan.classList.add("current");
    } else if (typed === charSpan.textContent) {
      charSpan.classList.add("correct");
      correctChars++; curStreak++;
    } else {
      charSpan.classList.add("incorrect");
      incorrectChars++; curStreak = 0;
    }
  });
  
  // Auto-scroll
  const currentChar = textDisplay.querySelector(".char.current");
  if (currentChar) {
    currentChar.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  
  if (e.inputType === "insertText") {
    const lastChar = inputVal[inputVal.length - 1];
    const expected = currentText[inputVal.length - 1];
    if (lastChar === expected) typeSound();
    else errorSound();
  }
  
  streak = curStreak;
  if (streak > maxStreak) maxStreak = streak;
  totalTyped = inputVal.length;
  updateStats();
  
  if (inputVal.length === currentText.length) {
    if (mode === "practice") {
      setTimeout(() => { 
        loadText(); inputField.value = ""; 
        correctChars = 0; incorrectChars = 0; totalTyped = 0; 
        updateStats(); 
      }, 500);
    } else endTest();
  }
});

// ============ TIMER ============
function startTimer() {
  started = true;
  $("statusText").textContent = "TYPING";
  timer = setInterval(() => {
    timeLeft--;
    $("time").textContent = timeLeft;
    const pct = (timeLeft / timeLimit) * 100;
    $("progressBar").style.width = pct + "%";
    $("progressPct").textContent = Math.round(pct);
    
    const elapsed = (timeLimit - timeLeft) / 60;
    const wpm = elapsed > 0 ? Math.round((correctChars / 5) / elapsed) : 0;
    wpmHistory.push(wpm);
    updateLiveChart();
    
    if (timeLeft <= 0) endTest();
  }, 1000);
}

// ============ STATS ============
function updateStats() {
  const elapsed = mode === "practice" ? 1 : (timeLimit - timeLeft) / 60 || 0.01;
  const wpm = Math.round((correctChars / 5) / elapsed);
  const acc = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
  
  $("wpm").textContent = wpm || 0;
  $("accuracy").textContent = acc;
  $("correct").textContent = correctChars;
  $("errors").textContent = incorrectChars;
  $("streak").textContent = streak;
  $("correctMini").textContent = correctChars;
  $("errorsMini").textContent = incorrectChars;
}

// ============ END TEST ============
function endTest() {
  clearInterval(timer);
  inputField.disabled = true;
  successSound();
  $("statusText").textContent = "COMPLETE";
  
  const wpm = parseInt($("wpm").textContent);
  const acc = parseInt($("accuracy").textContent);
  
  const ach = achievements.find(a => wpm >= a.wpm);
  const xpEarned = ach.xp;
  let totalXp = parseInt(localStorage.getItem("totalXp") || "0") + xpEarned;
  localStorage.setItem("totalXp", totalXp);
  const level = Math.floor(totalXp / 200) + 1;
  localStorage.setItem("level", level);
  updateUserUI(totalXp, level);
  
  saveResult(wpm, acc, correctChars, incorrectChars, maxStreak);
  
  const best = parseInt(localStorage.getItem("bestWpm") || "0");
  let isNewRecord = false;
  if (wpm > best) {
    localStorage.setItem("bestWpm", wpm);
    $("bestWpm").textContent = wpm;
    isNewRecord = true;
    if (typeof confetti !== 'undefined') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }
  
  $("finalWpm").textContent = wpm;
  $("finalAcc").textContent = acc + "%";
  $("finalCorrect").textContent = correctChars;
  $("finalErrors").textContent = incorrectChars;
  $("finalStreak").textContent = maxStreak;
  $("xpEarned").textContent = "+" + xpEarned;
  $("newRecord").style.display = isNewRecord ? "inline-block" : "none";
  
  const badge = $("achievementBadge");
  badge.textContent = ach.badge;
  badge.style.background = ach.color;
  
  renderResultChart();
  $("resultModal").classList.add("active");
}

// ============ RESET ============
function reset() {
  clearInterval(timer);
  timeLeft = timeLimit;
  $("time").textContent = timeLimit;
  $("progressBar").style.width = "100%";
  $("progressPct").textContent = "100";
  $("statusText").textContent = "READY";
  $("wpm").textContent = "0";
  $("accuracy").textContent = "100";
  $("correct").textContent = "0";
  $("errors").textContent = "0";
  $("streak").textContent = "0";
  $("correctMini").textContent = "0";
  $("errorsMini").textContent = "0";
  correctChars = 0; incorrectChars = 0;
  totalTyped = 0; streak = 0; maxStreak = 0;
  started = false;
  wpmHistory = [];
  inputField.disabled = false;
  inputField.value = "";
  inputField.focus();
  updateLiveChart();
}

// ============ USER UI ============
function updateUserUI(xp, level) {
  $("userXp").textContent = xp;
  $("levelNum").textContent = level;
  $("levelNumRight").textContent = level;
  $("xpProgress").style.width = ((xp % 200) / 2) + "%";
  $("xpNext").textContent = (200 - (xp % 200));
}

// ============ SAVE ============
function saveResult(wpm, acc, correct, errors, streakVal) {
  const username = $("username").value.trim() || "Anonymous";
  const result = {
    name: username, wpm, acc, correct, errors, streak: streakVal,
    date: new Date().toLocaleString(),
    difficulty, category, mode
  };
  let history = JSON.parse(localStorage.getItem("typingHistory") || "[]");
  history.unshift(result);
  history = history.slice(0, 50);
  localStorage.setItem("typingHistory", JSON.stringify(history));
  
  let leader = JSON.parse(localStorage.getItem("typingLeader") || "[]");
  leader.push(result);
  leader.sort((a,b) => b.wpm - a.wpm);
  leader = leader.slice(0, 10);
  localStorage.setItem("typingLeader", JSON.stringify(leader));
}

// ============ LEADERBOARD ============
function renderLeaderboard() {
  const leader = JSON.parse(localStorage.getItem("typingLeader") || "[]");
  const list = $("leaderList");
  if (leader.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--ink-mute);padding:30px;">No scores yet. Be the first! 🚀</p>';
    return;
  }
  list.innerHTML = leader.map((r, i) => {
    const medals = ["🥇","🥈","🥉"];
    const classes = ["gold","silver","bronze"];
    return `
      <div class="leader-item ${classes[i] || ''}">
        <span class="rank">${medals[i] || "#"+(i+1)}</span>
        <span class="name">${r.name}</span>
        <span class="wpm">${r.wpm} WPM</span>
        <span style="color:var(--green);font-size:11px;font-weight:700;">${r.acc}%</span>
      </div>`;
  }).join("");
}

// ============ STATS ============
function renderStats() {
  const history = JSON.parse(localStorage.getItem("typingHistory") || "[]");
  $("totalTests").textContent = history.length;
  
  if (history.length === 0) {
    $("avgWpm").textContent = "0";
    $("avgAcc").textContent = "0%";
    $("totalTime").textContent = "0m";
    $("historyList").innerHTML = '<p style="text-align:center;color:var(--ink-mute);padding:20px;">No tests yet! 📝</p>';
    return;
  }
  
  const avgWpm = Math.round(history.reduce((s,r) => s + r.wpm, 0) / history.length);
  const avgAcc = Math.round(history.reduce((s,r) => s + r.acc, 0) / history.length);
  $("avgWpm").textContent = avgWpm;
  $("avgAcc").textContent = avgAcc + "%";
  $("totalTime").textContent = Math.round(history.length * 60 / 60) + "m";
  
  const list = $("historyList");
  list.innerHTML = history.slice(0, 10).map(r => `
    <div class="history-item">
      <div style="text-align:left;">
        <b style="color:var(--accent);">${r.wpm} WPM</b> · ${r.acc}% · 🔥${r.streak || 0}<br>
        <small>${r.date} · ${r.difficulty}/${r.category}</small>
      </div>
    </div>
  `).join("");
  
  if (historyChart) historyChart.destroy();
  const ctx = $("historyChart").getContext("2d");
  const last10 = history.slice(0, 10).reverse();
  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: last10.map((_, i) => "T"+(i+1)),
      datasets: [{
        label: "WPM",
        data: last10.map(r => r.wpm),
        borderColor: "#d4654a",
        backgroundColor: "rgba(212,101,74,0.15)",
        fill: true, tension: 0.4, borderWidth: 2,
        pointRadius: 4, pointBackgroundColor: "#d4654a"
      }]
    },
    options: { 
      responsive: true, 
      plugins: { legend: { labels: { color: "#6b6359" } } }, 
      scales: { 
        y: { ticks: { color: "#6b6359" }, grid: { color: "#e8e0d0" } }, 
        x: { ticks: { color: "#6b6359" }, grid: { display: false } } 
      } 
    }
  });
}

// ============ CHARTS ============
function updateLiveChart() {
  if (liveChart) liveChart.destroy();
  const ctx = $("liveChart").getContext("2d");
  liveChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: wpmHistory.map((_,i) => i),
      datasets: [{
        data: wpmHistory,
        borderColor: "#d4654a",
        backgroundColor: "rgba(212,101,74,0.15)",
        fill: true, tension: 0.4, borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#a89f93", font: { size: 9 } }, grid: { color: "rgba(232,224,208,0.5)" } },
        x: { ticks: { display: false }, grid: { display: false } }
      }
    }
  });
}

function renderResultChart() {
  if (resultChart) resultChart.destroy();
  const ctx = $("resultChart").getContext("2d");
  resultChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Correct", "Errors"],
      datasets: [{
        data: [correctChars, incorrectChars],
        backgroundColor: ["#7a9171", "#c84444"],
        borderWidth: 0
      }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { color: "#6b6359" } } } }
  });
}

// ============ TIP ============
function showTip() {
  const tip = typingTips[Math.floor(Math.random() * typingTips.length)];
  $("tipText").textContent = tip;
}

// ============ EVENT LISTENERS ============
$("restartBtn").addEventListener("click", () => { reset(); renderText(); });
$("newTextBtn").addEventListener("click", () => { reset(); loadText(); });
$("tipBtn").addEventListener("click", showTip);
$("tryAgain").addEventListener("click", () => { $("resultModal").classList.remove("active"); reset(); loadText(); });
$("closeModal").addEventListener("click", () => $("resultModal").classList.remove("active"));

$("leaderBtn").addEventListener("click", () => { renderLeaderboard(); $("leaderModal").classList.add("active"); });
$("closeLeader").addEventListener("click", () => $("leaderModal").classList.remove("active"));
$("clearLeader").addEventListener("click", () => { if (confirm("Clear leaderboard?")) { localStorage.removeItem("typingLeader"); renderLeaderboard(); } });

$("statsBtn").addEventListener("click", () => { renderStats(); $("statsModal").classList.add("active"); });
$("closeStats").addEventListener("click", () => $("statsModal").classList.remove("active"));
$("clearHistory").addEventListener("click", () => { if (confirm("Clear history?")) { localStorage.removeItem("typingHistory"); renderStats(); } });

$("soundToggle").addEventListener("click", () => {
  soundOn = !soundOn;
  $("soundToggle").textContent = soundOn ? "🔊" : "🔇";
  localStorage.setItem("sound", soundOn);
});

$("musicToggle").addEventListener("click", () => {
  musicOn = !musicOn;
  $("musicToggle").textContent = musicOn ? "🎶" : "🎵";
  const m = $("bgMusic");
  if (musicOn) { m.volume = 0.2; m.play().catch(()=>{}); } else m.pause();
});

$("focusToggle").addEventListener("click", () => document.body.classList.toggle("focus-mode"));

$("shareBtn").addEventListener("click", () => {
  const wpm = $("finalWpm").textContent;
  const acc = $("finalAcc").textContent;
  const text = `🎉 I scored ${wpm} WPM with ${acc} accuracy on AI ToolCor Typing! ✏️\nTry: https://typingspeed.aitoolcor.com/`;
  if (navigator.share) navigator.share({ title: "My Typing Score", text });
  else { navigator.clipboard.writeText(text); alert("📋 Copied to clipboard!"); }
});

$("downloadBtn").addEventListener("click", () => {
  const wpm = $("finalWpm").textContent;
  const acc = $("finalAcc").textContent;
  const name = $("username").value || "Anonymous";
  const data = `=== AI ToolCor Typing Result ===\nName: ${name}\nWPM: ${wpm}\nAccuracy: ${acc}\nCorrect: ${correctChars}\nErrors: ${incorrectChars}\nStreak: ${maxStreak}\nDate: ${new Date().toLocaleString()}\n\nhttps://typingspeed.aitoolcor.com/`;
  const blob = new Blob([data], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `typing-result-${Date.now()}.txt`; a.click();
});

document.querySelectorAll(".seg-btn").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
    t.classList.add("active");
    mode = t.dataset.tab;
    $("modeText").textContent = mode === "test" ? "TEST MODE" : mode === "practice" ? "PRACTICE MODE" : "DAILY CHALLENGE";
    reset(); loadText();
  });
});

document.querySelectorAll(".opt-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".opt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    timeLimit = parseInt(btn.dataset.time);
    reset();
  });
});
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.level;
    reset(); loadText();
  });
});
$("categorySelect").addEventListener("change", e => { category = e.target.value; reset(); loadText(); });
$("langSelect").addEventListener("change", e => { language = e.target.value; reset(); loadText(); });
$("username").addEventListener("input", e => {
  localStorage.setItem("username", e.target.value);
  $("avatarLetter").textContent = (e.target.value[0] || "A").toUpperCase();
});

// ============ INIT ============
window.addEventListener("load", () => {
  if (localStorage.getItem("sound") === "false") { soundOn = false; $("soundToggle").textContent = "🔇"; }
  
  const savedName = localStorage.getItem("username");
  if (savedName) {
    $("username").value = savedName;
    $("avatarLetter").textContent = savedName[0].toUpperCase();
  }
  
  $("bestWpm").textContent = localStorage.getItem("bestWpm") || "0";
  const totalXp = parseInt(localStorage.getItem("totalXp") || "0");
  updateUserUI(totalXp, Math.floor(totalXp / 200) + 1);
  
  loadText();
  inputField.focus();
  showTip();
});