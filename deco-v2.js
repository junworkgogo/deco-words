"use strict";
/* DECO WORDS 2.0: standalone enhancement to original translator */
(() => {
  const root = document.getElementById("form");
  const out = document.getElementById("result-body");
  if (!root || !out) return;
  const make = (tag, attributes = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "text") e.textContent = value;
      else if (key === "class") e.className = value;
      else e.setAttribute(key, value);
    }
    for (const child of children.flat()) if (child != null) e.append(child);
    return e;
  };
  const $dw = id => document.getElementById(id);
  const styles = [{id:"luxury",zh:"精品高級"},{id:"minimal",zh:"極簡俐落"},{id:"impact",zh:"廣告吸睛"}];
  let length = "standard", selected = 0, entries = [], loading = false;
  const storageKey = "decoWords.favorites.v2";
  let favorites = [];
  try {
    const loaded = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(loaded)) favorites = loaded.filter(x => x && typeof x.text === "string").slice(0, 500);
  } catch (_) {}
  const formBox = make("section",{"class":"dw-panel","aria-label":"英文提案設定"},
    make("h3",{text:"DECO WORDS 2.0 · 英文文案提案"}),
    make("p",{"class":"dw-note",text:"保留原本完整翻譯，新增英文長度與三種不同語氣"}),
    make("div",{"class":"dw-options",id:"dw-length"}),
    make("button",{type:"button",id:"dw-generate","class":"btn btn-primary",text:"✦ 生成三種英文語氣"}),
    make("p",{"class":"dw-status",id:"dw-status",role:"status","aria-live":"polite"})
  );
  root.classList.add("dw-form");
  document.querySelector(".side").classList.add("dw-sidebar");
  root.insertBefore(make("div",{"class":"dw-form-heading"},
    make("span",{"class":"dw-eyebrow",text:"01  /  YOUR COPY"}),
    make("h2",{text:"中文文案"}),
    make("p",{text:"從中文出發，找到更適合設計排版的英文"})),root.firstElementChild);
  root.insertBefore(formBox,root.querySelector(".actions"));
  const results = make("section",{"class":"dw-panel",id:"dw-results","aria-label":"三種語氣英文提案"},
    make("h3",{text:"三種語氣英文提案"}),
    make("div",{id:"dw-cards"}),
    make("section",{id:"dw-typesetter"},
      make("h3",{text:"英文排版預覽"}),
      make("div",{"class":"dw-fields",id:"dw-fields"}),
      make("div",{"class":"dw-preview",id:"dw-preview"}),
      make("div",{"class":"dw-actions"},make("button",{type:"button",id:"dw-copy-preview",text:"複製排版文字"}))
    )
  );
  results.hidden = true;
  const favoritesBox = make("section",{"class":"dw-panel","aria-label":"英文收藏庫"},
    make("div",{"class":"dw-card-head"},make("h3",{text:"英文收藏庫"}),
      make("div",{"class":"dw-actions"},make("button",{id:"dw-export",type:"button",text:"匯出備份"}))),
    make("p",{"class":"dw-note",text:"只儲存在目前瀏覽器；重要內容請匯出 JSON 備份"}),
    make("div",{"class":"dw-fields"},
      make("input",{id:"dw-search",type:"text",placeholder:"搜尋收藏","aria-label":"搜尋收藏"}),
      make("label",{}, "匯入備份 ",make("input",{id:"dw-import",type:"file",accept:".json,application/json"}))
    ),
    make("div",{id:"dw-favorites"})
  );
  const parent = out.parentNode;
  const nav = make("nav",{"class":"dw-view-tabs","aria-label":"結果檢視模式"});
  const stage = make("div",{"class":"dw-workspace",id:"dw-workspace"});
  const legacyBox = make("div",{"class":"dw-legacy"});
  legacyBox.append(out);
  stage.append(results,favoritesBox,legacyBox);
  parent.append(nav,stage);
  const tabs = [
    {id:"proposal",text:"三種英文提案"},
    {id:"legacy",text:"完整翻譯"},
    {id:"favorites",text:"我的收藏"}
  ];
  let currentView = "proposal";
  function switchView(view) {
    currentView=view;
    results.hidden=view!=="proposal";
    favoritesBox.hidden=view!=="favorites";
    legacyBox.hidden=view!=="legacy";
    nav.replaceChildren(...tabs.map(t=>{
      const btn=make("button",{
        type:"button",text:t.text,
        "aria-current":view===t.id?"page":"false"
      });
      btn.addEventListener("click",()=>switchView(t.id));
      return btn;
    }));
    stage.scrollTop=0;
  }
  root.addEventListener("submit",()=>switchView("legacy"));
  document.getElementById("btn-again").addEventListener("click",()=>switchView("legacy"));
  switchView("proposal");
  const status = text => { $dw("dw-status").textContent = text; };
  const button = (label, onClick) => { const b = make("button",{type:"button",text:label});b.addEventListener("click",onClick);return b; };
  const lengths = [{id:"short",label:"極短 1–3 字"},{id:"standard",label:"標準 4–6 字"},{id:"long",label:"完整 7–12 字"}];
  function drawLengths() {
    const box = $dw("dw-length");
    box.replaceChildren(...lengths.map(item => button(item.label,() => {length=item.id;drawLengths();})));
    Array.from(box.children).forEach((btn,i) => btn.setAttribute("aria-pressed",String(lengths[i].id === length)));
  }
  drawLengths();
  const select = (name, items) => {
    const el = make("select",{id:"dw-"+name});
    for (const [value,label] of items) el.append(make("option",{value,text:label}));
    el.addEventListener("change",drawPreview);
    return make("label",{}, name === "case" ? "大小寫 " : name === "lines" ? "斷行 " : "字距 ",el);
  };
  $dw("dw-fields").append(
    select("case",[["original","原樣"],["upper","全大寫"],["lower","全小寫"]]),
    select("lines",[["single","單行"],["double","雙行"]]),
    select("spacing",[["0","標準"],["1","寬鬆"],["2","加寬"]])
  );
  const previewText = () => {
    const entry = entries[selected];if (!entry) return "";
    let text = entry.text;
    if ($dw("dw-case").value === "upper") text = text.toUpperCase();
    if ($dw("dw-case").value === "lower") text = text.toLowerCase();
    if ($dw("dw-lines").value === "double") {
      const words = text.trim().split(/\s+/), mid = Math.ceil(words.length / 2);
      if (words.length > 1) text = words.slice(0,mid).join(" ")+"\n"+words.slice(mid).join(" ");
    }
    return text;
  };
  function drawPreview() {
    const p = $dw("dw-preview");
    p.textContent = entries.length ? previewText() : "選取英文提案後，這裡會顯示排版預覽";
    p.style.letterSpacing = ["0em",".065em",".13em"][Number($dw("dw-spacing").value)];
  }
  const copy = async text => {
    try {await navigator.clipboard.writeText(text);status("已複製到剪貼簿");}
    catch (_) {status("無法存取剪貼簿，請手動選取文字");}
  };
  function saveFavorites() {
    try {localStorage.setItem(storageKey,JSON.stringify(favorites));}
    catch (_) {status("儲存失敗，可能是瀏覽器已停用本機儲存");}
  }
  function toggleFavorite(i) {
    const item = entries[i], old = favorites.find(x => x.text === item.text);
    if (old) favorites = favorites.filter(x => x.id !== old.id);
    else favorites.unshift({id:Date.now()+"-"+Math.random().toString(36).slice(2),text:item.text,zh:item.zh,style:styles[i].zh,created:new Date().toISOString()});
    favorites = favorites.slice(0,500);
    saveFavorites();drawFavorites();drawEntries();
  }
  function drawEntries() {
    const host = $dw("dw-cards");
    host.replaceChildren();
    if (!entries.length) {
      styles.forEach((style,i)=>{
        host.append(make("article",{"class":"dw-card dw-card-empty"},
          make("div",{"class":"dw-card-head"},make("h4",{text:(i+1)+" / "+style.zh}),
            make("span",{"class":"dw-empty-label",text:"待生成"})),
          make("p",{text:["Refined English for Your Story","Clean Words, Clear Meaning","Make Every Word Count"][i]}),
          make("div",{"class":"dw-note",text:"輸入中文並點擊左側的生成按鈕，即可在這裡查看文案"})
        ));
      });
    }
    entries.forEach((entry,i) => {
      const actions = make("div",{"class":"dw-actions"});
      actions.append(button(selected === i ? "✓ 預覽中" : "預覽",()=>{selected=i;drawEntries();}));
      actions.append(button(favorites.some(x=>x.text===entry.text) ? "★ 已收藏" : "☆ 收藏",()=>toggleFavorite(i)));
      const regenerate = button("↻ 單句重生",()=>generate(i));regenerate.disabled=loading;actions.append(regenerate);
      actions.append(button("複製",()=>copy(entry.text)));
      host.append(make("article",{"class":"dw-card"},
        make("div",{"class":"dw-card-head"},make("h4",{text:(i+1)+" / "+styles[i].zh}),actions),
        make("p",{text:entry.text}),make("div",{"class":"dw-note",text:entry.zh || ""})
      ));
    });
    $dw("dw-typesetter").hidden = false;
    drawPreview();
  }
  function drawFavorites() {
    const host=$dw("dw-favorites"), query=$dw("dw-search").value.toLowerCase();
    host.replaceChildren();
    const matching = favorites.filter(x=>(x.text+" "+(x.zh||"")).toLowerCase().includes(query));
    matching.forEach(item=>{
      host.append(make("div",{"class":"dw-fav-row"},make("span",{text:item.text}),
        make("div",{"class":"dw-actions"},button("複製",()=>copy(item.text)),
          button("移除",()=>{favorites=favorites.filter(x=>x.id!==item.id);saveFavorites();drawFavorites();drawEntries();}))
      ));
    });
    if (!matching.length) host.append(make("p",{"class":"dw-note",text:"尚無符合的收藏"}));
  }
  $dw("dw-copy-preview").addEventListener("click",()=>copy(previewText()));
  $dw("dw-search").addEventListener("input",drawFavorites);
  $dw("dw-export").addEventListener("click",()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(favorites,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="deco-words-favorites.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $dw("dw-import").addEventListener("change",async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      const incoming=JSON.parse(await file.text());
      if(!Array.isArray(incoming))throw Error("格式錯誤");
      const seen=new Set(favorites.map(x=>x.text));
      for(const x of incoming.slice(0,500)) {
        if(!x||typeof x.text!=="string"||!x.text.trim()||x.text.length>500||seen.has(x.text))continue;
        favorites.push({id:Date.now()+"-"+Math.random().toString(36).slice(2),text:x.text,zh:String(x.zh||""),style:String(x.style||""),created:String(x.created||"")});
        seen.add(x.text);
      }
      favorites=favorites.slice(0,500);saveFavorites();drawFavorites();status("收藏已匯入");
    } catch (_) {status("匯入失敗，請確認檔案是 DECO WORDS 收藏 JSON");}
    event.target.value="";
  });
  function getPrompt(index) {
    const input=readForm();
    const range={short:"1–3",standard:"4–6",long:"7–12"}[length];
    let prompt="你是專業的繁體中文與英文廣告文案編輯。英文須自然、保留原意、不生硬直譯、不添加未經證實的產品或建案宣稱。只回傳 JSON。";
    prompt+="\n中文主標："+input.title+"\n中文副標："+(input.sub||"無");
    prompt+="\n補充說明："+pickedText(els.ticks,els.otherBox,els.other);
    prompt+="\n避免提及："+pickedText(els.avoidTicks,els.avoidOtherBox,els.avoidOther,true);
    prompt+="\n每則英文目標："+range+" 個英文單字；保持英文自然優先。";
    if(index === null) {
      prompt+="\n請分別輸出 3 個有區別的版本，style 必須依序是 luxury（精品高級）、minimal（極簡俐落）、impact（廣告吸睛）。";
      prompt+='\n格式：{"results":[{"style":"luxury","text":"英文","zh":"繁中大意"},{"style":"minimal","text":"英文","zh":"繁中大意"},{"style":"impact","text":"英文","zh":"繁中大意"}]}';
    } else {
      prompt+="\n只產生一組 "+styles[index].id+"（"+styles[index].zh+"）英文，且不得跟舊版相同。舊句："+entries[index].text;
      prompt+='\n格式：{"text":"新英文","zh":"繁中大意"}';
    }
    return prompt;
  }
  async function ask(index,signal) {
    if(!model) {model=await findModel(apiKey,signal);saveLS(LS_MODEL,model);showKeyState(false);}
    const payload={systemInstruction:{parts:[{text:"Return a valid JSON object only. Never use markdown fences."}]},
      contents:[{role:"user",parts:[{text:getPrompt(index)}]}]},generationConfig:{responseMimeType:"application/json"}};
    let response;
    try {response=await gfetch("models/"+encodeURIComponent(model)+":generateContent",apiKey,{method:"POST",signal,body:JSON.stringify(payload)});}
    catch(error) {
      if(!(error instanceof ApiError&&error.status===400&&FORMAT_ERR.test(error.detail)))throw error;
      delete payload.generationConfig;
      response=await gfetch("models/"+encodeURIComponent(model)+":generateContent",apiKey,{method:"POST",signal,body:JSON.stringify(payload)});
    }
    const candidate=response&&response.candidates&&response.candidates[0];
    if(!candidate||!candidate.content||!Array.isArray(candidate.content.parts)||BLOCKED.includes(candidate.finishReason))throw new ApiError("incomplete");
    const parsed=readJSON(candidate.content.parts.filter(p=>typeof p.text==="string"&&!p.thought).map(p=>p.text).join(""));
    if(!parsed)throw new ApiError("incomplete");
    return parsed;
  }
  async function generate(index=null) {
    if(loading||busy)return;
    if(!apiKey){status("請先設定 Gemini 金鑰");showKeyState(true);return;}
    if(!els.title.value.trim()){status("請先輸入中文主標");els.title.focus();return;}
    if(!(await allowOverLimit()))return;
    loading=true;$dw("dw-generate").disabled=true;
    status(index===null?"正在生成三組英文…":"正在重新生成 "+styles[index].zh+"…");
    drawEntries();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try {
      const data=await ask(index,controller.signal);
      if(index===null) {
        if(!Array.isArray(data.results))throw new ApiError("incomplete");
        const ordered=styles.map(s=>data.results.find(x=>x&&x.style===s.id));
        if(ordered.some(x=>!x||typeof x.text!=="string"||!x.text.trim()))throw new ApiError("incomplete");
        entries=ordered.map(x=>({text:x.text.replace(/\s+/g," ").trim(),zh:String(x.zh||"")}));
        selected=0;
      } else {
        if(typeof data.text!=="string"||!data.text.trim()||data.text.trim()===entries[index].text)throw new ApiError("incomplete");
        entries[index]={text:data.text.replace(/\s+/g," ").trim(),zh:String(data.zh||"")};
      }
      status("已完成，可預覽、收藏或個別重生");drawEntries();switchView("proposal");
      if(index===null&&isNarrow())results.scrollIntoView({block:"start",behavior:reduceMotion()?"auto":"smooth"});
    } catch(error) {
      const kind=error instanceof ApiError ? error.kind : "unknown";
      status((MESSAGES[kind]||MESSAGES.unknown).text+"（原結果已保留）");
    } finally {
      clearTimeout(timer);loading=false;$dw("dw-generate").disabled=false;drawEntries();
    }
  }
  $dw("dw-generate").addEventListener("click",()=>generate());
  drawFavorites();
  drawEntries();
})();
