
(() => {
  const $ = (id) => document.getElementById(id);
  let uploadedVideoId = "";
  let activeJobId = "";
  let backendUrl = localStorage.getItem("sva_pro_backend_url") || "http://localhost:8000";
  let supabaseClient = null;

  function readSettings() {
    try {
      const state = JSON.parse(localStorage.getItem("sva_pro_all") || "{}");
      return state.settings || {};
    } catch {
      return {};
    }
  }

  function currentMatchId() {
    return $("analysisMatch")?.value || "";
  }

  function selectedFile() {
    return $("videoInput")?.files?.[0] || null;
  }

  async function initialize() {
    const settings = readSettings();
    if (settings.aiUrl) {
      backendUrl = settings.aiUrl.replace(/\/$/, "");
      localStorage.setItem("sva_pro_backend_url", backendUrl);
    }

    if (window.supabase && settings.supabaseUrl && settings.supabaseKey) {
      supabaseClient = window.supabase.createClient(settings.supabaseUrl, settings.supabaseKey);
    }

    try {
      const response = await fetch(`${backendUrl}/health`);
      if (!response.ok) throw new Error("health failed");
      const data = await response.json();
      $("proConnectionStatus").textContent = `接続済み: ${data.service}`;
    } catch {
      $("proConnectionStatus").textContent = "AIサーバー未接続";
    }

    if (supabaseClient) subscribeRealtime();
  }

  function subscribeRealtime() {
    supabaseClient
      .channel("sva-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "analysis_events" }, () => {
        $("proJobMessage").textContent = "クラウド上の解析記録が更新されました";
      })
      .subscribe();
  }

  async function uploadVideo() {
    const file = selectedFile();
    if (!file) return alert("先に動画を選択してください。");
    const form = new FormData();
    form.append("file", file);
    form.append("match_id", currentMatchId());
    $("proJobMessage").textContent = "動画をアップロード中…";
    $("proProgress").value = 10;

    const response = await fetch(`${backendUrl}/videos`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    uploadedVideoId = data.video_id;
    $("proProgress").value = 25;
    $("proJobMessage").textContent = "アップロード完了";
    $("proStartAnalysis").disabled = false;
  }

  async function startAnalysis() {
    if (!uploadedVideoId) return alert("動画をアップロードしてください。");
    const response = await fetch(`${backendUrl}/jobs/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: uploadedVideoId, match_id: currentMatchId() })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    activeJobId = data.job_id;
    $("proProgress").value = 30;
    $("proJobMessage").textContent = "AI追跡を開始しました";
    pollJob();
  }

  async function pollJob() {
    if (!activeJobId) return;
    const response = await fetch(`${backendUrl}/jobs/${activeJobId}`);
    const job = await response.json();
    $("proProgress").value = job.progress || 0;
    $("proJobMessage").textContent = job.message || job.status;
    if (job.status === "completed") {
      $("proCreateHighlights").disabled = false;
      return;
    }
    if (job.status === "failed") {
      alert(`AI処理に失敗しました: ${job.message}`);
      return;
    }
    setTimeout(pollJob, 2000);
  }

  async function createHighlights() {
    if (!uploadedVideoId) return;
    let state = {};
    try { state = JSON.parse(localStorage.getItem("sva_pro_all") || "{}"); } catch {}
    const clips = (state.highlights || [])
      .filter((h) => !currentMatchId() || h.matchId === currentMatchId())
      .map((h) => ({ start: Math.max(0, Number(h.time) - 5), end: Number(h.time) + 5, label: h.label || "" }));

    if (!clips.length) return alert("ハイライト候補を1件以上登録してください。");

    const response = await fetch(`${backendUrl}/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: uploadedVideoId, match_id: currentMatchId(), clips })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const link = $("proHighlightDownload");
    link.href = `${backendUrl}${data.download_url}`;
    link.hidden = false;
    $("proProgress").value = 100;
    $("proJobMessage").textContent = "ハイライト動画が完成しました";
  }

  $("proUploadVideo")?.addEventListener("click", () => uploadVideo().catch((e) => alert(e.message)));
  $("proStartAnalysis")?.addEventListener("click", () => startAnalysis().catch((e) => alert(e.message)));
  $("proCreateHighlights")?.addEventListener("click", () => createHighlights().catch((e) => alert(e.message)));
  window.addEventListener("load", initialize);
})();
