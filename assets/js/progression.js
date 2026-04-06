
const STORAGE_KEY="learning_progress_v2";
function getProgress(){return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}
function saveProgress(d){localStorage.setItem(STORAGE_KEY,JSON.stringify(d))}
function completeCourse(id){const p=getProgress();p[id]=true;saveProgress(p)}
function isDone(id){return !!getProgress()[id]}
function getUnlockedStage(){
 const courses=document.querySelectorAll(".course");
 const progress=getProgress();
 for(let s=1;s<=5;s++){
  const sc=[...courses].filter(c=>+c.dataset.stage===s);
  if(!sc.every(c=>progress[c.dataset.id])) return s;
 }
 return 5;
}
function applyLocks(){
 const unlocked=getUnlockedStage();
 document.querySelectorAll(".course").forEach(c=>{
  const stage=+c.dataset.stage;
  if(stage>unlocked){
    c.style.opacity="0.4";
    c.style.pointerEvents="none";
    c.insertAdjacentHTML("beforeend","<div>🔒 Locked</div>");
  }
 });
}
function updateToday(){
 const progress=getProgress();
 const courses=[...document.querySelectorAll(".course")];
 const unlocked=getUnlockedStage();
 const next=courses.find(c=>+c.dataset.stage===unlocked && !progress[c.dataset.id]);
 const el=document.getElementById("today-session");
 if(!el) return;
 if(!next){el.innerHTML="🎉 Done";return;}
 el.innerHTML="Stage "+unlocked+"<br>"+next.innerText;
}
document.addEventListener("DOMContentLoaded",()=>{
 document.querySelectorAll(".course").forEach((c,i)=>{
   if(!c.dataset.id) c.dataset.id="auto-"+i;
   if(!c.dataset.stage) c.dataset.stage="1";
   c.addEventListener("click",()=>{
     completeCourse(c.dataset.id);
     location.reload();
   });
 });
 applyLocks();
 updateToday();
});
