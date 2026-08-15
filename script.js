const theme=document.getElementById('themeToggle');const menu=document.getElementById('menuBtn');const mobile=document.getElementById('mobileNav');const search=document.getElementById('searchBtn');const panel=document.getElementById('searchPanel');
function setTheme(v){document.body.classList.toggle('dark',v==='dark');localStorage.setItem('maarif-theme',v)}
const saved=localStorage.getItem('maarif-theme');if(saved)setTheme(saved);else if(matchMedia('(prefers-color-scheme: dark)').matches)setTheme('dark');
theme?.addEventListener('click',()=>setTheme(document.body.classList.contains('dark')?'light':'dark'));menu?.addEventListener('click',()=>mobile.classList.toggle('open'));search?.addEventListener('click',()=>panel.style.display=panel.style.display==='block'?'none':'block');
