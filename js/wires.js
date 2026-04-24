        // ── WIRE LIST ──
        function renderWireList() {
            document.getElementById('wire-list').innerHTML = wires.map((w, i) => `
        <div class="wire-row">
          <div class="wire-color-wrap">
            <button class="wire-color-dot" title="Change wire color" onclick="toggleWireColorMenu(${i}, event)" style="background:${normalizeHexColor(w.color)};box-shadow:0 0 6px ${normalizeHexColor(w.color)}66"></button>
            <div class="wire-color-menu" id="wire-color-menu-${i}" onclick="event.stopPropagation()">
              ${WIRE_COLOR_OPTIONS.map(c => `<button class="wire-color-swatch" title="${c}" style="background:${c}" onclick="setWireColor(${i}, '${c}')"></button>`).join('')}
            </div>
          </div>
          <div class="wire-row-fields">
            <div class="wire-row-field"><label>Name</label><input type="text" id="w-name-${i}" value="${escHtml(w.name)}"></div>
            <div class="wire-row-field"><label>Height ft</label><input type="number" id="w-ht-${i}" value="${w.ht}" inputmode="decimal" oninput="updateEffHt()"></div>
            ${/neutral/i.test(String(w.name || '')) ? '' : `<div class="wire-row-field"><label>Sag ft</label><input type="number" id="w-sag-${i}" value="${w.sag}" inputmode="decimal" oninput="updateEffHt()"></div>`}
            <div class="wire-row-field"><label style="color:var(--accent2)">@ Tree</label><div id="w-effht-${i}" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent2);padding:6px 2px;min-width:36px">—</div></div>
            <div class="wire-row-field"><label>Min Clr ft</label><input type="number" id="w-clr-${i}" value="${typeof w.minClr === 'number' ? w.minClr : DEFAULT_MIN_CLEARANCE_FT}" inputmode="decimal" min="0" step="0.1"></div>
            <div class="wire-row-field"><label>Type</label><select id="w-type-${i}" onchange="onWireTypeChange(${i})">${CONDUCTOR_PRESETS.map(p => `<option value="${p.id}" ${p.id === (w.type || DEFAULT_CONDUCTOR) ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
          </div>
          ${wires.length > 1 ? `<button class="wire-del" onclick="removeWire(${i})">×</button>` : ''}
        </div>`).join('');
            document.getElementById('wire-count-lbl').textContent = wires.length + ' wire' + (wires.length === 1 ? '' : 's');
        }

        function toggleWireColorMenu(i, e) {
            e.stopPropagation();
            const menu = document.getElementById('wire-color-menu-' + i);
            if (!menu) return;
            const willOpen = !menu.classList.contains('show');
            document.querySelectorAll('.wire-color-menu.show').forEach(m => m.classList.remove('show'));
            if (willOpen) menu.classList.add('show');
        }

        function setWireColor(i, color) {
            const wire = wires[i];
            if (!wire) return;
            wire.color = normalizeHexColor(color, wire.color);
            document.querySelectorAll('.wire-color-menu.show').forEach(m => m.classList.remove('show'));
            renderWireList();

            if (lastResult && lastResult.wires && lastResult.wires[i]) {
                lastResult.wires[i].color = wire.color;
                const resDots = document.querySelectorAll('#wire-results .res-dot');
                if (resDots[i]) {
                    resDots[i].style.background = wire.color;
                    resDots[i].style.boxShadow = `0 0 6px ${wire.color}88`;
                }
                updateVizLegend(lastResult);
                if (vizMode === 'iso') requestAnimationFrame(() => drawIso(lastResult));
                else requestAnimationFrame(() => drawViz(lastResult));
            }
        }

        function addWire() {
            const idx = wires.length % WIRE_COLORS.length;
            const preset = CONDUCTOR_PRESETS[idx % (CONDUCTOR_PRESETS.length - 1)] || conductorPresetById(DEFAULT_CONDUCTOR);
            wires.push({
                name: WIRE_NAMES[idx] || 'Wire ' + (wires.length + 1),
                ht: Math.max(10, (wires[wires.length - 1]?.ht || 20) - 5),
                sag: 0,
                minClr: DEFAULT_MIN_CLEARANCE_FT,
                type: preset.id,
                alphaPpm: preset.alphaPpm,
                color: WIRE_COLORS[idx]
            });
            renderWireList();
        }
        function removeWire(i) { wires.splice(i, 1); renderWireList(); }
        function checkNeg(el) { el.classList.toggle('neg', parseFloat(el.value) < 0); }

        // ── SPAN POSITION ──
        function updateSpanPos(v) {
            let n = parseFloat(v);
            if (isNaN(n)) n = 0.5;
            n = Math.max(0.1, Math.min(0.9, n));
            const input = document.getElementById('span-pos');
            if (input) input.value = n.toFixed(1);
            updateEffHt();
        }

        function updateLean(v) {
            v = parseFloat(v);
            document.getElementById('lean-val').textContent = v + '°';
            const lbl = document.getElementById('lean-label');
            if (v === 0) lbl.textContent = 'vertical';
            else if (v <= 5) lbl.textContent = 'slight';
            else if (v <= 15) lbl.textContent = 'moderate';
            else lbl.textContent = 'severe';
        }



        // ── EFFECTIVE HEIGHT DISPLAY ──
        function updateEffHt() {
            const t = parseFloat(document.getElementById('span-pos')?.value) || 0.5;
            const sagFactor = 4 * t * (1 - t);
            wires.forEach((w, i) => {
                const htEl = document.getElementById('w-ht-' + i);
                const sagEl = document.getElementById('w-sag-' + i);
                const effEl = document.getElementById('w-effht-' + i);
                if (!effEl) return;
                const ht = parseFloat(htEl?.value ?? w.ht);
                const sag = /neutral/i.test(String(w.name || '')) ? 0 : parseFloat(sagEl?.value ?? w.sag) || 0;
                const effHt = ht - sag * sagFactor;
                effEl.textContent = Number.isFinite(effHt) ? effHt.toFixed(1) + 'ft' : '—';
            });
        }

        // ── VD SLOPE HELPER ──
        let vdMode = 'direct';

        function switchVdMode(mode) {
            vdMode = mode;
            const direct = document.getElementById('vd-direct-inputs');
            const slope = document.getElementById('vd-slope-inputs');
            const tabD = document.getElementById('vd-tab-direct');
            const tabS = document.getElementById('vd-tab-slope');
            if (mode === 'direct') {
                direct.style.display = 'block';
                slope.style.display = 'none';
                tabD.style.background = 'var(--accent2)';
                tabD.style.color = '#000';
                tabS.style.background = 'transparent';
                tabS.style.color = 'var(--text2)';
            } else {
                direct.style.display = 'none';
                slope.style.display = 'block';
                tabS.style.background = 'var(--accent2)';
                tabS.style.color = '#000';
                tabD.style.background = 'transparent';
                tabD.style.color = 'var(--text2)';
                calcSlopeVd();
            }
        }

        function calcSlopeVd() {
            const hd = parseFloat(document.getElementById('vd-slope-hd').value);
            const angle = parseFloat(document.getElementById('vd-slope-angle').value);
            const result = document.getElementById('vd-slope-result');
            if (!Number.isFinite(hd) || !Number.isFinite(angle)) {
                result.textContent = '—';
                result.style.color = 'var(--text2)';
                return;
            }
            const vd = hd * Math.tan(angle * Math.PI / 180);
            const rounded = Math.round(vd * 10) / 10;
            result.textContent = (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + ' ft';
            result.style.color = rounded < 0 ? 'var(--warn)' : 'var(--accent2)';
        }

        function applySlopeVd() {
            const hd = parseFloat(document.getElementById('vd-slope-hd').value);
            const angle = parseFloat(document.getElementById('vd-slope-angle').value);
            if (!Number.isFinite(hd) || !Number.isFinite(angle)) return;
            const vd = Math.round(hd * Math.tan(angle * Math.PI / 180) * 10) / 10;
            // Switch to direct mode and fill the value
            switchVdMode('direct');
            const vdInput = document.getElementById('vd');
            if (vdInput) {
                vdInput.value = vd.toFixed(1);
                checkNeg(vdInput);
            }
        }

        // ── SAG PRESETS ──
        function applySagPreset(ft) {
            wires.forEach(w => {
                if (!/neutral/i.test(String(w.name || ''))) {
                    w.sag = ft;
                }
            });
            renderWireList();
            updateEffHt();
            // Highlight active preset button
            document.querySelectorAll('[onclick^="applySagPreset"]').forEach(btn => {
                const val = parseFloat(btn.getAttribute('onclick').match(/\d+/)?.[0]);
                btn.style.background = val === ft ? 'var(--accent2)' : '';
                btn.style.color = val === ft ? '#000' : '';
                btn.style.borderColor = val === ft ? 'var(--accent2)' : '';
            });
            // Clear custom highlight
            const customBtn = document.getElementById('sag-custom-btn');
            if (customBtn) {
                customBtn.style.background = '';
                customBtn.style.color = '';
                customBtn.style.borderColor = '';
            }
        }

        function toggleSagCustom() {
            const wrap = document.getElementById('sag-custom-wrap');
            if (!wrap) return;
            const open = wrap.style.display !== 'none';
            wrap.style.display = open ? 'none' : 'block';
            const btn = document.getElementById('sag-custom-btn');
            if (btn) {
                btn.style.background = open ? '' : 'rgba(59,139,255,.15)';
                btn.style.borderColor = open ? '' : 'rgba(59,139,255,.4)';
            }
            if (!open) document.getElementById('sag-custom-val')?.focus();
        }

        function applySagCustom() {
            const val = parseFloat(document.getElementById('sag-custom-val')?.value);
            if (!Number.isFinite(val) || val < 0) return;
            wires.forEach(w => {
                if (!/neutral/i.test(String(w.name || ''))) w.sag = val;
            });
            renderWireList();
            updateEffHt();
            // Highlight custom button, clear presets
            document.querySelectorAll('[onclick^="applySagPreset"]').forEach(btn => {
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
            });
            const customBtn = document.getElementById('sag-custom-btn');
            if (customBtn) {
                customBtn.style.background = 'var(--accent2)';
                customBtn.style.color = '#000';
                customBtn.style.borderColor = 'var(--accent2)';
            }
        }
