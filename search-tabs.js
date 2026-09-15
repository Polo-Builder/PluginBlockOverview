(() => {
  if (!["/", "/search", "/webhp"].includes(location.pathname)) return;
  const controls = 'a, [role="tab"], button, [role="link"]';
  const known = /^(web|tous|all|images?|vidéos?|videos?|vidéos courtes|short videos|actualités|news|mode ia|ai mode|shopping|finance|livres|books|maps|plus|more)$/i;
  const wanted = [["web","Web","udm","web"],["news","Actualités","tbm","nws"],["images","Images","udm","2"],["videos","Vidéos","udm","7"],["maps","Maps",null,null]];
  const norm = (value) => (value || "").replace(/\s+/g, " ").trim();
  const originals = new Map(), positions = new Map();
  let enabled = false, scheduled = false;

  function urlOf(node) { try { return node.getAttribute("href") ? new URL(node.getAttribute("href"), location.href) : null; } catch { return null; } }
  function isAi(node) {
    const label = norm(node.textContent) || norm(node.getAttribute("aria-label"));
    const url = urlOf(node);
    return /^(mode ia|ai mode)$/i.test(label) ||
      (url?.origin === location.origin && url.pathname === "/search" && url.searchParams.get("udm") === "50");
  }
  function isTab(node) {
    if (/^(outils|tools)$/i.test(norm(node.textContent))) return false;
    const url = urlOf(node);
    return (url?.origin === location.origin && url.pathname === "/search" && url.searchParams.has("q")) ||
      (url?.hostname.endsWith("google.com") && url.pathname.startsWith("/maps")) || known.test(norm(node.textContent));
  }
  function kind(node) {
    const label = norm(node.textContent), url = urlOf(node);
    if (url?.pathname.startsWith("/maps") || /^maps$/i.test(label)) return "maps";
    if (url?.searchParams.get("tbm") === "nws" || /^(actualités|news)$/i.test(label)) return "news";
    if (url?.searchParams.get("udm") === "2" || /^images?$/i.test(label)) return "images";
    if (url?.searchParams.get("udm") === "7" || /^vidéos?$/i.test(label)) return "videos";
    if (["web","14"].includes(url?.searchParams.get("udm")) || /^web$/i.test(label)) return "web";
    return null;
  }
  function findRow() {
    for (const surface of document.querySelectorAll('#hdtb, #top_nav, nav, [role="navigation"]')) {
      const nodes = [...surface.querySelectorAll(controls)].filter(isTab);
      if (nodes.length < 5) continue;
      for (let row = nodes[0].parentElement; row && row !== surface; row = row.parentElement) {
        if (nodes.filter((node) => row.contains(node)).length >= 5) return row;
      }
    }
    return null;
  }
  function itemIn(row, node) { let item=node; while(item?.parentElement && item.parentElement!==row) item=item.parentElement; return item?.parentElement===row ? item : null; }
  function destination(current, key, value) {
    if (!key) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.searchParams.get("q"))}`;
    const url = new URL(current.href);
    for (const name of ["udm","tbm","start","ved","ei","sa","source","uds","uact"]) url.searchParams.delete(name);
    url.hash=""; url.searchParams.set(key,value); return url.href;
  }
  function remember(node,item) {
    if(!originals.has(node)) originals.set(node,{text:node.textContent,href:node.getAttribute("href"),hadHref:node.hasAttribute("href"),aria:node.getAttribute("aria-label"),hadAria:node.hasAttribute("aria-label")});
    if(!positions.has(item)) positions.set(item,{parent:item.parentElement,next:item.nextSibling});
  }
  function restore() {
    for(const node of document.querySelectorAll(".gsaio-hidden-native-tab, .gsaio-hidden-ai-mode")) node.classList.remove("gsaio-hidden-native-tab", "gsaio-hidden-ai-mode");
    for(const [node,value] of originals) if(node.isConnected){node.textContent=value.text; value.hadHref?node.setAttribute("href",value.href):node.removeAttribute("href"); value.hadAria?node.setAttribute("aria-label",value.aria):node.removeAttribute("aria-label");}
    for(const [item,value] of [...positions].reverse()) if(item.isConnected&&value.parent?.isConnected) value.parent.insertBefore(item,value.next?.parentElement===value.parent?value.next:null);
    originals.clear(); positions.clear();
  }
  function update() {
    if(!enabled) return;
    for(const node of document.querySelectorAll(controls)) node.classList.toggle("gsaio-hidden-ai-mode",isAi(node));
    if(location.pathname!=="/search") return;
    const current=new URL(location.href), row=findRow();
    if(!current.searchParams.get("q")||!row) return;
    observer.disconnect();
    try {
      const candidates=[...row.querySelectorAll(controls)].filter(isTab).filter((node,index,list)=>list.findIndex(other=>itemIn(row,other)===itemIn(row,node))===index);
      const unused=new Set(candidates);
      const selected=wanted.map(([type,label,key,value])=>{
        const node=candidates.find(item=>unused.has(item)&&kind(item)===type)||candidates.find(item=>unused.has(item)&&urlOf(item));
        if(!node)return null; unused.delete(node); const item=itemIn(row,node); if(!item)return null;
        remember(node,item); node.textContent=label; node.setAttribute("href",destination(current,key,value)); if(node.hasAttribute("aria-label"))node.setAttribute("aria-label",label); item.classList.remove("gsaio-hidden-native-tab"); return item;
      }).filter(Boolean);
      for(const node of unused)itemIn(row,node)?.classList.add("gsaio-hidden-native-tab");
      const items=candidates.map(node=>itemIn(row,node)).filter(Boolean), indexes=items.map(item=>[...row.children].indexOf(item)).filter(index=>index>=0);
      const boundary=row.children[(indexes.length?Math.max(...indexes):-1)+1]||null;
      const order=[...row.children].filter(item=>selected.includes(item));
      if(!selected.every((item,index)=>order[index]===item))for(const item of selected)row.insertBefore(item,boundary);
    } finally { observe(); }
  }
  const observer=new MutationObserver(schedule);
  const observe=()=>observer.observe(document,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["href","aria-label"]});
  function schedule(){if(!enabled||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});}
  function setEnabled(value){enabled=value;if(enabled)update();else restore();}
  observe();
  chrome.storage.local.get("state",({state})=>setEnabled(state?.enabled??true));
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.state)setEnabled(changes.state.newValue?.enabled??true);});
})();
