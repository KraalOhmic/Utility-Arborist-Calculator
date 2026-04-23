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
            <div class="wire-row-field"><label>Height ft</label><input type="number" id="w-ht-${i}" value="${w.ht}" inputmode="decimal"></div>
            ${/neutral/i.test(String(w.name || '')) ? '' : `<div class="wire-row-field"><label>Sag ft</label><input type="number" id="w-sag-${i}" value="${w.sag}" inputmode="decimal"></div>`}
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

