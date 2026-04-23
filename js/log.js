        // ── LOG ──
        function toggleLogItem(idx) {
            const el = document.getElementById('log-entry-' + idx);
            if (el) el.classList.toggle('expanded');
        }

        function updateLog() {
            document.getElementById('log-count').textContent = logEntries.length + ' Entr' + (logEntries.length === 1 ? 'y' : 'ies');
            const list = document.getElementById('log-list');
            if (!logEntries.length) { list.innerHTML = '<div class="log-empty">No checks logged yet</div>'; return; }
            try { list.innerHTML = logEntries.map((e, idx) => {
                const st = e.overallClear ? 'clear' : (e.overallWarn ? 'warn' : 'strike');
                const verdict = e.overallClear ? 'ALL CLEAR' : (e.overallWarn ? 'MARGINAL' : 'STRIKE RISK');
                const time = (function() {
                    try {
                        if (!e.ts) return '';
                        const h = e.ts.getHours(), m = e.ts.getMinutes();
                        return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? 'am' : 'pm');
                    } catch(ex) { return ''; }
                })();
                const sagPct = Math.round(4 * (e.t || 0.5) * (1 - (e.t || 0.5)) * 100);
                return `<div class="log-item" id="log-entry-${idx}">
              <div class="log-item-top" onclick="toggleLogItem(${idx})">
                <div class="log-dot ${st}"></div>
                <div class="log-info">
                  <div class="log-res ${st}">${verdict}</div>
                  ${e.species ? `<div class="log-species">${escHtml(e.species)}</div>` : ''}
                  <div class="log-params">HD${e.hd} · VD${e.vd} · TH${e.th} · ${e.wires}W · t${(e.t || 0.5).toFixed(1)} ${time ? '· ' + time : ''}</div>
                </div>
                <div class="log-right">
                  <div class="log-gap-val">${(e.worstMargin >= 0 ? '+' : '') + e.worstMargin.toFixed(1)}<span style="font-size:10px;color:var(--muted)">ft</span></div>
                  <div class="log-gap-lbl">Margin</div>
                </div>
                <div class="log-chevron">▼</div>
              </div>
              <div class="log-detail">
                <div class="log-detail-grid">
                  <div class="log-detail-cell"><div class="log-detail-lbl">Horiz Dist</div><div class="log-detail-val">${e.hd}<span style="font-size:10px;color:var(--muted)">ft</span></div></div>
                  <div class="log-detail-cell"><div class="log-detail-lbl">Elevation</div><div class="log-detail-val">${(e.vd >= 0 ? '+' : '') + e.vd}<span style="font-size:10px;color:var(--muted)">ft</span></div></div>
                  <div class="log-detail-cell"><div class="log-detail-lbl">Tree Ht</div><div class="log-detail-val">${e.th}<span style="font-size:10px;color:var(--muted)">ft</span></div></div>
                  <div class="log-detail-cell"><div class="log-detail-lbl">Lean</div><div class="log-detail-val" style="color:${(e.lean || 0) > 0 ? 'var(--warn)' : 'var(--text)'}">${e.lean || 0}°</div></div>
                  <div class="log-detail-cell"><div class="log-detail-lbl">Span Pos</div><div class="log-detail-val">${(e.t || 0.5).toFixed(1)}<span style="font-size:10px;color:var(--muted)"> (${sagPct}%)</span></div></div>
                  <div class="log-detail-cell"><div class="log-detail-lbl">Margin</div><div class="log-detail-val" style="color:${e.overallClear ? 'var(--success)' : 'var(--danger)'}">${(e.worstMargin >= 0 ? '+' : '') + e.worstMargin.toFixed(1)}<span style="font-size:10px;color:var(--muted)">ft</span></div></div>
                </div>
                ${e.species ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--accent2);margin-bottom:8px">Species: ${escHtml(e.species)}</div>` : ''}
                ${e.wireData ? `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:8px">${e.wireData.map(w => `${escHtml(w.name)} ${w.ht}ft${w.sag > 0 ? ' (sag ' + w.sag + 'ft)' : ''}${w.type ? ' [' + escHtml(w.type) + ' ' + normalizeAlphaPpm(w.alphaPpm).toFixed(1) + 'ppm]' : ''}`).join(' · ')}</div>` : ''}
                <button class="log-reload-btn" onclick="reloadEntry(${idx})">↩ Reload into calculator</button>
              </div>
            </div>`;
            }).join(''); } catch(err) { list.innerHTML = '<div class="log-empty" style="color:red">Log render error: ' + err.message + '</div>'; }
        }

        function clearLog() { logEntries = []; updateLog(); }

