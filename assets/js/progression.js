const STORAGE_KEY = "learning_progress_v2";

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
