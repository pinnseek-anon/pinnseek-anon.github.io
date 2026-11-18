/* PINNSeek review site: equations, charts and the figure lightbox. No tracking, no storage. */
(function () {
  "use strict";

  var MACROS = {
    "\\pd": "\\frac{\\partial #1}{\\partial #2}",
    "\\pdn": "\\frac{\\partial^{#1} #2}{\\partial #3^{#1}}"
  };
  var FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var INK = "#1d1a16", INK3 = "#7b7368", GRID = "#ece5d9";
  // axis titles with an italic L (ECharts rich text)
  var L2_RICH = {rich: {i: {fontStyle: "italic", fontFamily: FONT, color: INK}}};

  function onReady(fn) {
    if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn);
  }

  function readJSON(id) {
    var el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  }

  function sup(n) {
    var map = {"-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
               "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"};
    return String(n).split("").map(function (c) { return map[c] || c; }).join("");
  }
  function logLabel(v) {
    var e = Math.round(Math.log10(v));
    if (Math.abs(Math.log10(v) - e) > 1e-6) return "";
    if (e === 0) return "1";
    if (e === 1) return "10";
    return "10" + sup(e);
  }
  function fmt(v) {
    if (v === null || v === undefined) return "";
    if (v >= 0.001 && v < 1000) return Number(v.toPrecision(3)).toString();
    var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    return m.toPrecision(3) + "×10" + sup(e);
  }

  /* ---------------------------------------------------------------- equations */
  function renderMath() {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(document.body, {
      delimiters: [
        {left: "\\[", right: "\\]", display: true},
        {left: "$", right: "$", display: false}
      ],
      macros: MACROS,
      throwOnError: false,
      ignoredClasses: ["chart", "md5"]
    });
  }

  /* ---------------------------------------------------------------- lightbox */
  function lightbox() {
    var box = document.getElementById("lightbox");
    if (!box) return;
    var img = box.querySelector("img");
    document.querySelectorAll("img.zoom").forEach(function (el) {
      var link = el.closest("a");
      (link || el).addEventListener("click", function (ev) {
        ev.preventDefault();
        img.src = link ? link.getAttribute("href") : el.src;
        img.alt = el.alt;
        box.classList.add("open");
      });
    });
    box.addEventListener("click", function () { box.classList.remove("open"); img.src = ""; });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") box.click(); });
  }

  /* ---------------------------------------------------------------- overview chart (home) */
  function overviewChart() {
    var el = document.getElementById("overview-chart");
    var data = readJSON("overview-data");
    if (!el || !data || !window.echarts) return;
    var probs = data.problems.slice().reverse();          // first problem on top
    var methods = Object.keys(data.colors);
    var chart = echarts.init(el, null, {renderer: "svg"});
    var series = methods.map(function (m, k) {
      var disc = k === 0;
      return {
        name: m, type: "scatter", symbol: disc ? "diamond" : "circle", symbolSize: disc ? 15 : 10,
        z: disc ? 5 : 3,
        itemStyle: {color: data.colors[m], borderColor: disc ? "#7a3a18" : "#8c8378", borderWidth: disc ? 1 : 0.6, opacity: 1},
        emphasis: {scale: 1.4},
        data: probs.map(function (p, i) {
          var c = p.methods[m];
          return c.status === "ok" ? {value: [c.mean, i], std: c.std, problem: p.name, id: p.id, time: p.time} : null;
        }).filter(Boolean)
      };
    });
    chart.setOption({
      textStyle: {fontFamily: FONT, color: INK},
      animation: false,
      legend: {top: 0, left: "center", itemWidth: 12, itemHeight: 12, textStyle: {fontSize: 12}},
      grid: {left: 8, right: 24, top: 40, bottom: 44, containLabel: true},
      tooltip: {
        trigger: "item",
        formatter: function (p) {
          return "<b>" + p.data.problem + "</b> · training time " + p.data.time + " s<br>" +
                 p.marker + p.seriesName + ": " + fmt(p.data.value[0]) +
                 " ± " + fmt(p.data.std) + "<br><span style='color:#7b7368'>" +
                 (p.seriesName === "Discovered PINN solver" ? "Click to open the problem" : "Click to read the code") + "</span>";
        }
      },
      xAxis: {
        type: "log", logBase: 10, min: 1e-7, max: 10, name: "Mean relative {i|L}² error", nameTextStyle: L2_RICH, nameLocation: "middle",
        nameGap: 28, axisLabel: {formatter: logLabel, color: INK}, splitLine: {lineStyle: {color: GRID, type: "dashed"}},
        axisLine: {lineStyle: {color: INK}}, axisTick: {lineStyle: {color: INK}}
      },
      yAxis: {
        type: "category", data: probs.map(function (p) { return p.name + "  " + p.time + " s"; }),
        axisLabel: {color: INK, fontSize: 12}, axisTick: {show: false}, triggerEvent: true,
        splitLine: {show: true, lineStyle: {color: "#f3ece2"}}, axisLine: {lineStyle: {color: INK}}
      },
      series: series
    });
    // hovering a problem name shows its training time, as the points do
    var tip = document.createElement("div");
    tip.className = "axis-tip";
    el.appendChild(tip);
    chart.on("mouseover", function (p) {
      if (p.componentType !== "yAxis") return;
      var row = probs[p.dataIndex !== undefined ? p.dataIndex : probs.map(function (q) { return q.name + "  " + q.time + " s"; }).indexOf(p.value)];
      if (!row) return;
      tip.innerHTML = "<b>" + esc(row.name) + "</b> · training time " + row.time + " s";
      var ev = p.event && p.event.event;
      var r = el.getBoundingClientRect();
      tip.style.left = ((ev ? ev.clientX - r.left : 0) + 14) + "px";
      tip.style.top = ((ev ? ev.clientY - r.top : 0) - 10) + "px";
      tip.style.display = "block";
    });
    chart.on("mouseout", function (p) { if (p.componentType === "yAxis") tip.style.display = "none"; });
    // the discovered solver opens its problem page; the four methods open their driver in the code viewer
    chart.on("click", function (p) {
      if (!p.data || !p.data.id) return;
      if (p.seriesName === "Discovered PINN solver") { window.location.href = "problems/" + p.data.id + ".html"; return; }
      showDriver("", p.seriesName, p.data.id, p.data.problem, data.dirs[p.seriesName],
                 (data.files[p.data.id] || {})[p.seriesName] || [], "run.py");
    });
    chart.getZr().on("mousemove", function (e) { chart.getZr().setCursorStyle(e.target ? "pointer" : "default"); });
    window.addEventListener("resize", function () { chart.resize(); });
  }

  /* ---------------------------------------------------------------- per-problem chart (Extended Data Fig. 1 panel) */
  function problemChart() {
    var el = document.getElementById("problem-chart");
    var data = readJSON("problem-data");
    if (!el || !data || !window.echarts) return;
    var chart = echarts.init(el, null, {renderer: "svg"});
    var bars = data.bars;
    var LABEL = {"Discovery run": "Discovery\nrun", "Discovered solver, five seeds": "Discovered\nfive seeds"};
    var cats = bars.map(function (b) {
      if (LABEL[b.slot]) return LABEL[b.slot];
      var m = b.slot.split(" ");
      return m[0] + "\n" + (m[1] === "1x" ? data.time : 2 * data.time) + " s";
    });
    function color(b) {
      var m = b.slot.replace(/ [12]x$/, "");
      return data.colors[b.slot] || data.colors[m];
    }
    var ok = bars.filter(function (b) { return b.mean != null; });
    var lo = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, ok.map(function (b) { return b.min; })))));
    var hi = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, ok.map(function (b) { return b.max; })) * 1.05)));
    chart.setOption({
      textStyle: {fontFamily: FONT, color: INK},
      animation: false,
      grid: {left: 8, right: 12, top: 16, bottom: 8, containLabel: true},
      tooltip: {
        trigger: "item",
        formatter: function (p) {
          var b = bars[p.dataIndex];
          var name = cats[p.dataIndex].replace("\n", LABEL[b.slot] ? " " : ", ");
          if (b.mean == null) return name + ": " + (b.not_run === "OOM" ? "out of GPU memory" : "setup exceeds the training time");
          var hint = "<br><span style='color:#7b7368'>Click to read the code</span>";
          if (b.seeds.length === 1) return "<b>" + name + "</b><br>" + fmt(b.mean) + " (single training)" + hint;
          return "<b>" + name + "</b><br>mean " + fmt(b.mean) + "<br>range " + fmt(b.min) + " to " + fmt(b.max) +
                 "<br>seeds: " + b.seeds.map(fmt).join(", ") + hint;
        }
      },
      xAxis: {type: "category", data: cats, axisLabel: {color: INK, interval: 0, fontSize: 11, lineHeight: 14},
              axisTick: {show: false}, axisLine: {lineStyle: {color: INK}}},
      yAxis: {type: "log", logBase: 10, min: lo, max: hi, axisLabel: {formatter: logLabel, color: INK},
              name: "Relative {i|L}² error", nameTextStyle: L2_RICH, nameLocation: "middle", nameGap: 40,
              splitLine: {lineStyle: {color: GRID, type: "dashed"}}, axisLine: {show: true, lineStyle: {color: INK}},
              axisTick: {show: true, lineStyle: {color: INK}}},
      series: [{
        /* bars drawn by hand: ECharts roots log-axis bars at 1, not at the axis minimum */
        type: "custom", z: 10,
        renderItem: function (params, api) {
          var b = bars[params.dataIndex];
          var p0 = api.coord([params.dataIndex, lo]);
          if (b.mean == null) {
            return {type: "text", rotation: Math.PI / 2, x: p0[0], y: p0[1] - 6,
                    style: {text: b.not_run === "OOM" ? "OOM" : "Setup", textAlign: "left", textVerticalAlign: "middle",
                            fill: INK3, fontSize: 11}};
          }
          var x = p0[0], yBase = p0[1];
          var yBar = api.coord([params.dataIndex, b.mean])[1];
          var bw = api.size([1, 0])[0] * 0.66;
          var yLo = api.coord([params.dataIndex, b.min])[1];
          var yHi = api.coord([params.dataIndex, b.max])[1];
          var s = {stroke: INK, lineWidth: 1};
          var two = / 2x$/.test(b.slot);
          var kids = [{type: "rect", shape: {x: x - bw / 2, y: yBar, width: bw, height: yBase - yBar},
                       style: {fill: color(b), stroke: b.slot.indexOf("Discovered") === 0 ? "#7a3a18" : "rgba(0,0,0,0.2)", lineWidth: 0.6}}];
          if (two) {   // hatching as in the paper: white diagonal lines over the bar
            var n = Math.ceil((yBase - yBar + bw) / 7);
            for (var k = -Math.ceil(bw / 7); k < n; k++) {
              var y0 = yBase - k * 7;
              kids.push({type: "line", silent: true,
                         shape: {x1: x - bw / 2, y1: y0, x2: x + bw / 2, y2: y0 - bw},
                         style: {stroke: "rgba(255,255,255,0.9)", lineWidth: 1.2}, clipPath: {type: "rect",
                         shape: {x: x - bw / 2, y: yBar, width: bw, height: yBase - yBar}}});
            }
          }
          if (b.seeds.length > 1) {
            var w = 5;
            kids.push({type: "line", shape: {x1: x, y1: yLo, x2: x, y2: yHi}, style: s},
                      {type: "line", shape: {x1: x - w, y1: yLo, x2: x + w, y2: yLo}, style: s},
                      {type: "line", shape: {x1: x - w, y1: yHi, x2: x + w, y2: yHi}, style: s});
          }
          return {type: "group", children: kids};
        },
        encode: {x: 0, y: 1},
        data: bars.map(function (b, i) { return [i, b.mean != null ? b.mean : lo]; })
      }]
    });
    // every bar opens its code: the discovered solver, or the driver of the method
    chart.on("click", function (p) {
      var b = bars[p.dataIndex];
      if (!b) return;
      if (LABEL[b.slot]) {
        openFile("../files/solvers/" + data.case + ".py", "Discovered PINN solver for " + data.name + " / " + data.case + ".py",
                 "The solver PINNSeek discovered, as trained for " + data.time + " s per seed.", true);
        return;
      }
      var m = b.slot.replace(/ [12]x$/, "");
      if (!data.dirs[m] || !(data.files[m] || []).length) return;
      showDriver("../", m, data.case, data.name, data.dirs[m], data.files[m], "run.py");
    });
    chart.getZr().on("mousemove", function (e) { chart.getZr().setCursorStyle(e.target ? "pointer" : "default"); });
    window.addEventListener("resize", function () { chart.resize(); });
  }

  /* driver of a comparison method, with links to the other files of its folder */
  function showDriver(root, method, id, problem, dir, names, file) {
    var base = root + "files/sota/" + id + "/" + dir + "/";
    var links = names.map(function (n) {
      return n === file ? "<b>" + esc(n) + "</b>" : "<a href='#' data-f='" + esc(n) + "'>" + esc(n) + "</a>";
    }).join(" · ");
    openFile(base + file, method + " on " + problem + " / " + file,
             "Driver of " + method + " for Table 1. Files: " + links, true);
    document.querySelectorAll("#viewer .viewer-meta [data-f]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        showDriver(root, method, id, problem, dir, names, a.getAttribute("data-f"));
      });
    });
  }

  /* ---------------------------------------------------------------- file viewer */
  var viewer = null;
  function openFile(url, title, meta, isCode) {
    var dlg = document.getElementById("viewer");
    if (!dlg) return;
    var body = dlg.querySelector(".viewer-body"), code = body.querySelector("code");
    dlg.querySelector(".viewer-title").textContent = title;
    dlg.querySelector(".viewer-meta").innerHTML = meta || "";
    body.classList.toggle("prose", !isCode);
    code.className = "";
    code.textContent = "Loading…";
    if (!viewer) {
      viewer = dlg;
      dlg.querySelector(".viewer-close").addEventListener("click", function () { dlg.close(); });
      var copy = dlg.querySelector(".viewer-copy");
      if (copy) copy.addEventListener("click", function () {
        var text = dlg.querySelector(".viewer-body code").textContent;
        var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1500); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done);
        else {
          var ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          dlg.appendChild(ta); ta.select(); document.execCommand("copy"); dlg.removeChild(ta); done();
        }
      });
      dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });
    }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    body.scrollTop = 0;
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? "This file is not in the run archive." : "HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      if (isCode && window.hljs) {
        code.innerHTML = window.hljs.highlight(text, {language: "python", ignoreIllegals: true}).value;
        code.className = "hljs language-python";
      } else {
        code.textContent = text;
      }
      body.scrollTop = 0;   // every file opens at its first line
    }).catch(function (err) { code.textContent = String(err.message || err); });
  }

  /* ---------------------------------------------------------------- discovery process */
  var CAT_COLOR = {as_in_note: "#F3C49C", adapted: "#E8743B", no_note: "#4A443C"};
  var CAT_TEXT = {as_in_note: "as in a note of the literature base", adapted: "adapted from the literature base",
                  no_note: "not from the literature base"};
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }

  function discovery() {
    var el = document.getElementById("discovery-chart");
    var data = readJSON("discovery-data");
    if (!el || !data || !window.echarts) return;
    var chart = echarts.init(el, null, {renderer: "svg"});
    var current = null;

    function base(run) { return "../files/runs/" + data.case + "/" + run.run + "/"; }
    function meta(p) {
      return "Round " + p.r + " · seed " + p.s + " · relative <i>L</i>² error <b>" + fmt(p.e) + "</b>" +
             (p.n != null ? " · " + p.n.toLocaleString("en") + " steps" : "") +
             (p.t != null ? " · " + p.t + " s of training" : "");
    }
    function showCode(run, p) { openFile(base(run) + p.c, run.run + " / " + p.c, meta(p), true); }

    function draw(k) {
      var run = data.runs[k];
      current = run;
      var pts = run.points;
      var es = pts.map(function (p) { return p.e; });
      // error axis of the paper's figures; evaluations above its top (diverged solvers) are not drawn
      var lo = run.ylim ? run.ylim[0] : Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, es))));
      var hi = run.ylim ? run.ylim[1] : Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, es) * 1.01)));
      var shown = pts.filter(function (p) { return p.e <= hi; });
      var R = run.rounds;
      // running best along the round axis
      var sorted = pts.slice().sort(function (a, b) { return a.x - b.x; });
      var best = Infinity, line = [];
      sorted.forEach(function (p) { if (p.e < best) { if (line.length) line.push([p.x, best]); best = p.e; line.push([p.x, best]); } });
      line.push([R, best]);
      // odd rounds shaded pink, even rounds left white
      var bands = [];
      for (var r = 1; r <= R; r += 2) bands.push([{xAxis: r - 1, itemStyle: {color: "rgba(205,176,138,0.35)"}}, {xAxis: r}]);
      var nodeData = run.nodes.map(function (n) {
        var p = pts.filter(function (q) { return q.c === n.c && q.e === n.e; })[0] || {c: n.c, e: n.e, x: n.x};
        return {value: [n.x, n.e], node: n, p: p,
                itemStyle: {color: CAT_COLOR[n.categories[0]] || "#E8743B"}};
      });
      chart.setOption({
        textStyle: {fontFamily: FONT, color: INK},
        animation: false,
        grid: {left: 8, right: 16, top: 24, bottom: 40, containLabel: true},
        tooltip: {
          trigger: "item", confine: true,
          formatter: function (q) {
            var p = q.data && q.data.p;
            if (!p) return "";
            var n = q.data.node;
            return (n ? "<b>" + esc(n.label.replace(/\$/g, "")) + "</b><br>" + n.categories.map(function (c) { return CAT_TEXT[c]; }).join("; ") + "<br>" : "") +
                   esc(p.c) + "<br>" + meta(p) + "<br><span style='color:#7b7368'>Click to read the code</span>";
          }
        },
        // ticks and grid lines at the round boundaries; each round's number sits in the middle of its span
        xAxis: [{type: "value", min: 0, max: R, interval: 1, name: "Round", nameLocation: "middle", nameGap: 26,
                 axisLabel: {show: false}, axisLine: {lineStyle: {color: INK}}, axisTick: {lineStyle: {color: INK}},
                 splitLine: {show: false}},
                {type: "value", min: 0, max: R, interval: 0.5, position: "bottom", silent: true,
                 axisLine: {show: false}, axisTick: {show: false}, splitLine: {show: false},
                 axisLabel: {color: INK, showMinLabel: false, showMaxLabel: false,
                             formatter: function (v) { return Math.abs(v % 1 - 0.5) < 1e-9 ? String(v + 0.5) : ""; }}}],
        yAxis: {type: "log", logBase: 10, min: lo, max: hi, name: "Relative {i|L}² error", nameTextStyle: L2_RICH, nameLocation: "middle", nameGap: 44,
                axisLabel: {formatter: logLabel, color: INK}, axisLine: {show: true, lineStyle: {color: INK}},
                axisTick: {show: true, lineStyle: {color: INK}}, splitLine: {lineStyle: {color: GRID, type: "dashed"}}},
        series: [
          {type: "scatter", name: "evaluated", symbolSize: 6, z: 2, cursor: "pointer",
           itemStyle: {color: "#cdc4b7", opacity: 0.85, borderColor: "#b5ab9d", borderWidth: 0.4},
           emphasis: {scale: 1.8, itemStyle: {color: "#E8743B"}},
           data: shown.map(function (p) { return {value: [p.x, p.e], p: p}; }),
           markArea: {silent: true, data: bands, label: {show: false}}},
          {type: "line", name: "best", data: line, step: "end", symbol: "none", silent: true, z: 3,
           lineStyle: {color: "#E8743B", width: 1.6}},
          {type: "scatter", name: "nodes", symbol: "diamond", symbolSize: 14, z: 5, cursor: "pointer",
           itemStyle: {borderColor: "#7a3a18", borderWidth: 1},
           label: {show: false},
           data: nodeData}
        ]
      }, true);
      document.getElementById("run-stats").textContent = pts.length + " evaluations in " + R + " rounds · best " + fmt(Math.min.apply(null, es)) +
        (pts.length > shown.length ? " · " + (pts.length - shown.length) + " diverged solver" + (pts.length - shown.length > 1 ? "s" : "") +
         " with errors above " + fmt(hi) + " not drawn (listed in the table)" : "") +
        (run.failed ? " · " + run.failed + (run.failed > 1 ? " runs" : " run") + " that crashed or returned no score " +
         (run.failed > 1 ? "are" : "is") + " not drawn" : "");
      var rn = document.getElementById("round-nodes");
      function cats(n) { return " <span class='muted'>(" + n.categories.map(function (c) { return CAT_TEXT[c]; }).join("; ") + ")</span>"; }
      if (nodeData.length) {
        rn.innerHTML = "<span class='muted'>Main techniques of the discovered solver:</span><ol>" +
          nodeData.map(function (d, i) { var n = d.node;
            return "<li>Round " + d.p.r + ": " + esc(n.label) + cats(n) + " <button type='button' class='linklike' data-node='" + i + "'>" +
                   esc(n.c.split("/").pop()) + "</button></li>"; }).join("") + "</ol>";
        rn.querySelectorAll("[data-node]").forEach(function (b) {
          b.addEventListener("click", function () { showCode(run, nodeData[+b.getAttribute("data-node")].p); });
        });
      } else if (run.round_nodes && run.round_nodes.length) {
        rn.innerHTML = "<span class='muted'>Main techniques of the discovered solver:</span><ol>" +
          run.round_nodes.map(function (n) { return "<li>Round " + n.round + ": " + esc(n.label) + cats(n) + "</li>"; }).join("") + "</ol>";
      } else {
        rn.innerHTML = "";
      }
      if (window.renderMathInElement) {
        window.renderMathInElement(rn, {delimiters: [{left: "$", right: "$", display: false}], throwOnError: false});
      }
      var rows = pts.slice().sort(function (a, b) { return a.x - b.x; });
      var tb = document.getElementById("eval-rows");
      tb.innerHTML = rows.map(function (p, i) {
        return "<tr" + (p.b ? " class='best'" : "") + "><td>" + p.r + "</td><td><button type='button' data-i='" + pts.indexOf(p) + "'>" + esc(p.c) +
               "</button></td><td>" + (p.s == null ? "" : p.s) + "</td><td>" + fmt(p.e) + (p.e > hi ? " <span class='muted'>(not drawn)</span>" : "") +
               "</td><td>" + (p.n == null ? "" : p.n) +
               "</td><td>" + (p.t == null ? "" : p.t) + "</td></tr>";
      }).join("");
      tb.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { showCode(run, pts[+b.getAttribute("data-i")]); });
      });
    }
    chart.on("click", function (q) { if (q.data && q.data.p) showCode(current, q.data.p); });
    document.querySelectorAll("[data-run]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("[data-run]").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        draw(+b.getAttribute("data-run"));
      });
    });
    var m = /run=(\d)/.exec(location.hash);
    var k0 = m && data.runs[+m[1]] ? +m[1] : (data.initial || 0);
    document.querySelectorAll("[data-run]").forEach(function (o) { o.setAttribute("aria-pressed", +o.getAttribute("data-run") === k0 ? "true" : "false"); });
    draw(k0);
    window.addEventListener("resize", function () { chart.resize(); });
  }

  onReady(function () {
    lightbox();
    renderMath();
    overviewChart();
    problemChart();
    discovery();
  });
})();
