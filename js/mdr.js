// ── MDR FORECAST ──
let lastMdrPlot = null;

let mdrTheta = -0.55;
let mdrPhi = 0.55;
let mdrZoom = 1.0;
let mdrPanX = 0;   // world-space pan offset X
let mdrPanZ = 0;   // world-space pan offset Z (depth axis)
let mdrDragging = false;
let mdrLastX = 0;
let mdrLastY = 0;

function resetMdrView() {
    mdrTheta = -0.55;
    mdrPhi = 0.55;
    mdrZoom = 1.0;
    mdrPanX = 0;
    mdrPanZ = 0;
}


function formatYears(v) {
    if (!Number.isFinite(v)) return '—';
    if (v <= 0) return '0.0';
    return v.toFixed(1);
}

function syncMdrFromSagWind() {
    const sagCurrentEl = document.getElementById('mdr-sag-current');
    const sagExtraEl = document.getElementById('mdr-sag-extra');
    const sagTotalEl = document.getElementById('mdr-sag-total');
    const swayEl = document.getElementById('mdr-sway');
    if (!sagCurrentEl || !sagExtraEl || !sagTotalEl || !swayEl) return;

    let sagCurrent = parseFloat(document.getElementById('sag-measured')?.value);
    if (!Number.isFinite(sagCurrent) && typeof lastSag !== 'undefined' && lastSag && Number.isFinite(Number(lastSag.sagNow))) {
        sagCurrent = Number(lastSag.sagNow);
    }
    if (!Number.isFinite(sagCurrent)) sagCurrent = 0;

    let sagWorst = parseFloat(document.getElementById('sag-val')?.textContent);
    if (!Number.isFinite(sagWorst) && typeof lastSag !== 'undefined' && lastSag && Number.isFinite(Number(lastSag.worstSagMax))) {
        sagWorst = Number(lastSag.worstSagMax);
    }
    if (!Number.isFinite(sagWorst)) sagWorst = sagCurrent;

    const extraSag = Math.max(0, sagWorst - sagCurrent);
    sagCurrentEl.value = extraSag > 0 ? sagCurrent.toFixed(2) : '0.00';
    sagExtraEl.value = extraSag.toFixed(2);
    sagTotalEl.value = sagWorst.toFixed(2);

    const windMode = document.getElementById('wind-mode')?.value || 'off';
    const windPeakMph = parseFloat(document.getElementById('wind-peak-mph')?.value);
    if (windMode === 'off' || !Number.isFinite(windPeakMph) || windPeakMph <= 0 || sagWorst <= 0) {
        swayEl.value = '0.0';
    } else {
        const windScale = Math.pow(windPeakMph / WIND_SWAY_REF_MPH, 2);
        const maxBlowoutK = (Array.isArray(wires) && wires.length)
            ? Math.max(...wires.map(w => blowoutFactorForType(w.type || DEFAULT_CONDUCTOR)))
            : BLOWOUT_K_BY_TYPE.CUSTOM;
        const swayFt = Math.max(0, sagWorst * maxBlowoutK * windScale * WIND_SWAY_SAFETY_FACTOR);
        swayEl.value = swayFt.toFixed(2);
    }
}

function initMdr3DEvents() {
    const canvas = document.getElementById('mdrCanvas');
    if (!canvas || canvas._mdr3dInit) return;
    canvas._mdr3dInit = true;
    canvas.style.cursor = 'grab';

    // ── MOUSE (desktop): left-drag = rotate, wheel = zoom ──
    canvas.addEventListener('mousedown', e => {
        mdrDragging = true;
        mdrLastX = e.clientX;
        mdrLastY = e.clientY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
        if (!mdrDragging) return;
        const dx = e.clientX - mdrLastX;
        const dy = e.clientY - mdrLastY;
        mdrLastX = e.clientX;
        mdrLastY = e.clientY;
        mdrTheta -= dx * 0.009;
        mdrPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, mdrPhi - dy * 0.007));
        if (lastMdrPlot) drawMdrCanvas(lastMdrPlot);
    });

    window.addEventListener('mouseup', () => {
        mdrDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', e => {
        mdrZoom = Math.max(0.5, Math.min(5, mdrZoom * (e.deltaY > 0 ? 0.92 : 1.08)));
        if (lastMdrPlot) drawMdrCanvas(lastMdrPlot);
        e.preventDefault();
    }, { passive: false });

    // ── TOUCH (mobile): Google Maps scheme ──
    // 1 finger drag  → pan
    // 2 finger drag (same direction) → rotate/orbit
    // 2 finger pinch/spread → zoom
    let lastPinchDist = null;
    let lastMidX = 0;
    let lastMidY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchJustSwitched = false;

    // Pan speed scales with scene size so it feels consistent at all zoom levels
    function panSpeed() {
        if (!lastMdrPlot) return 0.15;
        const hd = lastMdrPlot.hd || 10;
        const span = Math.max(80, hd * 3, 120);
        return span / (600 * mdrZoom);
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
            lastMidX = (t0.clientX + t1.clientX) / 2;
            lastMidY = (t0.clientY + t1.clientY) / 2;
            touchJustSwitched = true;
        }
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 1) {
            if (!touchJustSwitched) {
                const dx = e.touches[0].clientX - lastTouchX;
                const dy = e.touches[0].clientY - lastTouchY;
                // Pan in the camera's ground-plane right and forward directions
                const sp = panSpeed();
                // Right vector in world XZ from current theta
                const rightX = Math.cos(mdrTheta);
                const rightZ = -Math.sin(mdrTheta);
                // Forward vector in world XZ (perpendicular to right, flat)
                const fwdX = Math.sin(mdrTheta);
                const fwdZ = Math.cos(mdrTheta);
                mdrPanX -= dx * sp * rightX - dy * sp * fwdX;
                mdrPanZ -= dx * sp * rightZ - dy * sp * fwdZ;
                if (lastMdrPlot) drawMdrCanvas(lastMdrPlot);
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
                const midDX = midX - lastMidX;
                const midDY = midY - lastMidY;
                const midMove = Math.sqrt(midDX * midDX + midDY * midDY);

                if (distDelta > midMove * 0.4) {
                    // Pinch dominates → zoom
                    mdrZoom = Math.max(0.5, Math.min(5, mdrZoom * (dist / lastPinchDist)));
                } else {
                    // Midpoint movement dominates → rotate/orbit
                    mdrTheta -= midDX * 0.012;
                    mdrPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, mdrPhi - midDY * 0.009));
                }
                if (lastMdrPlot) drawMdrCanvas(lastMdrPlot);
            }

            lastPinchDist = dist;
            lastMidX = midX;
            lastMidY = midY;
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
}

function drawMdrCanvas(plot) {
    const canvas = document.getElementById('mdrCanvas');
    if (!canvas || !plot) return;
    initMdr3DEvents();

    const rawW = canvas.parentElement.clientWidth || canvas.parentElement.offsetWidth || window.innerWidth;
    const cssW = rawW > 0 ? rawW : window.innerWidth;
    const cssH = Math.round(cssW * 0.62);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const W = cssW;
    const H = cssH;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W * 0.45, H * 0.35, 0, W * 0.5, H * 0.5, W * 0.9);
    bg.addColorStop(0, '#0f1520');
    bg.addColorStop(1, '#080c10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const hd = plot.hd;
    const vd = plot.vd;
    const t = plot.t;
    const baseRadial = plot.baseRadial;
    const worstRadial = plot.worstRadial;

    const span = Math.max(80, hd * 3, 120);
    const lineZ = t * span;
    const poleTop = 0;
    const poleBottom = -Math.max(12, Math.abs(vd) + 8, baseRadial * 0.7);
    const maxDim = Math.max(20, span * 0.9, Math.abs(vd) * 1.4, baseRadial * 1.4);

    const cx3 = hd * 0.3 + mdrPanX;
    const cy3 = 0;
    const cz3 = lineZ + mdrPanZ;
    const camDist = maxDim * 1.8 / mdrZoom;

    const camX = cx3 + camDist * Math.cos(mdrPhi) * Math.sin(mdrTheta);
    const camY = cy3 + camDist * Math.sin(mdrPhi);
    const camZ = cz3 + camDist * Math.cos(mdrPhi) * Math.cos(mdrTheta);

    let fx = cx3 - camX;
    let fy = cy3 - camY;
    let fz = cz3 - camZ;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;

    let rx = fy * 0 - fz * 1;
    let ry = fz * 0 - fx * 0;
    let rz = fx * 1 - fy * 0;
    const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;

    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    const focal = Math.min(W, H) * 0.76;

    function proj(wx, wy, wz) {
        const dx = wx - camX;
        const dy = wy - camY;
        const dz = wz - camZ;
        const vx = dx * rx + dy * ry + dz * rz;
        const vy = dx * ux + dy * uy + dz * uz;
        const vz = dx * fx + dy * fy + dz * fz;
        const vzSafe = Math.max(vz, 0.08);
        return {
            sx: W * 0.5 + (focal * vx) / vzSafe,
            sy: H * 0.57 - (focal * vy) / vzSafe,
        };
    }

    function drawLine(a, b, color, width, dash = null) {
        const p1 = proj(a.x, a.y, a.z);
        const p2 = proj(b.x, b.y, b.z);
        if (!p1 || !p2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawDot(wp, color, r = 4) {
        const p = proj(wp.x, wp.y, wp.z);
        if (!p) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const poleA0 = { x: 0, y: poleBottom, z: 0 };
    const poleA1 = { x: 0, y: poleTop, z: 0 };
    const poleB0 = { x: 0, y: poleBottom, z: span };
    const poleB1 = { x: 0, y: poleTop, z: span };

    const sagCurrent = Math.max(0, plot.sagCurrent || 0);
    const sagExtra = Math.max(0, plot.sagExtra || 0);
    const sagWorst = sagCurrent + sagExtra;
    const swayVisual = Math.max(0, plot.swayVisual || 0);
    const sagAt = (sagVal, u) => -sagVal * 4 * u * (1 - u);

    const linePoint = { x: 0, y: sagAt(sagCurrent, t), z: lineZ };
    const linePointWorst = { x: 0, y: sagAt(sagWorst, t), z: lineZ };
    const treePoint = { x: hd, y: linePoint.y + vd, z: lineZ };

    function drawSagWire(sagVal, color, width, dash = null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 64; i++) {
            const u = i / 64;
            const wz = u * span;
            const wy = sagAt(sagVal, u);
            const p3 = proj(0, wy, wz);
            if (!p3) continue;
            if (!started) {
                ctx.moveTo(p3.sx, p3.sy);
                started = true;
            } else {
                ctx.lineTo(p3.sx, p3.sy);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawSwayArc() {
        if (swayVisual <= 0.01) return;
        // Arc from worst-sag point up toward top-of-pole plane (y = poleTop), in transverse plane.
        const c = linePointWorst;
        const yTop = poleTop;
        ctx.strokeStyle = 'rgba(255,159,28,0.95)';
        ctx.lineWidth = 2.1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 96; i++) {
            const u = -1 + (2 * i) / 96; // -1..1
            const px = c.x + swayVisual * u;
            const py = c.y + (yTop - c.y) * (u * u); // lowest at center, rises to pole-top plane at edges
            const pz = c.z;
            const p3 = proj(px, py, pz);
            if (!p3) continue;
            if (!started) { ctx.moveTo(p3.sx, p3.sy); started = true; }
            else { ctx.lineTo(p3.sx, p3.sy); }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const left = { x: c.x - swayVisual, y: yTop, z: c.z };
        const right = { x: c.x + swayVisual, y: yTop, z: c.z };
        drawDot(left, '#ff9f1c', 3);
        drawDot(right, '#ff9f1c', 3);
    }

    drawLine(poleA0, poleA1, '#3b8bff', 3);
    drawLine(poleB0, poleB1, '#3b8bff', 3);
    drawSagWire(sagCurrent, 'rgba(59,139,255,0.95)', 2.2, null);
    if (sagExtra > 0.001) drawSagWire(sagWorst, 'rgba(255,159,28,0.92)', 2.2, [6, 4]);
    drawSwayArc();

    drawLine(linePoint, treePoint, 'rgba(59,139,255,0.85)', 2, [6, 5]);

    drawDot(linePoint, '#3b8bff', 4);
    drawDot(linePointWorst, '#ff9f1c', 4);
    drawDot(treePoint, '#e8ff47', 4);

    const lp = proj(linePoint.x, linePoint.y, linePoint.z);
    const lwp = proj(linePointWorst.x, linePointWorst.y, linePointWorst.z);
    const tp = proj(treePoint.x, treePoint.y, treePoint.z);

    ctx.font = '9px JetBrains Mono,monospace';
    ctx.textAlign = 'left';
    if (lp) {
        ctx.fillStyle = 'rgba(143,170,200,0.9)';
        ctx.fillText('Line point (current)', lp.sx + 8, lp.sy - 8);
    }
    if (lwp && sagExtra > 0.001) {
        ctx.fillStyle = 'rgba(255,159,28,0.95)';
        ctx.fillText('Line point (worst sag)', lwp.sx + 8, lwp.sy - 8);
    }
    if (tp) {
        ctx.fillStyle = 'rgba(232,255,71,0.95)';
        ctx.fillText('Tree point', tp.sx + 8, tp.sy - 8);
    }
    if (swayVisual > 0.01 && lp) {
        ctx.fillStyle = 'rgba(255,159,28,0.95)';
        ctx.fillText('Local wind sway envelope (at t)', lp.sx + 8, lp.sy + 12);
    }

    ctx.fillStyle = 'rgba(143,170,200,0.85)';
    ctx.font = '8px JetBrains Mono,monospace';
    ctx.fillText(`Base ${baseRadial.toFixed(1)}ft`, 16, H - 20);
    ctx.fillStyle = 'rgba(255,71,87,0.92)';
    ctx.fillText(`Worst ${worstRadial.toFixed(1)}ft`, 16, H - 8);
    ctx.fillStyle = 'rgba(143,170,200,0.85)';
    ctx.fillText(`Span pos t=${t.toFixed(1)}`, 118, H - 8);
}

function runMdrForecast() {
    clearValidation('mdr-validation');
    syncMdrFromSagWind();

    const hdRaw = parseFloat(document.getElementById('mdr-hd').value);
    const vdRaw = parseFloat(document.getElementById('mdr-vd').value);
    const tRaw = parseFloat(document.getElementById('mdr-span-pos').value);
    const vdDirRaw = document.getElementById('mdr-vd-dir')?.value || 'below';
    const sagCurrentRaw = parseFloat(document.getElementById('mdr-sag-current').value);
    const sagExtraRaw = parseFloat(document.getElementById('mdr-sag-extra').value);
    const swayRaw = parseFloat(document.getElementById('mdr-sway').value);
    const growthRaw = parseFloat(document.getElementById('mdr-growth').value);
    const thresholdRaw = parseFloat(document.getElementById('mdr-threshold').value);
    const currentRaw = parseFloat(document.getElementById('mdr-current').value);
    const basis = document.getElementById('mdr-basis').value || 'geometry';

    const msgs = [];
    const bad = [];

    if (!Number.isFinite(hdRaw) || hdRaw < 0) { msgs.push('Horizontal distance must be 0 ft or greater.'); bad.push('mdr-hd'); }
    if (!Number.isFinite(vdRaw)) { msgs.push('Vertical distance must be a valid number.'); bad.push('mdr-vd'); }
    if (!Number.isFinite(tRaw) || tRaw < 0.1 || tRaw > 0.9) { msgs.push('Position in span must be between 0.1 and 0.9.'); bad.push('mdr-span-pos'); }
    if (!Number.isFinite(sagCurrentRaw) || sagCurrentRaw < 0) { msgs.push('Line sag constant must be 0 ft or greater.'); bad.push('mdr-sag-current'); }
    if (!Number.isFinite(sagExtraRaw) || sagExtraRaw < 0) { msgs.push('Expected extra sag must be 0 ft or greater.'); bad.push('mdr-sag-extra'); }
    if (!Number.isFinite(swayRaw) || swayRaw < 0) { msgs.push('Wind sway must be 0 ft or greater.'); bad.push('mdr-sway'); }
    if (!Number.isFinite(growthRaw) || growthRaw <= 0) { msgs.push('Annual growth toward line must be greater than 0 ft/yr.'); bad.push('mdr-growth'); }
    if (!Number.isFinite(thresholdRaw) || thresholdRaw < 0) { msgs.push('MDR threshold must be 0 ft or greater.'); bad.push('mdr-threshold'); }
    if (basis === 'current' && (!Number.isFinite(currentRaw) || currentRaw < 0)) { msgs.push('Current MDR is required for Current MDR basis.'); bad.push('mdr-current'); }

    if (msgs.length) {
        showValidation('mdr-validation', msgs, bad);
        return;
    }

    const hd = Math.max(0, hdRaw);
    const vdMag = Math.abs(vdRaw);
    const vd = vdDirRaw === 'above' ? vdMag : -vdMag;
    const t = tRaw;
    const sagCurrent = Math.max(0, sagCurrentRaw);
    const sagExtra = Math.max(0, sagExtraRaw);
    const sagWorst = sagCurrent + sagExtra;
    const sway = Math.max(0, swayRaw);
    const swayVisual = sway;
    const growth = growthRaw;
    const threshold = Math.max(0, thresholdRaw);
    const currentMdr = Number.isFinite(currentRaw) ? Math.max(0, currentRaw) : null;

    const baseRadial = Math.hypot(hd, vd);
    const horizontalDist = hd;
    const verticalDist = vd;

    // Worst-case clearance from the same arc model used in 3D: arc centered at worst-sag point,
    // rising to pole-top plane at the sweep edges.
    let radialClearance = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 200; i++) {
        const u = -1 + (2 * i) / 200;
        const lineX = sway * u;
        const lineY = -sagExtra + sagExtra * (u * u);
        const d = Math.hypot(hd - lineX, vd - lineY);
        if (d < radialClearance) radialClearance = d;
    }
    if (!Number.isFinite(radialClearance)) radialClearance = baseRadial;

    const remainingToThreshold = radialClearance - threshold;

    let usedMdr = remainingToThreshold;
    let usedLabel = 'Geometry';
    if (basis === 'current') {
        usedMdr = currentMdr;
        usedLabel = 'Current MDR';
    }

    const yearsToBreach = usedMdr <= 0 ? 0 : usedMdr / growth;
    const yearsToStrike = radialClearance <= 0 ? 0 : radialClearance / growth;

    const yearsEl = document.getElementById('mdr-years');
    yearsEl.textContent = formatYears(yearsToBreach);
    yearsEl.style.color = yearsToBreach <= 1 ? 'var(--danger)' : (yearsToBreach <= 3 ? 'var(--warn)' : 'var(--accent)');

    document.getElementById('mdr-sub').textContent = `${usedLabel} basis • base ${baseRadial.toFixed(1)}ft -> worst ${radialClearance.toFixed(1)}ft`;
    document.getElementById('mdr-base-radial').innerHTML = `${baseRadial.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-eff-hd').innerHTML = `${horizontalDist.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-eff-vd').innerHTML = `${verticalDist.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-hyp').innerHTML = `${radialClearance.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-used').innerHTML = `${usedMdr.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-strike').innerHTML = `${formatYears(yearsToStrike)}<span class="smet-unit"> yr</span>`;
    document.getElementById('mdr-sag-used').innerHTML = `${sagExtra.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-sway-used').innerHTML = `${sway.toFixed(1)}<span class="smet-unit"> ft</span>`;
    document.getElementById('mdr-basis-used').innerHTML = `${usedLabel}`;
    document.getElementById('mdr-sag-total').value = sagWorst.toFixed(2);

    lastMdrPlot = {
        hd,
        vd,
        t,
        sagCurrent,
        sagExtra,
        swayVisual,
        baseRadial,
        worstRadial: radialClearance,
    };

    document.getElementById('mdr-result').style.display = 'block';
    if (typeof resetMdrView === 'function') resetMdrView();
    if (typeof setVizSource === 'function') setVizSource('mdr');
    drawMdrCanvas(lastMdrPlot);
}

function resetMdrForecast() {
    clearValidation('mdr-validation');
    document.getElementById('mdr-hd').value = 8;
    document.getElementById('mdr-vd').value = 7;
    document.getElementById('mdr-vd-dir').value = 'below';
    document.getElementById('mdr-span-pos').value = 0.5;
    document.getElementById('mdr-sag-current').value = 0;
    document.getElementById('mdr-sag-extra').value = 0;
    document.getElementById('mdr-sway').value = 0;
    document.getElementById('mdr-sag-total').value = 0;
    document.getElementById('mdr-growth').value = 2;
    document.getElementById('mdr-threshold').value = 5;
    document.getElementById('mdr-current').value = '';
    document.getElementById('mdr-basis').value = 'geometry';
    document.getElementById('mdr-result').style.display = 'none';
    lastMdrPlot = null;
}

window.addEventListener('resize', () => {
    if (lastMdrPlot) drawMdrCanvas(lastMdrPlot);
});

















