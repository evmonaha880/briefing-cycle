/* Search the record — keyless, client-side search over record.json.
   No API key, no backend, no external deps. Every result links to the
   source line it came from. Fail-safe: if anything errors, the static
   link table below stays as the fallback (this box just hides itself). */
(function () {
  "use strict";
  var mount = document.getElementById("record-query");
  if (!mount) return;

  // ---- styles (inherit the site palette via CSS vars) ----
  var css = document.createElement("style");
  css.textContent = [
    "#record-query .rq-box{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px}",
    "#record-query input{flex:1;min-width:220px;font:inherit;font-size:16px;padding:10px 12px;",
      "border:1px solid var(--ink,#222);border-radius:4px;background:var(--card,#fff);color:var(--ink,#111)}",
    "#record-query .rq-hint{font-size:13px;color:var(--muted,#6b6b6b);margin:0 0 8px}",
    "#record-query .rq-sugg{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 4px}",
    "#record-query .rq-sugg button{font:inherit;font-size:12px;cursor:pointer;padding:4px 10px;border-radius:999px;",
      "border:1px solid var(--ink,#999);background:transparent;color:var(--ink,#333)}",
    "#record-query .rq-sugg button:hover{border-color:var(--accent,#333);color:var(--accent,#111)}",
    "#record-query .rq-results{margin:12px 0 0;padding:0;list-style:none}",
    "#record-query .rq-results li{padding:11px 0;border-bottom:1px solid var(--rule,#e2e2dc)}",
    "#record-query .rq-results a{font-weight:600;text-decoration:none;color:var(--ink,#111)}",
    "#record-query .rq-results a:hover{color:var(--accent,#333)}",
    "#record-query .rq-phase{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#888)}",
    "#record-query .rq-snip{font-size:14px;line-height:1.45;color:var(--ink,#333);margin:3px 0 0}",
    "#record-query mark{background:var(--accent,#ffe08a);color:inherit;padding:0 1px}",
    "#record-query .rq-none{font-size:14px;color:var(--muted,#888);padding:10px 0}"
  ].join("");
  document.head.appendChild(css);

  var entries = [];
  var SUGG = [
    "What did the customer leave with?",
    "How was discovery verified?",
    "the commitments",
    "measurement instrumented at intake",
    "what a live cycle has this sample can't"
  ];

  function esc(s){return s.replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}

  function score(entry, terms){
    var hay = (entry.heading + " " + entry.text).toLowerCase();
    var s = 0;
    for (var i=0;i<terms.length;i++){
      var t = terms[i]; if(!t) continue;
      if (entry.heading.toLowerCase().indexOf(t) !== -1) s += 3;
      var idx = 0, n = 0;
      while ((idx = hay.indexOf(t, idx)) !== -1){ n++; idx += t.length; if(n>6)break; }
      s += n;
    }
    return s;
  }

  function snippet(text, terms){
    var lo = text.toLowerCase(), at = -1;
    for (var i=0;i<terms.length;i++){ var p = lo.indexOf(terms[i]); if(p!==-1 && (at===-1||p<at)) at = p; }
    var start = at > 90 ? at - 80 : 0;
    var frag = text.slice(start, start + 240);
    if (start > 0) frag = "…" + frag;
    if (start + 240 < text.length) frag = frag + "…";
    frag = esc(frag);
    // highlight terms
    terms.forEach(function(t){
      if(!t) return;
      frag = frag.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")","ig"), "<mark>$1</mark>");
    });
    return frag;
  }

  function search(q){
    var results = document.getElementById("rq-results");
    var terms = q.toLowerCase().split(/\s+/).filter(function(t){return t.length>2;});
    if (!terms.length){ results.innerHTML = ""; return; }
    var scored = entries.map(function(e){return {e:e, s:score(e, terms)};})
                        .filter(function(x){return x.s>0;})
                        .sort(function(a,b){return b.s-a.s;})
                        .slice(0,6);
    if (!scored.length){ results.innerHTML = "<li class='rq-none'>Nothing in the record matches that. Try the browse list below.</li>"; return; }
    results.innerHTML = scored.map(function(x){
      var e = x.e, href = e.page + (e.anchor ? "#"+e.anchor : "");
      return "<li><span class='rq-phase'>"+esc(e.phase)+"</span><br>"+
             "<a href='"+href+"'>"+esc(e.heading)+" →</a>"+
             "<p class='rq-snip'>"+snippet(e.text, terms)+"</p></li>";
    }).join("");
  }

  function build(){
    mount.innerHTML =
      "<p class='rq-hint'>Search the record; results show the matching line and link to its section.</p>"+
      "<div class='rq-box'><input id='rq-input' type='search' autocomplete='off' "+
        "placeholder='e.g. how was discovery verified?' aria-label='Search the record'></div>"+
      "<div class='rq-sugg' id='rq-sugg'></div>"+
      "<ul class='rq-results' id='rq-results'></ul>";
    var input = document.getElementById("rq-input");
    input.addEventListener("input", function(){ search(input.value); });
    var sugg = document.getElementById("rq-sugg");
    SUGG.forEach(function(q){
      var b = document.createElement("button");
      b.type = "button"; b.textContent = q;
      b.addEventListener("click", function(){ input.value = q; search(q); input.focus(); });
      sugg.appendChild(b);
    });
  }

  fetch("record.json").then(function(r){ return r.json(); }).then(function(data){
    entries = (data && data.entries) || [];
    if (!entries.length) return;         // fail-safe: leave the fallback list
    build();
  }).catch(function(){ /* silent — static link table remains the fallback */ });
})();
