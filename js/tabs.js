        // ── TABS ──
        function switchTab(name, btn) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('pane-' + name).classList.add('active');

            if (name === 'viz' && typeof renderActiveDiagram === 'function') {
                requestAnimationFrame(() => renderActiveDiagram());
            }
            if (name === 'mdr' && typeof syncMdrFromSagWind === 'function') {
                syncMdrFromSagWind();
            }
        }
