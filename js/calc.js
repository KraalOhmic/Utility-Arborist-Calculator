        // ── CALC ──
        function computeRequiredStrikeDistance(horizontalFt, treeBaseElevationFt, targetElevationFt) {
            const horizontal = Math.abs(Number(horizontalFt) || 0);
            const verticalDiff = (Number(targetElevationFt) || 0) - (Number(treeBaseElevationFt) || 0);
            return {
                horizontal,
                verticalDiff,
                distance: Math.hypot(horizontal, verticalDiff)
            };
        }

        // Lean UI:
        // Lean slider is retained for display only.
        // It does not affect strike calculations or effective horizontal distance.
        function runCheck() {
            clearValidation('calc-validation');
            const hd = Math.abs(parseFloat(document.getElementById('hd').value) || 0);
            const vd = parseFloat(document.getElementById('vd').value) || 0;
            const th = clampNonNegative(parseFloat(document.getElementById('th').value), 0);
            const t = parseFloat(document.getElementById('span-pos').value) || 0.5;
            const lean = parseFloat(document.getElementById('lean-angle').value) || 0;
            const leanPenalty = 0;
            const effectiveHD = hd;
            const species = document.getElementById('species-select').value || '';
            const sagFactor = 4 * t * (1 - t);
            const windMode = document.getElementById('wind-mode')?.value || 'sierra';
            const windPeakMph = clampNonNegative(parseFloat(document.getElementById('wind-peak-mph')?.value), WIND_SWAY_DEFAULT_MPH);
            const windEnabled = windMode !== 'off' && windPeakMph > 0;
            const windScale = windEnabled ? Math.pow(windPeakMph / WIND_SWAY_REF_MPH, 2) : 0;

            const validationMessages = [];
            const invalidFields = [];
            const hdRaw = parseFloat(document.getElementById('hd').value);
            const vdRaw = parseFloat(document.getElementById('vd').value);
            const thRaw = parseFloat(document.getElementById('th').value);
            const tRaw = parseFloat(document.getElementById('span-pos').value);

            if (!Number.isFinite(hdRaw) || hdRaw <= 0) { validationMessages.push('Horizontal distance must be greater than 0 ft.'); invalidFields.push('hd'); }
            if (!Number.isFinite(vdRaw)) { validationMessages.push('Tree base elevation must be a valid number.'); invalidFields.push('vd'); }
            if (!Number.isFinite(thRaw) || thRaw <= 0) { validationMessages.push('Tree height must be greater than 0 ft.'); invalidFields.push('th'); }
            if (!Number.isFinite(tRaw) || tRaw < 0.1 || tRaw > 0.9) { validationMessages.push('Position in span must be between 0.1 and 0.9.'); invalidFields.push('span-pos'); }

            const wireData = wires.map((w, i) => {
                const htEl = document.getElementById('w-ht-' + i);
                const sagEl = document.getElementById('w-sag-' + i);
                const clrEl = document.getElementById('w-clr-' + i);
                const typeEl = document.getElementById('w-type-' + i);
                const nameEl = document.getElementById('w-name-' + i);
                const ht = htEl ? parseFloat(htEl.value) : w.ht;
                const isNeutral = /neutral/i.test(String(nameEl ? (nameEl.value || w.name) : w.name));
                const sag = isNeutral ? 0 : (sagEl ? parseFloat(sagEl.value) : w.sag);
                const minClr = clrEl ? parseFloat(clrEl.value) : w.minClr;
                const type = typeEl ? typeEl.value : (w.type || DEFAULT_CONDUCTOR);
                const preset = conductorPresetById(type);
                const blowoutK = blowoutFactorForType(type);
                const name = nameEl ? nameEl.value : w.name;
                if (!String(name || '').trim()) { validationMessages.push(`Wire ${i + 1}: name is required.`); invalidFields.push(`w-name-${i}`); }
                if (!Number.isFinite(ht) || ht <= 0) { validationMessages.push(`Wire ${i + 1}: height must be greater than 0 ft.`); invalidFields.push(`w-ht-${i}`); }
                if (!isNeutral && (!Number.isFinite(sag) || sag < 0)) { validationMessages.push(`Wire ${i + 1}: sag must be 0 ft or greater.`); invalidFields.push(`w-sag-${i}`); }
                if (!isNeutral && Number.isFinite(ht) && Number.isFinite(sag) && sag > ht) { validationMessages.push(`Wire ${i + 1}: sag cannot exceed wire height.`); invalidFields.push(`w-sag-${i}`); }
                if (!Number.isFinite(minClr) || minClr < 0) { validationMessages.push(`Wire ${i + 1}: minimum clearance must be 0 ft or greater.`); invalidFields.push(`w-clr-${i}`); }
                return {
                    ...w,
                    name: name || w.name,
                    ht: clampNonNegative(ht, w.ht || 0),
                    sag: clampNonNegative(sag, 0),
                    minClr: clampNonNegative(minClr, typeof w.minClr === 'number' ? w.minClr : DEFAULT_MIN_CLEARANCE_FT),
                    type,
                    alphaPpm: normalizeAlphaPpm(preset?.alphaPpm, DEFAULT_ALPHA_PPM),
                    blowoutK,
                    color: normalizeHexColor(w.color, WIRE_COLORS[i % WIRE_COLORS.length]),
                };
            });

            if (th <= 0) { validationMessages.push('Tree height must be greater than 0 ft.'); invalidFields.push('th'); }
            if (partialActive && partialBase > 0 && partialLength > 0 && partialBase + partialLength > th) {
                validationMessages.push('Partial failure base + length cannot exceed total tree height (' + th + 'ft).');
                invalidFields.push('partial-base');
                invalidFields.push('partial-length');
            }
            if (!wireData.length) { validationMessages.push('Add at least one wire.'); }

            if (validationMessages.length) {
                showValidation('calc-validation', validationMessages, invalidFields);
                return;
            }

            // Partial failure mode
            const partialActive = document.getElementById('partial-failure-wrap')?.style.display !== 'none';
            const partialBase = partialActive ? clampNonNegative(parseFloat(document.getElementById('partial-base')?.value), 0) : 0;
            const partialLength = partialActive ? clampNonNegative(parseFloat(document.getElementById('partial-length')?.value), 0) : 0;

            const results = wireData.map(w => {
                const effectiveHt = w.ht - w.sag * sagFactor;
                const windSwayFt = windEnabled
                    ? clampNonNegative(w.sag * sagFactor * w.blowoutK * windScale * WIND_SWAY_SAFETY_FACTOR, 0)
                    : 0;
                const effectiveHDWire = Math.max(0, effectiveHD - windSwayFt);

                let requiredReach, reach, strikeMode;
                // Always compute full strike first as fallback
                let strike = computeRequiredStrikeDistance(effectiveHDWire, vd, effectiveHt);
                requiredReach = strike.distance;
                reach = th;
                strikeMode = 'full';
                if (partialActive && partialBase > 0 && partialLength > 0) {
                    // Partial failure: arc swings from failure base point
                    // Failure point is partialBase ft above ground at tree base
                    const failurePointElev = partialBase + vd;
                    requiredReach = Math.sqrt(
                        effectiveHDWire * effectiveHDWire +
                        Math.pow(effectiveHt - failurePointElev, 2)
                    );
                    reach = partialLength;
                    strikeMode = 'partial';
                    strike = { horizontal: effectiveHDWire, verticalDiff: effectiveHt - failurePointElev, distance: requiredReach };
                }

                const margin = requiredReach - reach;
                const clear = margin >= w.minClr;
                const warn = !clear && margin >= 0;
                return {
                    ...w,
                    effectiveHt,
                    sagFactor,
                    horizontalDiff: strike.horizontal,
                    verticalDiff: strike.verticalDiff,
                    requiredReach,
                    gap: requiredReach,
                    windSwayFt,
                    effectiveHDWire,
                    reach,
                    margin,
                    clear,
                    warn,
                };
            });

            const worstMargin = Math.min(...results.map(r => r.margin));
            const worstVsReq = Math.min(...results.map(r => r.margin - r.minClr));
            const overallClear = results.every(r => r.clear);
            const overallWarn = !overallClear && results.every(r => r.margin >= 0);
            lastResult = {
                hd,
                vd,
                th,
                t,
                lean,
                leanPenalty,
                effectiveHD,
                species,
                sagFactor,
                windMode,
                windPeakMph,
                windEnabled,
                windScale,
                wires: results,
                worstMargin,
                worstVsReq,
                overallClear,
                overallWarn,
                partialActive,
                partialBase,
                partialLength
            };

            const status = overallClear ? 'clear' : (overallWarn ? 'warn' : 'strike');
            const banner = document.getElementById('overall-banner');
            banner.className = 'overall-banner ' + status;
            document.getElementById('banner-icon').textContent = overallClear ? '✓' : (overallWarn ? '⚠' : '✕');
            document.getElementById('banner-label').textContent = overallClear ? 'All Wires Clear' : (overallWarn ? 'Marginal Clearance' : 'Strike Risk');
            const pfBadge = document.getElementById('partial-failure-badge');
            if (pfBadge) {
                pfBadge.style.display = partialActive && partialBase > 0 && partialLength > 0 ? 'inline-block' : 'none';
                pfBadge.textContent = 'PARTIAL FAILURE · ' + partialLength + 'ft from ' + partialBase + 'ft';
            }
            document.getElementById('banner-sub').textContent = overallClear
                ? `Closest contact: +${worstMargin.toFixed(1)} ft over required clearance`
                : overallWarn
                    ? `Under minimum by ${Math.abs(worstVsReq).toFixed(1)}ft on at least one wire`
                    : `Shortfall: ${Math.abs(worstMargin).toFixed(1)} ft — strike likely`;

            const totalSag = wireData.reduce((s, w) => s + w.sag, 0);
            const sagNote = document.getElementById('sag-applied-note');
            if (sagNote) {
                if (totalSag > 0) {
                    sagNote.style.display = 'block';
                    sagNote.textContent = `Sag applied at t=${t.toFixed(1)} (${Math.round(sagFactor * 100)}% of max) — wire heights reduced by ${wireData.map(w => (w.sag * sagFactor).toFixed(1) + 'ft').join(', ')}`;
                } else {
                    sagNote.style.display = 'none';
                }
            }

            const windNote = document.getElementById('wind-applied-note');
            if (windNote) {
                if (windEnabled) {
                    windNote.style.display = 'block';
                    windNote.textContent = `Wind sway (${windMode}) at ${windPeakMph.toFixed(0)}mph (ref ${WIND_SWAY_REF_MPH}mph, safety ${WIND_SWAY_SAFETY_FACTOR.toFixed(2)}x) — sway by wire: ${results.map(r => `${r.name} ${r.windSwayFt.toFixed(1)}ft`).join(', ')}`;
                } else {
                    windNote.style.display = 'none';
                }
            }

            document.getElementById('wire-results').innerHTML = results.map(r => {
                const st = r.clear ? 'clear' : (r.margin >= 0 ? 'warn' : 'strike');
                const icon = r.clear ? '✓' : (st === 'warn' ? '⚠' : '✕');
                const verdict = r.clear ? 'CLEAR' : (st === 'warn' ? 'MARGINAL' : 'STRIKE');
                const pBadge = (partialActive && partialBase > 0 && partialLength > 0) ? '<span style="font-size:8px;background:rgba(255,159,28,.15);border:1px solid rgba(255,159,28,.4);border-radius:3px;padding:1px 5px;color:rgba(255,159,28,.9);margin-left:6px;vertical-align:middle">PARTIAL</span>' : '';
                return `<div class="wire-result">
              <div class="wire-result-top ${st}">
                <div class="res-dot" style="background:${r.color};box-shadow:0 0 6px ${r.color}88"></div>
                <span class="res-icon">${icon}</span>
                <span class="res-name">${r.name}</span>
                <span class="res-verdict">${verdict}${pBadge}</span>
              </div>
              <div class="res-metrics">
                <div class="rmet"><div class="rmet-lbl">Eff Ht</div><div class="rmet-val">${r.effectiveHt.toFixed(1)}<span class="rmet-unit">ft</span></div></div>
                <div class="rmet"><div class="rmet-lbl">Req'd</div><div class="rmet-val">${r.requiredReach.toFixed(1)}<span class="rmet-unit">ft</span></div></div>
                <div class="rmet"><div class="rmet-lbl">Sway</div><div class="rmet-val">${r.windSwayFt.toFixed(1)}<span class="rmet-unit">ft</span></div></div>
                <div class="rmet"><div class="rmet-lbl" style="font-size:7px;line-height:1.1">${r.clear ? 'Ft Over Req\'d Clr' : 'Ft to Contact'}</div><div class="rmet-val" style="color:${r.clear ? 'var(--success)' : (r.margin >= 0 ? 'var(--warn)' : 'var(--danger)')}">${r.margin >= 0 ? '+' : ''}${r.margin.toFixed(1)}<span class="rmet-unit">ft</span></div></div>
              </div>
            </div>`;
            }).join('');

            document.getElementById('result').classList.add('show');
            const ra = document.getElementById('result-actions');
            if (ra) ra.style.display = 'flex';
            document.getElementById('vs-elev').textContent = (vd >= 0 ? '+' : '') + vd + 'ft';
            document.getElementById('vs-wires').textContent = results.length;
            const vm = document.getElementById('vs-margin');
            vm.textContent = (worstMargin >= 0 ? '+' : '') + worstMargin.toFixed(1) + 'ft';
            vm.style.color = overallClear ? 'var(--success)' : (overallWarn ? 'var(--warn)' : 'var(--danger)');
            document.getElementById('viz-stats').style.display = 'flex';
            updateVizLegend(lastResult);
            document.getElementById('viz-legend').style.display = 'flex';
            document.getElementById('viz-empty').style.display = 'none';
            const badge = document.getElementById('viz-badge');
            badge.textContent = overallClear ? '✓ CLEAR' : (overallWarn ? '⚠ MARGINAL' : '✕ STRIKE');
            badge.style.background = overallClear ? 'rgba(46,204,113,.12)' : (overallWarn ? 'rgba(255,159,28,.12)' : 'rgba(255,71,87,.12)');
            badge.style.color = overallClear ? 'var(--success)' : (overallWarn ? 'var(--warn)' : 'var(--danger)');
            badge.style.borderColor = overallClear ? 'rgba(46,204,113,.25)' : (overallWarn ? 'rgba(255,159,28,.25)' : 'rgba(255,71,87,.25)');

            if (typeof setVizSource === 'function') {
                setVizSource('calc');
            } else {
                if (vizMode === 'iso') requestAnimationFrame(() => drawIso(lastResult));
                else requestAnimationFrame(() => drawViz(lastResult));
            }

            const ts = new Date();
            logEntries.unshift({
                hd,
                vd,
                th,
                t,
                lean,
                species,
                windMode,
                windPeakMph,
                windEnabled,
                wires: results.length,
                wireData: wireData.map(w => ({ ...w })),
                worstMargin,
                worstVsReq,
                overallClear,
                overallWarn,
                ts
            });
            updateLog();
            // Debug toast
            (function() {
                var t = document.createElement('div');
                t.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#000;padding:6px 14px;border-radius:20px;font-size:12px;font-family:monospace;z-index:99999;pointer-events:none';
                t.textContent = 'LOG SAVED — ' + logEntries.length + ' entries';
                document.body.appendChild(t);
                setTimeout(function(){ t.remove(); }, 3000);
            })();
        }

        function resetForm() {
            document.getElementById('hd').value = 100;
            document.getElementById('vd').value = 0;
            document.getElementById('th').value = 75;

            document.getElementById('lean-angle').value = 0;
            updateLean(0);

            document.getElementById('span-pos').value = 0.5;
            updateSpanPos(0.5);

            document.getElementById('wind-mode').value = 'sierra';
            document.getElementById('wind-peak-mph').value = WIND_SWAY_DEFAULT_MPH;

            clearValidation('calc-validation');
            document.getElementById('result').classList.remove('show');
            document.getElementById('species-select').value = '';
            document.getElementById('custom-species-hint').style.display = 'none';
            const windNote = document.getElementById('wind-applied-note');
            if (windNote) windNote.style.display = 'none';

            wires = [
                { name: 'Primary', ht: 30, sag: 0, minClr: 5, type: 'ACSR', alphaPpm: 10.4, color: '#3b8bff' },
                { name: 'Secondary', ht: 25, sag: 0, minClr: 5, type: 'AAAC', alphaPpm: 12.8, color: '#e8ff47' },
                { name: 'Comm Neutral', ht: 20, sag: 0, minClr: 5, type: 'AAC', alphaPpm: 13.0, color: '#2ecc71' },
            ];
            renderWireList();
        }

        // ── RELOAD FROM LOG ──
        function reloadEntry(idx) {
            const e = logEntries[idx];
            if (!e) return;
            document.getElementById('hd').value = e.hd;
            document.getElementById('vd').value = e.vd;
            document.getElementById('th').value = e.th;
            document.getElementById('span-pos').value = e.t || 0.5;
            updateSpanPos(e.t || 0.5);
            const leanVal = e.lean || 0;
            document.getElementById('lean-angle').value = leanVal;
            updateLean(leanVal);
            if (e.species) document.getElementById('species-select').value = e.species;
            document.getElementById('wind-mode').value = e.windMode || 'sierra';
            document.getElementById('wind-peak-mph').value = Number.isFinite(Number(e.windPeakMph)) ? Number(e.windPeakMph) : WIND_SWAY_DEFAULT_MPH;
            if (e.wireData && e.wireData.length) {
                wires = e.wireData.map(w => ({ ...w }));
                renderWireList();
            }
            document.querySelectorAll('.tab').forEach((tab, i) => tab.classList.toggle('active', i === 0));
            document.querySelectorAll('.pane').forEach((p, i) => p.classList.toggle('active', i === 0));
            clearValidation('calc-validation');
            document.getElementById('result').classList.remove('show');
            document.getElementById('pane-calc').scrollTop = 0;
        }














