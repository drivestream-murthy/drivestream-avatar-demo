document.addEventListener('DOMContentLoaded', () => {
  const els = {
    start: document.getElementById('btnStart'),
    send: document.getElementById('btnSend'),
    input: document.getElementById('textInput'),
    status: document.getElementById('status'),
    videoWrapper: document.getElementById('videoWrapper'),
    videoFrame: document.getElementById('videoFrame'),
    unmute: document.getElementById('btnUnmute'),
    closeVideo: document.getElementById('btnCloseVideo'),
    mic: document.getElementById('btnMic'),
    avatar: document.getElementById('avatarStub'),
    container: document.getElementById('avatarContainer'),
    micStatus: document.getElementById('micStatus'),
    lastTranscript: document.getElementById('lastTranscript')
  };

  function speak(t){ try{ if('speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(t); speechSynthesis.cancel(); speechSynthesis.speak(u);} }catch{} }
  function say(t,voice=false){ if(els.status) els.status.textContent=t; if(voice) speak(t); }

  const STATE = { IDLE:'idle', CHOICE:'choice', ASK_VIDEO:'ask_video', PLAYING:'playing' };
  const ctx = { session:false, state:STATE.IDLE, idle:null, rec:null, recOn:false, lowered:false, pending:null };

  function idle(){ clearTimeout(ctx.idle); ctx.idle = setTimeout(()=>say('Still there? (yes/no)', false), 30000); }
  function lower(b){ if(!els.avatar) return; if(b && !ctx.lowered){ els.avatar.classList.add('lowered'); ctx.lowered = true; } else if(!b && ctx.lowered){ els.avatar.classList.remove('lowered'); ctx.lowered = false; } }

  function bgFromText(t){
    if(/harvard/i.test(t)) return "./public/harvard-university-title.jpg";
    if(/oxford/i.test(t))  return "./public/oxford-university-title.jpg";
    if(/stanford/i.test(t))return "./public/stanford-university-title.jpg";
    return "./public/default-image.jpg";
  }
  function maybeBG(t){ if(els.container){ const img=bgFromText(t); els.container.style.background = `#000 url('${img}') center/cover no-repeat`; } }

  function norm(s){ return (s||'').toLowerCase().trim().replace(/[^\w\s]/g,' ').replace(/\s+/g,' '); }
  function isYes(s){ return /\b(yes|yeah|yep|sure|ok|okay|y)\b/.test(s); }
  function isNo(s){ return /\b(no|nope|n)\b/.test(s); }
  function isBoth(s){ return /\b(both|both modules|explain both)\b/.test(s); }
  function isMod1(s){ return /\b(module 1|module1|mod 1|mod1|m1|one|1|finance)\b/.test(s); }
  function isMod2(s){ return /\b(module 2|module2|mod 2|mod2|m2|two|2|procurement|payables)\b/.test(s); }

  function startSession(){
    ctx.session = true; ctx.state = STATE.CHOICE; idle();
    say('Hi! I can walk you through Module 1 or Module 2, or both. Which would you like?', true);
  }
  function handleChoice(t){
    const s = norm(t);
    if(isBoth(s)){ ctx.pending='1'; ctx.state=STATE.ASK_VIDEO; say('Module 1 first. Play a quick video? yes or no?', true); return; }
    if(isMod1(s)){ ctx.pending='1'; ctx.state=STATE.ASK_VIDEO; say('Module 1. Play a quick video? yes or no?', true); return; }
    if(isMod2(s)){ ctx.pending='2'; ctx.state=STATE.ASK_VIDEO; say('Module 2. Play a quick video? yes or no?', true); return; }
    say('Please say "module 1", "module 2", or "both".', false);
  }
  function handleVideoConfirm(t){
    const s = norm(t);
    if(isYes(s)){ playVideo(ctx.pending==='1' ? 'dQw4w9WgXcQ' : 'tgbNymZ7vqY'); say('Playing the video.', false); return; }
    if(isNo(s)){ ctx.state=STATE.CHOICE; say('Okay. Choose Module 1, Module 2, or both.', false); return; }
    say('Please say yes or no.', false);
  }

  function playVideo(id){
    ctx.state = STATE.PLAYING; lower(true);
    if(els.videoWrapper) els.videoWrapper.classList.remove('hidden');
    if(els.videoFrame) els.videoFrame.innerHTML = `<iframe id="yt" src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  }
  function closeVideo(){
    if(els.videoFrame) els.videoFrame.innerHTML = '';
    if(els.videoWrapper) els.videoWrapper.classList.add('hidden');
    lower(false);
    ctx.state = STATE.CHOICE;
    say('Video closed. Choose Module 1, Module 2, or both.', false);
  }

  function handleInput(raw){
    const t = (raw||'').trim(); if(!t) return;
    idle(); maybeBG(t);

    if(!ctx.session){
      const s = norm(t);
      if(/\b(hello|hi|hey|start|begin)\b/.test(s)){ startSession(); }
      else say('Say "hello" to begin.', false);
      return;
    }
    if(ctx.state === STATE.CHOICE) return handleChoice(t);
    if(ctx.state === STATE.ASK_VIDEO) return handleVideoConfirm(t);
    if(ctx.state === STATE.PLAYING && /\b(close|stop)\b/.test(norm(t))) return closeVideo();
  }

  function initRec(){
    const C = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!C) return null;
    const r = new C();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = e=>{
      const tx = e.results[e.results.length-1][0].transcript || '';
      const tEl = document.getElementById('lastTranscript'); if(tEl) tEl.textContent = tx.trim();
      handleInput(tx);
    };
    r.onstart = ()=>{ const sEl=document.getElementById('micStatus'); if(sEl) sEl.textContent='listening'; };
    r.onend = ()=>{ const sEl=document.getElementById('micStatus'); if(sEl) sEl.textContent='stopped'; if(ctx.recOn){ tryStartRec(); } };
    r.onerror = ev=>{ const sEl=document.getElementById('micStatus'); if(sEl) sEl.textContent='error'; console.warn('rec error', ev.error); ctx.recOn=false; if(els.mic) els.mic.textContent='Mic: Off'; };
    return r;
  }
  function tryStartRec(){
    try{ if(ctx.rec) ctx.rec.start(); const sEl=document.getElementById('micStatus'); if(sEl) sEl.textContent='listening'; }
    catch{ setTimeout(()=>{ try{ ctx.rec && ctx.rec.start(); }catch{} }, 500); }
  }
  function toggleMic(){
    if(!ctx.rec) ctx.rec = initRec();
    if(!ctx.rec){ alert('Mic not supported in this browser. Use Chrome.'); return; }
    ctx.recOn = !ctx.recOn;
    if(els.mic) els.mic.textContent = ctx.recOn ? 'Mic: On' : 'Mic: Off';
    if(ctx.recOn) tryStartRec(); else { try{ ctx.rec.stop(); }catch{} }
  }

  if(els.start) els.start.addEventListener('click', startSession);
  if(els.send)  els.send.addEventListener('click', ()=>{ handleInput(els.input.value); els.input.value=''; });
  if(els.input) els.input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ handleInput(els.input.value); els.input.value=''; } });
  if(els.unmute) els.unmute.addEventListener('click', ()=>{ const f=document.getElementById('yt'); if(f) f.src=f.src.replace('mute=1','mute=0'); });
  if(els.closeVideo) els.closeVideo.addEventListener('click', closeVideo);
  if(els.mic) els.mic.addEventListener('click', toggleMic);
  document.querySelectorAll('[data-quick]').forEach(b=> b.addEventListener('click', ()=> handleInput(b.getAttribute('data-quick'))));

  console.log('Ready: event listeners attached ✅');
});
