const STORAGE_KEY = "learning_progress_v3";

function getProgress() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function completeCourse(id) {
  const p = getProgress();
  p[id] = true;
  saveProgress(p);
}

function isDone(id) {
  return !!getProgress()[id];
}

/* 🔥 AUTO STAGE DETECTION */
function assignStages() {
  let currentStage = 1;

  document.querySelectorAll("h2, h3").forEach(header => {
    const text = header.innerText.toLowerCase();

    if (text.includes("stage")) {
      const match = text.match(/stage\\s*(\\d+)/);
      if (match) currentStage = parseInt(match[1]);
    }

    let el = header.nextElementSibling;

    while (el && !["H2","H3"].includes(el.tagName)) {
      if (el.classList.contains("course")) {
        el.dataset.stage = currentStage;
      }
      el = el.nextElementSibling;
    }
  });
}

/* AUTO ID ASSIGN */
function assignIDs() {
  document.querySelectorAll(".course").forEach((c, i) => {
    if (!c.dataset.id) {
      c.dataset.id = "course-" + i;
    }
  });
}

/* UNLOCK LOGIC */
function getUnlockedStage() {
  const courses = document.querySelectorAll(".course");
  const progress = getProgress();

  for (let stage = 1; stage <= 5; stage++) {
    const stageCourses = [...courses].filter(c => +c.dataset.stage === stage);

    if (stageCourses.length === 0) continue;

    const allDone = stageCourses.every(c => progress[c.dataset.id]);

    if (!allDone) return stage;
  }

  return 5;
}

/* LOCK SYSTEM */
function applyLocks() {
  const unlocked = getUnlockedStage();

  document.querySelectorAll(".course").forEach(c => {
    const stage = +c.dataset.stage;

    if (stage > unlocked) {
      c.style.opacity = "0.4";
      c.style.pointerEvents = "none";

      if (!c.querySelector(".lock")) {
        c.insertAdjacentHTML("beforeend", "<div class='lock'>🔒 Locked</div>");
      }
    }
  });
}

/* CLICK TRACKING */
function bindClicks() {
  document.querySelectorAll(".course").forEach(c => {
    c.addEventListener("click", () => {
      completeCourse(c.dataset.id);
      location.reload();
    });
  });
}

/* TODAY SESSION */
function updateToday() {
  const progress = getProgress();
  const courses = [...document.querySelectorAll(".course")];
  const unlocked = getUnlockedStage();

  const next = courses.find(c =>
    +c.dataset.stage === unlocked && !progress[c.dataset.id]
  );

  const el = document.getElementById("today-session");

  if (!el) return;

  if (!next) {
    el.innerHTML = "🎉 Stage Complete";
    return;
  }

  el.innerHTML = `
    <strong>Stage ${unlocked}</strong><br/>
    ${next.innerText}
  `;
}

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  assignStages();   // 🔥 automatic
  assignIDs();
  bindClicks();
  applyLocks();
  updateToday();
});
