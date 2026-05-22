// AI Writer Bookmarklet - runs on any webpage
(function(){
  var d=document;
  if(d.getElementById('aiw-bookmark')){alert('Already active');return}

  // Get API key
  var k=d.cookie.replace(/(?:(?:^|.*;\s*)aiw_key\s*=\s*([^;]*).*$)|^.*$/,'$1');
  if(!k){k=prompt('DeepSeek API Key (sk-...)','');if(!k)return;d.cookie='aiw_key='+k+';max-age=31536000;path=/'}

  // Create UI
  var m=d.createElement('div');m.id='aiw-bookmark';
  m.innerHTML='<div id=aiwb-menu style="position:fixed;z-index:2147483647;display:none;gap:4px;padding:5px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);font:13px -apple-system,sans-serif"><button id=aiwb-polish style="border:none;background:transparent;padding:7px 14px;border-radius:7px;font-size:13px;cursor:pointer;color:#7c3aed">Polish</button><button id=aiwb-translate style="border:none;background:transparent;padding:7px 14px;border-radius:7px;font-size:13px;cursor:pointer;color:#2563eb">Translate</button></div><div id=aiwb-panel style="position:fixed;z-index:2147483646;display:none;min-width:200px;max-width:480px;max-height:80vh;overflow-y:auto;background:#fff;border:1px solid #e0e0e0;border-radius:16px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);font:14px -apple-system,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:#7c3aed"></div><span id=aiwb-label style="font-size:13px;color:#7c3aed;font-weight:500"></span></div><button id=aiwb-close style="background:none;border:none;cursor:pointer;color:#aaa;font-size:18px">X</button></div><div id=aiwb-output style="background:#f5f5f5;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:20px;color:#1a1a1a;font-weight:500;line-height:1.6;white-space:pre-wrap;min-height:40px"></div><div id=aiwb-actions style="display:none;gap:8px"><button id=aiwb-copy style="flex:1;padding:10px;border-radius:10px;border:1px solid #ddd;background:#f5f5f5;font-size:14px;cursor:pointer">Copy</button><button id=aiwb-replace style="flex:1;padding:10px;border-radius:10px;border:none;background:#7c3aed;color:#fff;font-size:14px;cursor:pointer">Replace</button></div></div>';
  d.body.appendChild(m);

  var menu=d.getElementById('aiwb-menu'),panel=d.getElementById('aiwb-panel');
  var sT='',sR=null;

  function show(x,y){menu.style.left=x+'px';menu.style.top=y+'px';menu.style.display='flex'}
  function hide(){menu.style.display='none'}

  d.addEventListener('mouseup',function(){setTimeout(function(){
    var s=window.getSelection(),t=s?s.toString().trim():'';
    if(!t||t.length<2){hide();return}
    sT=t;
    try{sR=s.getRangeAt(0)}catch(e){return}
    var r=sR.getBoundingClientRect();
    if(!r||!r.width){
      var a=d.activeElement;
      if(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))r=a.getBoundingClientRect();
      else return;
    }
    var cn=(t.match(/[\u4e00-\u9fff]/g)||[]).length/t.replace(/\s/g,'').length>0.3;
    d.getElementById('aiwb-polish').textContent=cn?'\u6da6\u8272':'Polish';
    d.getElementById('aiwb-translate').textContent=cn?'\u8bd1\u6210\u82f1\u6587':'Translate';
    show(r.right+6,r.top-40);
  },10)});

  d.addEventListener('mousedown',function(e){
    if(!menu.contains(e.target))hide();
    if(!panel.contains(e.target))panel.style.display='none';
  });

  async function act(action){
    hide();
    var cn=sT.match(/[\u4e00-\u9fff]/g);
    cn=cn?cn.length/sT.replace(/\s/g,'').length>0.3:false;
    d.getElementById('aiwb-label').textContent=action==='polish'?(cn?'\u6da6\u8272':'Polish'):(cn?'\u8bd1\u6210\u82f1\u6587':'Translate');
    d.getElementById('aiwb-output').innerHTML='<div style="text-align:center;padding:20px;color:#999">Processing...</div>';
    d.getElementById('aiwb-actions').style.display='none';
    panel.style.display='block';
    panel.style.left=Math.min(window.innerWidth-496,Math.max(16,(window.innerWidth-480)/2))+'px';
    panel.style.top=(window.scrollY+40)+'px';

    var sys,p;
    if(action==='polish'){
      sys=cn?'\u4f60\u662f\u4e13\u4e1a\u4e2d\u6587\u5199\u4f5c\u8005\uff0c\u53ea\u8f93\u51fa\u6da6\u8272\u540e\u7684\u6587\u672c\u3002':'You are a professional writer. Output only polished text.';
      p=cn?'\u6da6\u8272\u4ee5\u4e0b\u6587\u5b57\uff0c\u4fdd\u6301\u539f\u610f\uff1a\n\n'+sT:'Polish this text:\n\n'+sT;
    }else{
      sys=cn?'\u4f60\u662f\u4e13\u4e1a\u7ffb\u8bd1\uff0c\u53ea\u8f93\u51fa\u82f1\u6587\u8bd1\u6587\u3002':'\u4f60\u662f\u4e13\u4e1a\u7ffb\u8bd1\uff0c\u53ea\u8f93\u51fa\u4e2d\u6587\u8bd1\u6587\u3002';
      p=cn?'\u7ffb\u8bd1\u6210\u82f1\u6587\uff1a\n\n'+sT:'Translate to Chinese:\n\n'+sT;
    }
    try{
      var rsp=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:sys},{role:'user',content:p}],temperature:0.7,max_tokens:2048})});
      var dd=await rsp.json();
      if(!rsp.ok)throw new Error(dd.error?dd.error.message:'Error '+rsp.status);
      d.getElementById('aiwb-output').textContent=dd.choices[0].message.content;
      d.getElementById('aiwb-actions').style.display='flex';
    }catch(e){
      d.getElementById('aiwb-output').innerHTML='<div style="color:#dc2626;text-align:center;padding:20px">'+e.message+'</div>';
    }
  }

  d.getElementById('aiwb-polish').onclick=function(e){e.preventDefault();e.stopPropagation();act('polish')};
  d.getElementById('aiwb-translate').onclick=function(e){e.preventDefault();e.stopPropagation();act('translate')};
  d.getElementById('aiwb-close').onclick=function(){panel.style.display='none'};
  d.getElementById('aiwb-copy').onclick=function(){navigator.clipboard.writeText(d.getElementById('aiwb-output').textContent);this.textContent='Copied';setTimeout(function(){d.getElementById('aiwb-copy').textContent='Copy'},2000)};
  d.getElementById('aiwb-replace').onclick=function(){
    var t=d.getElementById('aiwb-output').textContent;
    try{
      var a=d.activeElement;
      if(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT')){a.value=t;a.dispatchEvent(new Event('input',{bubbles:true}))}
      else if(sR){sR.deleteContents();sR.insertNode(d.createTextNode(t))}
      else{navigator.clipboard.writeText(t)}
    }catch(e){navigator.clipboard.writeText(t)}
    panel.style.display='none';
  };
})();
