/* POPS Assess video link. Peer-to-peer WebRTC; Supabase is used only to pass the connection messages.
   Nothing is recorded or stored. (c) Positive Outcomes Psychology Services Ltd. */
(function (root) {
  "use strict";
  var DEFAULT_ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  function $el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "style") e.style.cssText = attrs[k]; else if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.append(c); });
    return e;
  }
  var CSS = ".pv-box{position:fixed;z-index:9999;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0f2b46;color:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);padding:8px;max-width:calc(100vw - 16px)}" +
    ".pv-box video{display:block;width:100%;background:#000;border-radius:10px;object-fit:cover}" +
    ".pv-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.pv-row button{font:inherit;font-size:.85rem;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;background:#e7eef6;color:#0f2b46;min-height:36px}" +
    ".pv-row button.pv-go{background:#2a9d8f;color:#fff;font-weight:700}.pv-row button.pv-end{background:#c0392b;color:#fff}.pv-msg{font-size:.82rem;margin:4px 2px;min-height:1.1em}" +
    "@media print{.pv-box{display:none!important}}";
  function addCss() { if (document.getElementById("pv-css")) return; var s = document.createElement("style"); s.id = "pv-css"; s.textContent = CSS; document.head.appendChild(s); }

  function Link(opts) {
    // opts: role, call(msg|null, after) -> Promise<{ended, rows:[{id,msg}]}>, iceServers, onStatus(text), onRemote(stream|null), onLocal(stream|null), onEnded()
    var role = opts.role, call = opts.call, after = 0, pc = null, local = null, timer = null, active = false, queue = [], haveRemote = false, fast = false, stopped = false;
    function status(t) { if (opts.onStatus) opts.onStatus(t); }
    async function send(msg) { try { var r = await call(msg, after); handle(r); } catch (e) { /* retry on next poll */ } }
    function handle(r) {
      if (!r) return;
      if (r.ended) { stopped = true; teardown(true); if (opts.onEnded) opts.onEnded(); return; }
      (r.rows || []).forEach(function (row) { after = Math.max(after, row.id); try { onMsg(row.msg); } catch (e) { } });
    }
    async function poll() {
      if (stopped) return;
      try { var r = await call(null, after); handle(r); } catch (e) { }
      if (!stopped) timer = setTimeout(poll, fast ? 600 : 2000);
    }
    function ice() { return (opts.iceServers && opts.iceServers.length) ? opts.iceServers : DEFAULT_ICE; }
    function makePC() {
      closePC();
      pc = new RTCPeerConnection({ iceServers: ice() }); haveRemote = false; queue = [];
      pc.onicecandidate = function (e) { if (e.candidate) send({ t: "ice", c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
      pc.ontrack = function (e) { if (opts.onRemote) opts.onRemote(e.streams[0]); };
      pc.onconnectionstatechange = function () {
        var s = pc && pc.connectionState;
        if (s === "connected") status(role === "assessor" ? "Connected" : "Connected");
        else if (s === "failed") status("The video could not connect on this network. The assessment can carry on without video.");
        else if (s === "disconnected") status("Video interrupted, trying to reconnect…");
      };
      if (local) local.getTracks().forEach(function (t) { pc.addTrack(t, local); });
      return pc;
    }
    function closePC() { if (pc) { try { pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null; pc.close(); } catch (e) { } pc = null; } }
    async function addIce(c) { if (!pc) return; if (!haveRemote) { queue.push(c); return; } try { await pc.addIceCandidate(c); } catch (e) { } }
    async function flushIce() { haveRemote = true; var q = queue; queue = []; for (var i = 0; i < q.length; i++) { try { await pc.addIceCandidate(q[i]); } catch (e) { } } }
    async function onMsg(m) {
      if (!m || !m.t) return;
      if (m.t === "bye") { teardown(false); status(role === "assessor" ? "The child ended the video." : "The assessor ended the video."); return; }
      if (role === "assessor") {
        if (m.t === "decline") { teardown(false); status("The child chose not to use video."); }
        else if (m.t === "ready" && active) {
          status("Connecting…"); makePC();
          var off = await pc.createOffer(); await pc.setLocalDescription(off); await send({ t: "offer", sdp: pc.localDescription.sdp });
        } else if (m.t === "answer" && pc) { await pc.setRemoteDescription({ type: "answer", sdp: m.sdp }); await flushIce(); }
        else if (m.t === "ice") await addIce(m.c);
      } else {
        if (m.t === "invite") { if (opts.onInvite) opts.onInvite(); }
        else if (m.t === "offer" && active && local) {
          status("Connecting…"); makePC();
          await pc.setRemoteDescription({ type: "offer", sdp: m.sdp }); await flushIce();
          var ans = await pc.createAnswer(); await pc.setLocalDescription(ans); await send({ t: "answer", sdp: pc.localDescription.sdp });
        } else if (m.t === "ice") await addIce(m.c);
      }
    }
    async function getMedia() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser cannot use the camera here. Use Safari or Chrome over a secure (https) link.");
      try { return await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) {
        try { var a = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); status("Camera not available, using sound only."); return a; }
        catch (e2) { throw new Error("The camera and microphone were blocked. Allow them in the browser, then try again."); }
      }
    }
    function teardown(silent) {
      active = false; fast = false; closePC();
      if (local) { local.getTracks().forEach(function (t) { t.stop(); }); local = null; }
      if (opts.onRemote) opts.onRemote(null); if (opts.onLocal) opts.onLocal(null);
      if (opts.onState) opts.onState(false);
      if (silent) status("");
    }
    return {
      begin: function () { stopped = false; clearTimeout(timer); timer = setTimeout(poll, 50); },
      // assessor
      startInvite: async function () {
        local = await getMedia(); if (opts.onLocal) opts.onLocal(local); active = true; fast = true;
        if (opts.onState) opts.onState(true);
        status("Waiting for the child to allow video…");
        await send({ t: "start" }); await send({ t: "invite" });
      },
      // child
      accept: async function () {
        local = await getMedia(); if (opts.onLocal) opts.onLocal(local); active = true; fast = true;
        if (opts.onState) opts.onState(true);
        status("Connecting…"); await send({ t: "ready" });
      },
      decline: async function () { await send({ t: "decline" }); },
      end: async function () { await send({ t: "bye" }); teardown(false); status("Video ended."); },
      setMic: function (on) { if (local) local.getAudioTracks().forEach(function (t) { t.enabled = on; }); },
      setCam: function (on) { if (local) local.getVideoTracks().forEach(function (t) { t.enabled = on; }); },
      destroy: function () { stopped = true; clearTimeout(timer); teardown(true); }
    };
  }

  var cur = null;
  function destroyCur() { if (cur) { try { cur.link.destroy(); } catch (e) { } try { cur.box.remove(); if (cur.ask) cur.ask.remove(); } catch (e) { } cur = null; } }

  function mountAssessor(opts) { // opts: call, iceServers
    destroyCur(); addCss();
    var rv = $el("video", { playsinline: "", autoplay: "", style: "height:180px;width:100%" });
    var lv = $el("video", { playsinline: "", autoplay: "", muted: "", style: "position:absolute;right:6px;bottom:6px;width:70px;height:52px;border:2px solid #fff;border-radius:8px" });
    lv.muted = true;
    var msg = $el("div", { class: "pv-msg", role: "status", "aria-live": "polite" });
    var bGo = $el("button", { class: "pv-go", type: "button", text: "Start video" });
    var bMic = $el("button", { type: "button", text: "Mute me", style: "display:none" });
    var bCam = $el("button", { type: "button", text: "Camera off", style: "display:none" });
    var bEnd = $el("button", { class: "pv-end", type: "button", text: "End video", style: "display:none" });
    var bHide = $el("button", { type: "button", text: "Hide", "aria-expanded": "true" });
    var stage = $el("div", { style: "position:relative;display:none" }, [rv, lv]);
    var title = $el("div", { style: "font-weight:700;font-size:.85rem" , text: "Video with the child" });
    var body = $el("div", {}, [title, stage, msg, $el("div", { class: "pv-row" }, [bGo, bMic, bCam, bEnd, bHide])]);
    var box = $el("div", { class: "pv-box noprint", style: "right:8px;bottom:8px;width:260px", role: "region", "aria-label": "Video with the child" }, [body]);
    document.body.appendChild(box);
    var mic = true, cam = true;
    var link = Link({
      role: "assessor", call: opts.call, iceServers: opts.iceServers,
      onStatus: function (t) { msg.textContent = t; },
      onRemote: function (s) { rv.srcObject = s || null; stage.style.display = s ? "block" : stage.style.display; if (s) { var p = rv.play(); if (p && p.catch) p.catch(function () { }); } },
      onLocal: function (s) { lv.srcObject = s || null; stage.style.display = s ? "block" : "none"; },
      onState: function (on) { bGo.style.display = on ? "none" : ""; bMic.style.display = bCam.style.display = bEnd.style.display = on ? "" : "none"; if (!on) { mic = cam = true; bMic.textContent = "Mute me"; bCam.textContent = "Camera off"; } },
      onEnded: function () { msg.textContent = "The session has ended, so video has stopped."; }
    });
    bGo.onclick = async function () { bGo.disabled = true; try { await link.startInvite(); } catch (e) { msg.textContent = e.message; } bGo.disabled = false; };
    bMic.onclick = function () { mic = !mic; link.setMic(mic); bMic.textContent = mic ? "Mute me" : "Unmute me"; };
    bCam.onclick = function () { cam = !cam; link.setCam(cam); bCam.textContent = cam ? "Camera off" : "Camera on"; };
    bEnd.onclick = function () { link.end(); };
    bHide.onclick = function () { var open = body.style.display !== "none"; var kids = box.firstChild.children; stage.style.display = open ? "none" : (rv.srcObject || lv.srcObject ? "block" : "none"); bHide.textContent = open ? "Show video" : "Hide"; bHide.setAttribute("aria-expanded", String(!open)); msg.style.display = open ? "none" : ""; title.style.display = open ? "none" : ""; };
    link.begin(); cur = { link: link, box: box };
    return link;
  }

  function mountChild(opts) { // opts: call, iceServers
    destroyCur(); addCss();
    var rv = $el("video", { playsinline: "", autoplay: "", style: "height:120px;width:100%" });
    var msg = $el("div", { class: "pv-msg", role: "status", "aria-live": "polite" });
    var bMic = $el("button", { type: "button", text: "Mute me" });
    var bCam = $el("button", { type: "button", text: "Hide my camera" });
    var bEnd = $el("button", { class: "pv-end", type: "button", text: "Stop video" });
    var video = $el("div", { class: "pv-box", style: "left:8px;bottom:8px;width:200px;display:none", role: "region", "aria-label": "Video call with your assessor" }, [rv, msg, $el("div", { class: "pv-row" }, [bMic, bCam, bEnd])]);
    var ask = $el("div", { class: "pv-box", style: "left:50%;transform:translateX(-50%);bottom:12px;width:min(92vw,420px);display:none;padding:14px", role: "dialog", "aria-label": "Video request" });
    var yes = $el("button", { class: "pv-go", type: "button", text: "Yes, turn on video", style: "font-size:1rem;padding:12px 14px" });
    var no = $el("button", { type: "button", text: "No thanks", style: "font-size:1rem;padding:12px 14px" });
    ask.append($el("div", { style: "font-size:1.05rem;font-weight:700", text: "Your assessor would like to see and hear you." }), $el("div", { style: "font-size:.9rem;margin:6px 0 10px", text: "The camera and microphone are only on while we work together. Nothing is recorded. You can stop at any time." }), $el("div", { class: "pv-row" }, [yes, no]));
    document.body.append(video, ask);
    var mic = true, cam = true;
    var link = Link({
      role: "child", call: opts.call, iceServers: opts.iceServers,
      onStatus: function (t) { msg.textContent = t; },
      onRemote: function (s) { rv.srcObject = s || null; if (s) { var p = rv.play(); if (p && p.catch) p.catch(function () { }); } },
      onState: function (on) { video.style.display = on ? "block" : "none"; if (!on) { mic = cam = true; bMic.textContent = "Mute me"; bCam.textContent = "Hide my camera"; } },
      onInvite: function () { if (video.style.display === "none") ask.style.display = "block"; },
      onEnded: function () { ask.style.display = "none"; }
    });
    yes.onclick = async function () { ask.style.display = "none"; try { await link.accept(); } catch (e) { video.style.display = "block"; msg.textContent = e.message; } };
    no.onclick = function () { ask.style.display = "none"; link.decline(); };
    bMic.onclick = function () { mic = !mic; link.setMic(mic); bMic.textContent = mic ? "Mute me" : "Unmute me"; };
    bCam.onclick = function () { cam = !cam; link.setCam(cam); bCam.textContent = cam ? "Hide my camera" : "Show my camera"; };
    bEnd.onclick = function () { link.end(); };
    link.begin(); cur = { link: link, box: video, ask: ask };
    return link;
  }

  root.POPSVideo = { mountAssessor: mountAssessor, mountChild: mountChild, stop: destroyCur };
})(typeof window !== "undefined" ? window : this);
