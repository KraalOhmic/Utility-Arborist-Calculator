        // ── TABS ──
        function switchTab(name, btn) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('pane-' + name).classList.add('active');

            if (name === 'viz' && typeof renderActiveDiagram === 'function') {
                // Double rAF ensures pane has real dimensions before drawing
                requestAnimationFrame(() => requestAnimationFrame(() => renderActiveDiagram()));
            }
            if (name === 'mdr' && typeof syncMdrFromSagWind === 'function') {
                // Small delay so pane is fully visible before MDR syncs
                requestAnimationFrame(() => requestAnimationFrame(() => syncMdrFromSagWind()));
            }
        }
