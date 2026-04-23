
        const WIRE_COLORS = ['#3b8bff', '#e8ff47', '#2ecc71', '#ff9f1c', '#bf6fff', '#ff6b9d'];
        const WIRE_COLOR_OPTIONS = ['#3b8bff', '#e8ff47', '#2ecc71', '#ff9f1c', '#bf6fff', '#ff6b9d', '#ff4757', '#60a0ff', '#ffffff', '#8faac8'];
        const WIRE_NAMES = ['Primary', 'Secondary', 'Neutral'];
        const DEFAULT_MIN_CLEARANCE_FT = 5;
        const CONDUCTOR_PRESETS = [
            { id: 'ACSR', label: 'ACSR', alphaPpm: 10.4 },
            { id: 'AAAC', label: 'AAAC', alphaPpm: 12.8 },
            { id: 'AAC', label: 'AAC', alphaPpm: 13.0 },
            { id: 'CU', label: 'Copper', alphaPpm: 9.4 },
            { id: 'STEEL', label: 'Steel', alphaPpm: 6.5 },
            { id: 'CUSTOM', label: 'Custom', alphaPpm: 12.0 },
        ];
        const DEFAULT_CONDUCTOR = 'ACSR';
        const DEFAULT_ALPHA_PPM = 10.4;

        const WIND_SWAY_REF_MPH = 40;
        const WIND_SWAY_DEFAULT_MPH = 40;
        const WIND_SWAY_SAFETY_FACTOR = 1.2;
        const BLOWOUT_K_BY_TYPE = {
            ACSR: 0.72,
            AAAC: 0.78,
            AAC: 0.82,
            CU: 0.7,
            STEEL: 0.55,
            CUSTOM: 0.75,
        };

        let wires = [
            { name: 'Primary', ht: 30, sag: 0, minClr: 5, type: 'ACSR', alphaPpm: 10.4, color: '#3b8bff' },
            { name: 'Secondary', ht: 25, sag: 0, minClr: 5, type: 'AAAC', alphaPpm: 12.8, color: '#e8ff47' },
            { name: 'Neutral', ht: 20, sag: 0, minClr: 5, type: 'AAC', alphaPpm: 13.0, color: '#2ecc71' },
        ];
        let lastResult = null, lastSag = null, logEntries = [];
        let customSpecies = [];

        function escHtml(s) {
            return String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function clampNonNegative(n, fallback = 0) {
            const v = Number(n);
            return Number.isFinite(v) ? Math.max(0, v) : fallback;
        }

        function normalizeHexColor(c, fallback = '#3b8bff') {
            const v = String(c || '').trim();
            return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
        }

        function conductorPresetById(id) {
            return CONDUCTOR_PRESETS.find(p => p.id === id) || CONDUCTOR_PRESETS.find(p => p.id === DEFAULT_CONDUCTOR);
        }

        function normalizeAlphaPpm(alphaPpm, fallback = DEFAULT_ALPHA_PPM) {
            const v = Number(alphaPpm);
            return Number.isFinite(v) && v > 0 ? v : fallback;
        }

        function blowoutFactorForType(typeId) {
            return clampNonNegative(BLOWOUT_K_BY_TYPE[typeId] ?? BLOWOUT_K_BY_TYPE.CUSTOM, BLOWOUT_K_BY_TYPE.CUSTOM);
        }

        function onWireTypeChange(i) {
            const typeEl = document.getElementById('w-type-' + i);
            if (!typeEl) return;
            const preset = conductorPresetById(typeEl.value);
            if (wires[i]) {
                wires[i].type = typeEl.value;
                wires[i].alphaPpm = normalizeAlphaPpm(preset?.alphaPpm, DEFAULT_ALPHA_PPM);
            }
        }



        const validationFieldMap = {};

        function clearValidation(containerId) {
            const prev = validationFieldMap[containerId] || [];
            prev.forEach(id => document.getElementById(id)?.classList.remove('input-invalid'));
            validationFieldMap[containerId] = [];
            const box = document.getElementById(containerId);
            if (!box) return;
            box.style.display = 'none';
            box.innerHTML = '';
        }

        function showValidation(containerId, messages, fieldIds = []) {
            clearValidation(containerId);
            const uniqFields = [...new Set((fieldIds || []).filter(Boolean))];
            uniqFields.forEach(id => document.getElementById(id)?.classList.add('input-invalid'));
            validationFieldMap[containerId] = uniqFields;

            const uniqMessages = [...new Set((messages || []).filter(Boolean))];
            if (!uniqMessages.length) return;

            const box = document.getElementById(containerId);
            if (!box) return;
            box.innerHTML = `
                <div class="validation-title">Input check needed</div>
                <ul class="validation-list">
                    ${uniqMessages.map(m => `<li>${escHtml(m)}</li>`).join('')}
                </ul>
            `;
            box.style.display = 'block';
        }
