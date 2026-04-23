        // ── SPECIES ──
        function onSpeciesChange(sel) {
            const hint = document.getElementById('custom-species-hint');
            hint.style.display = customSpecies.includes(sel.value) ? 'inline' : 'none';
        }

        function addCustomSpecies() {
            const name = prompt('Enter species name:');
            if (!name || !name.trim()) return;
            const trimmed = name.trim();
            if (customSpecies.includes(trimmed)) {
                document.getElementById('species-select').value = trimmed;
                return;
            }
            customSpecies.push(trimmed);
            const grp = document.getElementById('custom-species-group');
            const opt = document.createElement('option');
            opt.value = trimmed; opt.textContent = trimmed;
            grp.appendChild(opt);
            document.getElementById('species-select').value = trimmed;
            document.getElementById('custom-species-hint').style.display = 'inline';
        }

