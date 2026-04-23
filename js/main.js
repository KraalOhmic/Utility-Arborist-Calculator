        renderWireList();
        if (typeof updateEffHt === 'function') updateEffHt();

        document.addEventListener('click', () => {
            document.querySelectorAll('.wire-color-menu.show').forEach(m => m.classList.remove('show'));
        });

        window.addEventListener('resize', () => {
            if (typeof renderActiveDiagram === 'function') {
                renderActiveDiagram();
            } else if (lastResult) {
                drawViz(lastResult);
                if (vizMode === 'iso') drawIso(lastResult);
            }
            if (lastSag) drawSagCanvas({
                sagNow: lastSag.sagNow,
                sagMax: lastSag.worstSagMax,
                span: lastSag.span,
                tNow: lastSag.tNow,
                tMax: lastSag.tMax
            });
            if (typeof lastMdrPlot !== 'undefined' && lastMdrPlot && typeof drawMdrCanvas === 'function') {
                drawMdrCanvas(lastMdrPlot);
            }
        });
