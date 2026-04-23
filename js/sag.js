        // ── SAG ──
        ['sag-pole', 'sag-wire-low'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                const pole = parseFloat(document.getElementById('sag-pole').value);
                const low = parseFloat(document.getElementById('sag-wire-low').value);
                const mField = document.getElementById('sag-measured');
                const mWrap = document.getElementById('sag-computed-field');
                if (!isNaN(pole) && !isNaN(low) && pole > low) {
                    mField.value = (pole - low).toFixed(1); mWrap.style.opacity = '1';
                } else {
                    mField.value = ''; mWrap.style.opacity = '0.6';
                }
            });
        });

        function calcSag(sagNow, span, tNow, tMax, alphaPerF = 12.0e-6) {
            const alpha = Math.max(0, Number(alphaPerF) || 0);
            const dT = Math.max(0, tMax - tNow);
            const dL = alpha * dT * span;
            const sagMax = Math.sqrt(sagNow * sagNow + (3 / 8) * span * dL);
            return { sagNow, sagMax, delta: sagMax - sagNow };
        }

        function runSag() {
            clearValidation('sag-validation');
            const pole = parseFloat(document.getElementById('sag-pole').value);
            const wireLow = parseFloat(document.getElementById('sag-wire-low').value);
            const span = parseFloat(document.getElementById('sag-span').value);
            const tNow = parseFloat(document.getElementById('sag-t-now').value) || 75;
            const tMax = parseFloat(document.getElementById('sag-t-max').value) || 115;
            const validationMessages = [];
            const invalidFields = [];
            if (!Number.isFinite(pole) || pole <= 0) { validationMessages.push('Pole height must be greater than 0 ft.'); invalidFields.push('sag-pole'); }
            if (!Number.isFinite(wireLow) || wireLow < 0) { validationMessages.push('Wire low point must be 0 ft or greater.'); invalidFields.push('sag-wire-low'); }
            if (Number.isFinite(pole) && Number.isFinite(wireLow) && pole <= wireLow) { validationMessages.push('Wire low point must be lower than pole height.'); invalidFields.push('sag-pole'); invalidFields.push('sag-wire-low'); }
            if (!Number.isFinite(span) || span <= 0) { validationMessages.push('Span length must be greater than 0 ft.'); invalidFields.push('sag-span'); }
            if (!Number.isFinite(tNow)) { validationMessages.push('Current temperature must be a valid number.'); invalidFields.push('sag-t-now'); }
            if (!Number.isFinite(tMax)) { validationMessages.push('Max expected temperature must be a valid number.'); invalidFields.push('sag-t-max'); }
            if (Number.isFinite(tNow) && Number.isFinite(tMax) && tMax < tNow) { validationMessages.push('Max expected temperature should be greater than or equal to current temperature.'); invalidFields.push('sag-t-max'); }
            if (validationMessages.length) { showValidation('sag-validation', validationMessages, invalidFields); return; }

            const sagNow = pole - wireLow;
            const perWire = wires.map((w, i) => {
                const typeEl = document.getElementById('w-type-' + i);
                const nameEl = document.getElementById('w-name-' + i);
                const type = typeEl ? typeEl.value : (w.type || DEFAULT_CONDUCTOR);
                const preset = conductorPresetById(type);
                const alphaPpmNorm = normalizeAlphaPpm(preset?.alphaPpm, DEFAULT_ALPHA_PPM);
                const alphaPerF = alphaPpmNorm * 1e-6;
                const s = calcSag(sagNow, span, tNow, tMax, alphaPerF);
                return {
                    index: i,
                    name: nameEl ? (nameEl.value || w.name) : w.name,
                    type,
                    alphaPpm: alphaPpmNorm,
                    ...s
                };
            });
            const worst = perWire.reduce((a, b) => b.sagMax > a.sagMax ? b : a, perWire[0]);
            lastSag = {
                span,
                tNow,
                tMax,
                sagNow,
                perWire,
                worstSagMax: worst?.sagMax || sagNow,
                worstWireName: worst?.name || 'Wire'
            };
            document.getElementById('sag-val').textContent = lastSag.worstSagMax.toFixed(2);
            document.getElementById('sag-sub').textContent = `Measured ${sagNow.toFixed(1)}ft now -> worst ${lastSag.worstSagMax.toFixed(1)}ft at ${tMax}F (${lastSag.worstWireName})`;
            document.getElementById('sm-inst').innerHTML = sagNow.toFixed(2) + '<span class="smet-unit"> ft</span>';
            document.getElementById('sm-temp').innerHTML = lastSag.worstSagMax.toFixed(2) + '<span class="smet-unit"> ft</span>';
            document.getElementById('sm-delta').innerHTML = '+' + (lastSag.worstSagMax - sagNow).toFixed(2) + '<span class="smet-unit"> ft</span>';
            document.getElementById('sag-result').classList.add('show');
            drawSagCanvas({ sagNow, sagMax: lastSag.worstSagMax, span, tNow, tMax });

            const mdrSagInput = document.getElementById('mdr-sag');
            if (mdrSagInput) mdrSagInput.value = Number(lastSag.worstSagMax).toFixed(2);
            if (typeof syncMdrWindFromControls === 'function') syncMdrWindFromControls();

            // Keep sag as preview until user explicitly applies it.
            const applyBtn = document.querySelector('[onclick="pushSagToCalc()"]');
            if (applyBtn) {
                applyBtn.textContent = '-> Apply per-wire sag by type/alpha';
                applyBtn.style.color = 'var(--accent2)';
                applyBtn.style.borderColor = 'rgba(59,139,255,.3)';
            }
        }

        function resetSag() {
            clearValidation('sag-validation');
            document.getElementById('sag-result').classList.remove('show'); lastSag = null;
            ['sag-pole', 'sag-wire-low', 'sag-span', 'sag-measured'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            document.getElementById('sag-computed-field').style.opacity = '0.6';
        }

        function pushSagToCalc() {
            if (!lastSag) return;
            if (lastSag.perWire && lastSag.perWire.length) {
                lastSag.perWire.forEach(ps => {
                    if (!wires[ps.index]) return;
                    const n = String(wires[ps.index].name || '');
                    wires[ps.index].sag = /neutral/i.test(n) ? 0 : parseFloat(ps.sagMax.toFixed(2));
                });
            } else {
                wires.forEach(w => { w.sag = parseFloat((lastSag.worstSagMax || 0).toFixed(2)); });
            }
            renderWireList();
            document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
            document.querySelectorAll('.pane').forEach((p, i) => p.classList.toggle('active', i === 0));
        }

        function updateVizLegend(r) {
            const legend = document.getElementById('viz-legend');
            if (!legend) return;
            const core = [
                `<div class="viz-legend-item"><div class="viz-legend-swatch" style="background:#3b8bff;height:3px;border-radius:2px"></div><span class="viz-legend-label">Pole</span></div>`,
                `<div class="viz-legend-item"><div class="viz-legend-swatch" style="background:#607a99;height:3px;border-radius:2px"></div><span class="viz-legend-label">Tree</span></div>`
            ];
            if ((r?.wires || []).some(w => (w.windSwayFt || 0) > 0.05)) {
                core.push(`<div class="viz-legend-item"><div class="viz-legend-swatch" style="background:transparent;border-top:2px dashed rgba(255,159,28,0.85);"></div><span class="viz-legend-label">Wind Sway Arc</span></div>`);
            }
            const wiresHtml = (r?.wires || []).map(w =>
                `<div class="viz-legend-item"><div class="viz-legend-swatch" style="background:${normalizeHexColor(w.color)};height:3px;border-radius:2px"></div><span class="viz-legend-label">${escHtml(w.name)}</span></div>`
            );
            legend.innerHTML = core.concat(wiresHtml).join('');
        }

        function drawSagCanvas(s) {
            const canvas = document.getElementById('sagCanvas');
            const cssW = canvas.parentElement.clientWidth, cssH = Math.round(cssW * 0.4);
            const dpr = window.devicePixelRatio || 1;
            canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.height = cssH + 'px';
            const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
            const W = cssW, H = cssH, p = { l: 22, r: 22, t: 20, b: 28 }, dW = W - p.l - p.r, dH = H - p.t - p.b;
            ctx.clearRect(0, 0, W, H);
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, 'rgba(59,139,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            const maxSag = s.sagMax * 1.3;
            const sx = x => p.l + (x / s.span) * dW, sy = y => p.t + (y / maxSag) * dH;
            ctx.strokeStyle = 'rgba(30,45,69,0.8)'; ctx.lineWidth = 0.5;
            for (let i = 0; i <= 4; i++) { const gy = p.t + i / 4 * dH; ctx.beginPath(); ctx.moveTo(p.l, gy); ctx.lineTo(W - p.r, gy); ctx.stroke(); }
            ctx.strokeStyle = 'rgba(59,139,255,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
            ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(s.span), sy(0)); ctx.stroke(); ctx.setLineDash([]);
            function drawCat(sag, color, lw, dash = []) {
                ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.beginPath();
                for (let i = 0; i <= 80; i++) { const x = i / 80 * s.span, y = 4 * sag * (x / s.span) * (1 - x / s.span); i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y)); }
                ctx.stroke(); ctx.setLineDash([]);
            }
            drawCat(s.sagNow, 'rgba(59,139,255,0.6)', 1.5, [5, 4]);
            ctx.shadowColor = 'rgba(232,255,71,0.4)'; ctx.shadowBlur = 6;
            drawCat(s.sagMax, '#e8ff47', 2); ctx.shadowBlur = 0;
            const mx = sx(s.span / 2), yN = sy(s.sagNow), yM = sy(s.sagMax);
            ctx.strokeStyle = 'rgba(232,255,71,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(mx, sy(0)); ctx.lineTo(mx, yM); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(59,139,255,0.9)'; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'left';
            ctx.fillText(s.sagNow.toFixed(1) + 'ft now', mx + 4, yN + 4);
            ctx.fillStyle = '#e8ff47'; ctx.font = 'bold 10px JetBrains Mono,monospace';
            ctx.fillText(s.sagMax.toFixed(1) + 'ft max', mx + 4, yM + 14);
            ctx.fillStyle = '#4a6480'; ctx.font = '8px JetBrains Mono,monospace';
            ctx.textAlign = 'left'; ctx.fillText('0', p.l - 2, H - 6);
            ctx.textAlign = 'right'; ctx.fillText(s.span + 'ft', W - p.r + 2, H - 6);
            ctx.fillStyle = 'rgba(59,139,255,0.6)'; ctx.fillText(s.tNow + '°F', W - p.r, p.t + 10);
            ctx.fillStyle = 'rgba(232,255,71,0.7)'; ctx.fillText(s.tMax + '°F worst', W - p.r, p.t + 22);
        }











