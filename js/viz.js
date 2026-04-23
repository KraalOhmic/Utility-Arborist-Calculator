        // ── VIZ ──
        function drawViz(r) {
            const canvas = document.getElementById('vizCanvas');
            const cssW = Math.max(canvas.parentElement.clientWidth || 0, canvas.parentElement.offsetWidth || 0, window.innerWidth || 300);
            const cssH = Math.round(cssW * 0.75);
            const dpr = window.devicePixelRatio || 1;
            canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.height = cssH + 'px';
            const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
            const W = cssW, H = cssH; ctx.clearRect(0, 0, W, H);
            const bgG = ctx.createRadialGradient(W * 0.25, H * 0.65, 0, W * 0.5, H * 0.5, W * 0.85);
            bgG.addColorStop(0, '#0f1520'); bgG.addColorStop(1, '#080c10');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            const hd = r.hd, vd = r.vd, th = r.th;
            const maxWH = Math.max(...r.wires.map(w => w.effectiveHt));
            const allWY = [0, maxWH, vd, vd + th];
            const padW = Math.max(hd, th, Math.abs(vd), 10) * 0.1;
            const minWX = -padW * 1.5, maxWX = hd + padW * 3.5, minWY = Math.min(...allWY) - padW * 0.8, maxWY = Math.max(...allWY) + padW * 0.8;
            const pL = 18, pR = 14, pT = 22, pB = 26;
            const sc = Math.min((W - pL - pR) / (maxWX - minWX), (H - pT - pB) / (maxWY - minWY));
            const cx = wx => pL + (wx - minWX) * sc, cy = wy => H - pB - (wy - minWY) * sc, cd = d => d * sc;
            ctx.strokeStyle = 'rgba(30,45,69,0.5)'; ctx.lineWidth = 0.5;
            const step = Math.pow(10, Math.floor(Math.log10(Math.max(hd, th, 1) / 3)));
            for (let x = Math.ceil(minWX / step) * step; x <= maxWX; x += step) { ctx.beginPath(); ctx.moveTo(cx(x), pT); ctx.lineTo(cx(x), H - pB); ctx.stroke(); }
            for (let y = Math.ceil(minWY / step) * step; y <= maxWY; y += step) { ctx.beginPath(); ctx.moveTo(pL, cy(y)); ctx.lineTo(W - pR, cy(y)); ctx.stroke(); }
            const gnd = ctx.createLinearGradient(0, cy(Math.min(0, vd)), 0, H);
            gnd.addColorStop(0, 'rgba(59,139,255,0.05)'); gnd.addColorStop(1, 'rgba(59,139,255,0.01)');
            ctx.fillStyle = gnd; ctx.beginPath(); ctx.moveTo(cx(0), cy(0)); ctx.lineTo(cx(hd), cy(vd)); ctx.lineTo(cx(hd), H); ctx.lineTo(cx(0), H); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(59,139,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
            ctx.beginPath(); ctx.moveTo(cx(minWX), cy(0)); ctx.lineTo(cx(hd + padW * 0.5), cy(0)); ctx.stroke();
            if (Math.abs(vd) > 0.5) { ctx.beginPath(); ctx.moveTo(cx(hd - padW * 0.3), cy(vd)); ctx.lineTo(cx(hd + padW * 0.5), cy(vd)); ctx.stroke(); }
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(59,139,255,0.08)'; ctx.lineWidth = 1; ctx.setLineDash([5, 8]);
            ctx.beginPath(); ctx.moveTo(cx(0), cy(0)); ctx.lineTo(cx(hd), cy(vd)); ctx.stroke(); ctx.setLineDash([]);
            const dimY = Math.max(cy(0), cy(vd)) + 16;
            ctx.strokeStyle = 'rgba(59,139,255,0.22)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(cx(0), dimY); ctx.lineTo(cx(hd), dimY); ctx.stroke();
            [[cx(0), dimY], [cx(hd), dimY]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke(); });
            ctx.fillStyle = 'rgba(74,100,128,0.8)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.fillText(hd + 'ft', cx(hd / 2), dimY + 12);
            r.wires.forEach(w => {
                const eHt = w.effectiveHt;
                const leanR2d = (r.lean || 0) * Math.PI / 180;
                const leanPen = r.leanPenalty || 0;
                // Arc centered at tree base (hd,vd), radius=th — this is the fall sweep
                const reachR = cd(th);
                const angToWire = Math.atan2(cy(eHt) - cy(vd), cx(0) - cx(hd)), angUp = -Math.PI / 2;
                ctx.shadowColor = w.color + '33'; ctx.shadowBlur = 10;
                ctx.strokeStyle = w.color + '45'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
                ctx.beginPath(); ctx.arc(cx(hd), cy(vd), reachR, angUp, angToWire, true); ctx.stroke();
                ctx.shadowBlur = 0; ctx.setLineDash([]);
                // Wind sway envelope from worst-sag point up toward pole-top plane (wire attachment height).
                if ((w.windSwayFt || 0) > 0.05) {
                    const sway = Math.max(0.5, w.windSwayFt);
                    const yTop = w.ht;
                    const yWorst = w.ht - (w.sag || 0);
                    const n = 40;
                    ctx.strokeStyle = 'rgba(255,159,28,0.9)';
                    ctx.lineWidth = 1.35;
                    ctx.setLineDash([3, 4]);
                    ctx.beginPath();
                    for (let i = 0; i <= n; i++) {
                        const u = -1 + (2 * i) / n;
                        const px = u * sway;
                        const py = yWorst + (yTop - yWorst) * (u * u);
                        const sx = cx(px), sy = cy(py);
                        if (i === 0) ctx.moveTo(sx, sy);
                        else ctx.lineTo(sx, sy);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                // Show leaned tip starting position on the arc
                if ((r.lean || 0) > 0) {
                    const tipWX = hd - leanPen, tipWY = vd + th * Math.cos(leanR2d);
                    ctx.strokeStyle = w.color + '88'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
                    ctx.beginPath(); ctx.moveTo(cx(hd), cy(vd)); ctx.lineTo(cx(tipWX), cy(tipWY)); ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = w.color + 'cc'; ctx.beginPath(); ctx.arc(cx(tipWX), cy(tipWY), 3, 0, Math.PI * 2); ctx.fill();
                    // Lean label
                    ctx.fillStyle = 'rgba(255,159,28,0.8)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'left';
                    ctx.fillText((r.lean || 0) + '° lean (-' + leanPen.toFixed(1) + 'ft)', cx(tipWX) + 5, cy(tipWY) - 4);
                }
                const gCol = w.clear ? w.color + 'aa' : '#ff4757aa';
                ctx.strokeStyle = gCol; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
                // Gap line from effective base position (hd-leanPenalty, vd) to wire
                const startX = Number.isFinite(w.effectiveHDWire) ? w.effectiveHDWire : (r.effectiveHD || hd);
                ctx.beginPath(); ctx.moveTo(cx(startX), cy(vd)); ctx.lineTo(cx(0), cy(eHt)); ctx.stroke(); ctx.setLineDash([]);
                ctx.shadowColor = w.color; ctx.shadowBlur = 10;
                ctx.fillStyle = w.color; ctx.beginPath(); ctx.arc(cx(0), cy(eHt), 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                ctx.fillStyle = w.color + 'cc'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'right';
                ctx.fillText(w.name + ' ' + w.ht + 'ft', cx(0) - 10, cy(eHt) + 3);
            });
            ctx.shadowColor = '#3b8bff'; ctx.shadowBlur = 14;
            ctx.strokeStyle = '#3b8bff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx(0), cy(0)); ctx.lineTo(cx(0), cy(maxWH)); ctx.stroke(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#3b8bff'; ctx.fillRect(cx(0) - 5, cy(0) - 3, 10, 6);
            ctx.strokeStyle = '#607a99'; ctx.lineWidth = 4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx(hd), cy(vd)); ctx.lineTo(cx(hd), cy(vd + th)); ctx.stroke();
            ctx.fillStyle = '#607a99'; ctx.beginPath(); ctx.arc(cx(hd), cy(vd), 4, 0, Math.PI * 2); ctx.fill();
            const worstClear = r.wires.every(w => w.clear), topC = worstClear ? '#2ecc71' : '#ff4757';
            ctx.shadowColor = topC; ctx.shadowBlur = 18;
            ctx.fillStyle = topC; ctx.beginPath(); ctx.arc(cx(hd), cy(vd + th), 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx(hd), cy(vd + th), 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(96,122,153,0.85)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'left'; ctx.fillText(th + 'ft', cx(hd) + 11, cy(vd + th / 2) + 3);
            if (Math.abs(vd) > 0.5) {
                const ex = cx(hd) + 24, y0 = cy(0), y1 = cy(vd);
                ctx.shadowColor = '#e8ff47'; ctx.shadowBlur = 6; ctx.strokeStyle = '#e8ff47'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(ex, y0); ctx.lineTo(ex, y1); ctx.stroke();
                const dir = vd < 0 ? 1 : -1; ctx.fillStyle = '#e8ff47';
                ctx.beginPath(); ctx.moveTo(ex, y1); ctx.lineTo(ex - 4, y1 - dir * 7); ctx.lineTo(ex + 4, y1 - dir * 7); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
                ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'left'; ctx.fillText((vd > 0 ? '+' : '') + vd + 'ft', ex + 8, (y0 + y1) / 2 + 3);
            }
            const sCol = worstClear ? '#2ecc71' : '#ff4757';
            ctx.shadowColor = sCol; ctx.shadowBlur = 14; ctx.fillStyle = sCol; ctx.font = 'bold 11px JetBrains Mono,monospace'; ctx.textAlign = 'right';
            ctx.fillText(worstClear ? '✓ ALL CLEAR' : '✕ STRIKE RISK', W - pR - 2, pT + 2); ctx.shadowBlur = 0;
            // show species if available
            if (r.species) {
                ctx.fillStyle = 'rgba(59,139,255,0.7)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'left';
                ctx.fillText(r.species, pL + 2, pT + 2);
            }
        }
        let vizMode = '2d';
        let vizSource = 'calc';

        function resetIsoView() {
            isoTheta = -0.45;
            isoPhi = 0.55;
            isoZoom = 1.0;
            isoPanX = 0;
            isoPanY = 0;
            isoPanZ = 0;
        }

        function renderActiveDiagram() {
            const btn2d = document.getElementById('tog-2d');
            const btnIso = document.getElementById('tog-iso');
            const c2d = document.getElementById('vizCanvas');
            const cIso = document.getElementById('isoCanvas');
            const cMdr = document.getElementById('mdrCanvas');
            const sub = document.getElementById('viz-sub-label');
            const toggleRow = document.getElementById('viz-toggle-row');
            const legend = document.getElementById('viz-legend');
            const stats = document.getElementById('viz-stats');
            const empty = document.getElementById('viz-empty');
            const badge = document.getElementById('viz-badge');

            if (vizSource === 'mdr') {
                if (toggleRow) toggleRow.style.display = 'none';
                if (c2d) c2d.style.display = 'none';
                if (cIso) cIso.style.display = 'none';
                if (legend) legend.style.display = 'none';
                if (stats) stats.style.display = 'none';
                if (sub) sub.textContent = 'MDR 3D view';
                if (badge) {
                    badge.textContent = 'MDR';
                    badge.style.background = 'rgba(255,159,28,.12)';
                    badge.style.color = 'var(--warn)';
                    badge.style.borderColor = 'rgba(255,159,28,.25)';
                }
                if (typeof lastMdrPlot !== 'undefined' && lastMdrPlot) {
                    if (cMdr) cMdr.style.display = 'block';
                    if (empty) empty.style.display = 'none';
                    if (typeof drawMdrCanvas === 'function') drawMdrCanvas(lastMdrPlot);
                } else {
                    if (cMdr) cMdr.style.display = 'none';
                    if (empty) {
                        empty.style.display = 'block';
                        empty.innerHTML = '<span class="viz-empty-icon">⚡</span>Run MDR forecast to populate';
                    }
                }
                return;
            }

            if (toggleRow) toggleRow.style.display = 'flex';
            if (cMdr) cMdr.style.display = 'none';
            if (empty) empty.innerHTML = '<span class="viz-empty-icon">⚡</span>Run a check to populate';

            if (modeOrDefault(vizMode) === '2d') {
                if (btn2d) { btn2d.style.background = 'rgba(59,139,255,.12)'; btn2d.style.color = 'var(--accent2)'; }
                if (btnIso) { btnIso.style.background = 'none'; btnIso.style.color = 'var(--muted)'; }
                if (c2d) c2d.style.display = 'block';
                if (cIso) cIso.style.display = 'none';
                if (sub) sub.textContent = 'Side profile';
            } else {
                if (btnIso) { btnIso.style.background = 'rgba(59,139,255,.12)'; btnIso.style.color = 'var(--accent2)'; }
                if (btn2d) { btn2d.style.background = 'none'; btn2d.style.color = 'var(--muted)'; }
                if (c2d) c2d.style.display = 'none';
                if (cIso) cIso.style.display = 'block';
                if (sub) sub.textContent = '3D span view';
            }

            if (lastResult) {
                if (empty) empty.style.display = 'none';
                if (legend) legend.style.display = 'flex';
                if (stats) stats.style.display = 'flex';
                if (modeOrDefault(vizMode) === 'iso') drawIso(lastResult);
                else drawViz(lastResult);
            } else {
                if (empty) empty.style.display = 'block';
                if (legend) legend.style.display = 'none';
                if (stats) stats.style.display = 'none';
            }
        }

        function modeOrDefault(mode) {
            return mode === 'iso' ? 'iso' : '2d';
        }

        function setVizSource(source) {
            vizSource = source === 'mdr' ? 'mdr' : 'calc';
            renderActiveDiagram();
        }

        function setVizMode(mode) {
            vizMode = mode;
            if (vizSource === 'mdr') return;
            renderActiveDiagram();
        }
        // ── 3D ROTATABLE SPAN VIEW ──
        // Uses basic perspective projection with spherical camera orbit.
        // Camera orbits around scene center. Drag to rotate.

        let isoTheta = -0.45;
        let isoPhi = 0.55;
        let isoZoom = 1.0;
        let isoDragging = false;
        let isoDragMode = 'pan';
        let isoLastX = 0, isoLastY = 0;
        let isoPanX = 0, isoPanY = 0, isoPanZ = 0;
        let isoUserMoved = false;

        function initIsoEvents() {
            const canvas = document.getElementById('isoCanvas');
            if (canvas._isoEventsAttached) return;
            canvas._isoEventsAttached = true;

            canvas.addEventListener('contextmenu', e => e.preventDefault());

            // Mouse drag: drag to pan, shift/right-click drag to orbit
            canvas.addEventListener('mousedown', e => {
                isoDragging = true;
                isoDragMode = (e.shiftKey || e.button === 2) ? 'orbit' : 'pan';
                isoLastX = e.clientX; isoLastY = e.clientY;
                canvas.style.cursor = isoDragMode === 'orbit' ? 'grabbing' : 'move';
                e.preventDefault();
            });
            window.addEventListener('mousemove', e => {
                if (!isoDragging) return;
                const dx = e.clientX - isoLastX, dy = e.clientY - isoLastY;
                isoLastX = e.clientX; isoLastY = e.clientY;
                isoUserMoved = true;
                if (isoDragMode === 'orbit') {
                    isoTheta -= dx * 0.008;
                    isoPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, isoPhi - dy * 0.006));
                } else {
                    const panScale = 0.18 / Math.max(isoZoom, 0.35);
                    isoPanX -= dx * panScale;
                    isoPanY += dy * panScale;
                }
                if (lastResult) drawIso(lastResult);
            });
            window.addEventListener('mouseup', () => {
                isoDragging = false;
                canvas.style.cursor = 'grab';
            });

            // Mouse wheel zoom
            canvas.addEventListener('wheel', e => {
                isoZoom = Math.max(0.45, Math.min(14, isoZoom * (e.deltaY > 0 ? 0.92 : 1.08)));
                isoUserMoved = true;
                if (lastResult) drawIso(lastResult);
                e.preventDefault();
            }, { passive: false });

            // Touch: Google Maps scheme
            // 1 finger drag  → pan
            // 2 finger same-direction drag → orbit
            // 2 finger pinch/spread → zoom
            let lastTouchX = 0, lastTouchY = 0;
            let lastPinchDist = null, lastPinchMidX = 0, lastPinchMidY = 0;
            let touchJustSwitched = false;

            function isoPanSpeed() {
                return 0.20 / Math.max(isoZoom, 0.35);
            }

            canvas.addEventListener('touchstart', e => {
                if (e.touches.length === 1) {
                    lastTouchX = e.touches[0].clientX;
                    lastTouchY = e.touches[0].clientY;
                    lastPinchDist = null;
                    touchJustSwitched = false;
                } else if (e.touches.length === 2) {
                    const t0 = e.touches[0], t1 = e.touches[1];
                    const dx = t0.clientX - t1.clientX;
                    const dy = t0.clientY - t1.clientY;
                    lastPinchDist = Math.sqrt(dx * dx + dy * dy);
                    lastPinchMidX = (t0.clientX + t1.clientX) / 2;
                    lastPinchMidY = (t0.clientY + t1.clientY) / 2;
                    touchJustSwitched = true;
                }
                e.preventDefault();
            }, { passive: false });

            canvas.addEventListener('touchmove', e => {
                if (e.touches.length === 1) {
                    if (!touchJustSwitched) {
                        const dx = e.touches[0].clientX - lastTouchX;
                        const dy = e.touches[0].clientY - lastTouchY;
                        isoUserMoved = true;
                        const sp = isoPanSpeed();
                        isoPanX -= dx * sp;
                        isoPanY += dy * sp;
                        if (lastResult) drawIso(lastResult);
                    }
                    lastTouchX = e.touches[0].clientX;
                    lastTouchY = e.touches[0].clientY;
                    touchJustSwitched = false;

                } else if (e.touches.length === 2) {
                    const t0 = e.touches[0], t1 = e.touches[1];
                    const dx = t0.clientX - t1.clientX;
                    const dy = t0.clientY - t1.clientY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const midX = (t0.clientX + t1.clientX) / 2;
                    const midY = (t0.clientY + t1.clientY) / 2;

                    if (!touchJustSwitched && lastPinchDist !== null && lastPinchDist > 0) {
                        const distDelta = Math.abs(dist - lastPinchDist);
                        const midDX = midX - lastPinchMidX;
                        const midDY = midY - lastPinchMidY;
                        const midMove = Math.sqrt(midDX * midDX + midDY * midDY);
                        isoUserMoved = true;

                        if (distDelta > midMove * 0.4) {
                            // Pinch dominates → zoom
                            isoZoom = Math.max(0.45, Math.min(14, isoZoom * (dist / lastPinchDist)));
                        } else {
                            // Midpoint movement dominates → orbit
                            isoTheta -= midDX * 0.012;
                            isoPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, isoPhi - midDY * 0.009));
                        }
                        if (lastResult) drawIso(lastResult);
                    }

                    lastPinchDist = dist;
                    lastPinchMidX = midX;
                    lastPinchMidY = midY;
                    touchJustSwitched = false;
                }
                e.preventDefault();
            }, { passive: false });

            canvas.addEventListener('touchend', e => {
                if (e.touches.length === 0) {
                    lastPinchDist = null;
                    touchJustSwitched = false;
                } else if (e.touches.length === 1) {
                    lastPinchDist = null;
                    lastTouchX = e.touches[0].clientX;
                    lastTouchY = e.touches[0].clientY;
                    touchJustSwitched = true;
                }
            }, { passive: true });

            canvas.style.cursor = 'grab';
        }

        function drawIso(r) {
            const canvas = document.getElementById('isoCanvas');
            initIsoEvents();
            const cssW = canvas.parentElement.clientWidth;
            const cssH = Math.round(cssW * 0.92);
            const dpr = window.devicePixelRatio || 1;
            canvas.width = cssW * dpr; canvas.height = cssH * dpr;
            canvas.style.height = cssH + 'px';
            const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
            const W = cssW, H = cssH; ctx.clearRect(0, 0, W, H);
            const bg = ctx.createRadialGradient(W * .45, H * .4, 0, W * .5, H * .5, W * .9);
            bg.addColorStop(0, '#0f1520'); bg.addColorStop(1, '#080c10');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            const hd = r.hd, vd = r.vd, th = r.th, t = r.t || 0.5;
            const span = Math.max(hd * 2.5, 80);
            const treeZ = t * span;
            const treeX = hd;
            const maxWH = Math.max(...r.wires.map(w => w.ht));
            const minY = Math.min(0, vd, ...r.wires.map(w => w.ht));
            const maxY = Math.max(maxWH, vd + th, 20);
            const sceneH = Math.max(maxY - minY, 20);

            const cx3 = hd * 0.28 + isoPanX;
            const cy3 = minY + sceneH * 0.46 + isoPanY;
            const cz3 = span * 0.5 + isoPanZ;
            const sceneSize = Math.max(span * 0.9, hd * 1.35, sceneH * 1.1, 80);
            const camDist = sceneSize * 0.95 / isoZoom;

            const camX = cx3 + camDist * Math.cos(isoPhi) * Math.sin(isoTheta);
            const camY = cy3 + camDist * Math.sin(isoPhi);
            const camZ = cz3 + camDist * Math.cos(isoPhi) * Math.cos(isoTheta);

            let fx = cx3 - camX, fy = cy3 - camY, fz = cz3 - camZ;
            const fl = Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;
            let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
            const rl = Math.sqrt(rx * rx + ry * ry + rz * rz); rx /= rl; ry /= rl; rz /= rl;
            const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
            const focal = Math.min(W, H) * 0.68;

            function proj(wx, wy, wz) {
                const dx = wx - camX, dy = wy - camY, dz = wz - camZ;
                const vx = dx * rx + dy * ry + dz * rz, vy = dx * ux + dy * uy + dz * uz, vz = dx * fx + dy * fy + dz * fz;
                if (vz <= 0.1) return null;
                return { sx: W / 2 + focal * vx / vz, sy: H / 2 - focal * vy / vz, d: vz };
            }

            // Poles
            function drawPole(z) {
                const pb = proj(0, 0, z), pt = proj(0, maxWH, z); if (!pb || !pt) return;
                ctx.strokeStyle = '#3b8bff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(pb.sx, pb.sy); ctx.lineTo(pt.sx, pt.sy); ctx.stroke();
            }
            drawPole(0); drawPole(span);

            // Conductors
            r.wires.forEach(w => {
                const sag = w.sag || 0;
                ctx.strokeStyle = w.color; ctx.lineWidth = 2; ctx.beginPath();
                for (let i = 0; i <= 40; i++) {
                    const wz = (i / 40) * span;
                    const wy = w.ht - (sag * 4 * (wz / span) * (1 - (wz / span)));
                    const p = proj(0, wy, wz);
                    if (p) i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
                }
                ctx.stroke();
            });


            // Wind sway envelope (3D): from worst-sag point toward pole-top plane at selected span position.
            r.wires.forEach(w => {
                if ((w.windSwayFt || 0) <= 0.05) return;
                const sway = Math.max(0.5, w.windSwayFt);
                const y0 = (w.ht || 0) - (w.sag || 0);
                const yTop = (w.ht || y0);
                ctx.strokeStyle = 'rgba(255,159,28,0.92)';
                ctx.lineWidth = 1.35;
                ctx.setLineDash([3, 4]);
                ctx.beginPath();
                const nSeg = 42;
                let started = false;
                for (let i = 0; i <= nSeg; i++) {
                    const u = -1 + (2 * i) / nSeg;
                    const wx = sway * u;
                    const wy = y0 + (yTop - y0) * (u * u);
                    const p = proj(wx, wy, treeZ);
                    if (!p) continue;
                    if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
                    else ctx.lineTo(p.sx, p.sy);
                }
                if (started) ctx.stroke();
                ctx.setLineDash([]);
            });
            // CALCULATE STRIKE HIGHLIGHT (The scribe point)
            let minStrikeDist = Infinity;
            r.wires.forEach(w => {
                const strikeHd = Number.isFinite(w.effectiveHDWire) ? w.effectiveHDWire : hd;
                const dist = computeRequiredStrikeDistance(strikeHd, vd, w.effectiveHt).distance;
                if (dist < minStrikeDist) minStrikeDist = dist;
            });

            const basePt = proj(treeX, vd, treeZ);
            if (basePt) {
                const N = 60;
                const safeRadius = Math.min(th, minStrikeDist);

                // Draw Safe Wedge (Inner Curve) - Green
                ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
                ctx.beginPath();
                ctx.moveTo(basePt.sx, basePt.sy);
                for (let i = 0; i <= N; i++) {
                    const ang = (Math.PI / 2) * (i / N);
                    const p = proj(treeX - safeRadius * Math.sin(ang), Math.max(0, vd + safeRadius * Math.cos(ang)), treeZ);
                    if (p) ctx.lineTo(p.sx, p.sy);
                }
                ctx.closePath();
                ctx.fill();

                // Draw Strike Wedge (Outer Scribed Ring) - Red
                if (th > minStrikeDist) {
                    ctx.fillStyle = 'rgba(255, 71, 87, 0.4)';
                    ctx.beginPath();
                    for (let i = 0; i <= N; i++) { // Outer edge
                        const ang = (Math.PI / 2) * (i / N);
                        const p = proj(treeX - th * Math.sin(ang), Math.max(0, vd + th * Math.cos(ang)), treeZ);
                        if (p) ctx.lineTo(p.sx, p.sy);
                    }
                    for (let i = N; i >= 0; i--) { // Inner edge (scribed along the strike radius)
                        const ang = (Math.PI / 2) * (i / N);
                        const p = proj(treeX - minStrikeDist * Math.sin(ang), Math.max(0, vd + minStrikeDist * Math.cos(ang)), treeZ);
                        if (p) ctx.lineTo(p.sx, p.sy);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // --- HIGHLIGHTED TRUNK + STRIKE MEASUREMENT ---
            const leanRad = (r.lean || 0) * Math.PI / 180;
            const sinL = Math.sin(leanRad), cosL = Math.cos(leanRad);
            const treeStroke = 5;

            // Calculate coordinates for the LEANING transition point
            const safeTrunkLen = Math.min(th, minStrikeDist);
            const transitionX = treeX - safeTrunkLen * sinL;
            const transitionY = vd + safeTrunkLen * cosL;
            const pTransition = proj(transitionX, transitionY, treeZ);

            // Full tip point
            const tipX = treeX - th * sinL;
            const tipY = vd + th * cosL;
            const tt3 = proj(tipX, tipY, treeZ);

            if (basePt) {
                // 1. Safe Portion (Green)
                if (pTransition) {
                    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = treeStroke; ctx.lineCap = 'round'; ctx.setLineDash([]);
                    ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.moveTo(basePt.sx, basePt.sy); ctx.lineTo(pTransition.sx, pTransition.sy); ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // 2. Strike Portion (Red + Measurement)
                if (th > minStrikeDist && pTransition && tt3) {
                    // Draw Red Segment
                    ctx.strokeStyle = '#ff4757'; ctx.lineWidth = treeStroke; ctx.lineCap = 'round'; ctx.setLineDash([]);
                    ctx.shadowColor = '#ff4757'; ctx.shadowBlur = 15;
                    ctx.beginPath(); ctx.moveTo(pTransition.sx, pTransition.sy); ctx.lineTo(tt3.sx, tt3.sy); ctx.stroke();
                    ctx.shadowBlur = 0;

                    // Draw Dimension Line for Strike Length
                    const strikeLength = th - minStrikeDist;
                    const offset = 10; // Offset dimension line from trunk
                    const perpX = cosL * offset, perpY = sinL * offset; // Perpendicular offset vector

                    const pDimStart = proj(transitionX + perpX, transitionY - perpY, treeZ);
                    const pDimEnd = proj(tipX + perpX, tipY - perpY, treeZ);
                    const pDimMid = proj(transitionX + perpX - (th - minStrikeDist) / 2 * sinL, transitionY - perpY + (th - minStrikeDist) / 2 * cosL, treeZ);

                    if (pDimStart && pDimEnd) {
                        ctx.strokeStyle = '#ff4757cc'; ctx.lineWidth = 1; ctx.setLineDash([]);
                        ctx.beginPath(); ctx.moveTo(pDimStart.sx, pDimStart.sy); ctx.lineTo(pDimEnd.sx, pDimEnd.sy); ctx.stroke();
                        // End caps
                        ctx.beginPath(); ctx.moveTo(pDimStart.sx - 2, pDimStart.sy - 2); ctx.lineTo(pDimStart.sx + 2, pDimStart.sy + 2); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pDimEnd.sx - 2, pDimEnd.sy - 2); ctx.lineTo(pDimEnd.sx + 2, pDimEnd.sy + 2); ctx.stroke();

                        // Measurement text
                        if (pDimMid) {
                            ctx.fillStyle = '#ff4757'; ctx.font = 'bold 9px JetBrains Mono,monospace'; ctx.textAlign = 'left';
                            ctx.fillText(`Strike: ${strikeLength.toFixed(1)}ft`, pDimMid.sx + 5, pDimMid.sy);
                        }
                    }
                } else if (th <= minStrikeDist && tt3 && pTransition) {
                    // If whole tree is safe, ensure it draws all the way to tip as green
                    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = treeStroke; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(pTransition.sx, pTransition.sy); ctx.lineTo(tt3.sx, tt3.sy); ctx.stroke();
                }

                // Base dot
                ctx.fillStyle = '#607a99'; ctx.beginPath(); ctx.arc(basePt.sx, basePt.sy, 4, 0, Math.PI * 2); ctx.fill();
            }

            // Wire Indicators (Base to wire dots)
            r.wires.forEach(w => {
                const wirePt = proj(0, w.effectiveHt, treeZ);
                if (wirePt && basePt) {
                    ctx.strokeStyle = w.color; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(basePt.sx, basePt.sy); ctx.lineTo(wirePt.sx, wirePt.sy); ctx.stroke();
                    ctx.fillStyle = w.color; ctx.beginPath(); ctx.arc(wirePt.sx, wirePt.sy, 3, 0, Math.PI * 2); ctx.fill();
                }
            });
        }

        window.addEventListener('resize', () => {
            renderActiveDiagram();
        });


