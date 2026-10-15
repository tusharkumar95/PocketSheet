(() => {
  const KEY = "jarvis-app-handoff-v1";
  const params = new URLSearchParams(location.search);
  if (params.get("from") !== "jarvis") return;

  let payload = null;
  try { payload = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (!payload || payload.target !== "pocketsheet") return;
  const age = Date.now() - new Date(payload.created || 0).getTime();
  if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) return;

  const app = document.querySelector(".app");
  const topbar = document.querySelector(".topbar");
  if (!app || !topbar) return;

  const prompt = String(payload.prompt || "").trim();
  const answer = String(payload.answer || "").trim();

  const banner = document.createElement("section");
  banner.className = "jarvis-handoff";
  banner.innerHTML = `
    <div class="jarvis-handoff-head"><div><small>FROM JARVIS</small><strong>Continue your spreadsheet work</strong></div><button type="button" data-dismiss aria-label="Dismiss">×</button></div>
    <p class="jarvis-handoff-prompt"></p>
    <details><summary>Show Jarvis answer</summary><div class="jarvis-handoff-answer"></div></details>
    <div class="jarvis-handoff-actions"><button type="button" data-copy>Copy answer</button><button type="button" data-editor>Put answer in selected cell</button></div>
    <span class="jarvis-handoff-status">Tap a cell first if you want to place the answer into the sheet.</span>`;
  banner.querySelector(".jarvis-handoff-prompt").textContent = prompt || "Jarvis sent spreadsheet context.";
  banner.querySelector(".jarvis-handoff-answer").textContent = answer || "No answer text was carried over.";
  topbar.insertAdjacentElement("afterend", banner);

  function setStatus(text) {
    const node = banner.querySelector(".jarvis-handoff-status");
    if (node) node.textContent = text;
  }

  banner.querySelector("[data-dismiss]")?.addEventListener("click", () => {
    banner.remove();
    try { localStorage.removeItem(KEY); } catch {}
    const url = new URL(location.href);
    url.searchParams.delete("from");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  });

  banner.querySelector("[data-copy]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(answer || prompt);
      setStatus("Copied. Paste it wherever you need it.");
    } catch {
      setStatus("Copy was blocked by the browser. Open the answer above and copy it manually.");
    }
  });

  banner.querySelector("[data-editor]")?.addEventListener("click", () => {
    if (typeof selectedRef === "undefined" || !selectedRef) {
      setStatus("Select a cell in the sheet, then tap this button again.");
      return;
    }
    if (typeof openEditor !== "function" || typeof cellInput === "undefined") {
      setStatus("The cell editor is not ready yet.");
      return;
    }
    openEditor(selectedRef);
    cellInput.value = (answer || prompt).slice(0, 4000);
    setStatus(`Loaded into ${selectedRef}. Review it, then tap Save if you want to keep it.`);
  });

  const style = document.createElement("style");
  style.textContent = `
    .jarvis-handoff{margin:10px 12px 4px;padding:13px 14px;border:1px solid rgba(40,44,50,.09);border-radius:18px;background:rgba(255,255,255,.9);box-shadow:0 7px 22px rgba(20,25,30,.06)}.jarvis-handoff-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.jarvis-handoff-head>div{display:grid;gap:2px}.jarvis-handoff-head small{font-size:10px;font-weight:900;letter-spacing:.11em;opacity:.48}.jarvis-handoff-head strong{font-size:14px}.jarvis-handoff-head>button{border:0;background:transparent;font-size:22px;line-height:1;color:inherit}.jarvis-handoff-prompt{margin:9px 0 7px;font-size:13px;line-height:1.4}.jarvis-handoff details{font-size:12px}.jarvis-handoff details summary{cursor:pointer;opacity:.65}.jarvis-handoff-answer{margin-top:7px;padding:9px;border-radius:12px;background:rgba(40,44,50,.045);white-space:pre-wrap;max-height:180px;overflow:auto;line-height:1.42}.jarvis-handoff-actions{display:flex;gap:8px;margin-top:10px}.jarvis-handoff-actions button{border:0;border-radius:11px;background:rgba(40,44,50,.075);padding:9px 10px;font:inherit;font-size:12px;font-weight:750;color:inherit}.jarvis-handoff-status{display:block;margin-top:8px;font-size:11px;opacity:.58}@media(max-width:520px){.jarvis-handoff-actions{display:grid;grid-template-columns:1fr 1fr}.jarvis-handoff-actions button{min-height:40px}}
  `;
  document.head.appendChild(style);
})();
