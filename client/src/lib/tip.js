/* RGS chart tooltips: any element with data-tip='{"t":"Title","r":[["Label","Value","#color"]]}' */
(function () {
    'use strict';
    var tip = null;
    function el() {
        if (!tip) { tip = document.createElement('div'); tip.className = 'rgs-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
        return tip;
    }
    function fill(target) {
        var d; try { d = JSON.parse(target.getAttribute('data-tip')); } catch (e) { return false; }
        var t = el(); t.textContent = '';
        if (d.t) { var h = document.createElement('div'); h.className = 't-title'; h.textContent = d.t; t.appendChild(h); }
        (d.r || []).forEach(function (row) {
            var r = document.createElement('div'); r.className = 't-row';
            if (row[2]) { var k = document.createElement('span'); k.className = 't-key'; k.style.background = row[2]; r.appendChild(k); }
            var b = document.createElement('b'); b.textContent = row[1]; r.appendChild(b);
            var s = document.createElement('span'); s.textContent = row[0]; s.style.color = '#cbd5e1'; r.appendChild(s);
            t.appendChild(r);
        });
        return true;
    }
    function place(x, y) {
        var t = el(), w = t.offsetWidth, h = t.offsetHeight;
        var left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
        var top = y - h - 12; if (top < 8) top = y + 16;
        t.style.left = left + 'px'; t.style.top = top + 'px';
    }
    document.addEventListener('pointermove', function (e) {
        var target = e.target.closest && e.target.closest('[data-tip]');
        if (!target) { if (tip) tip.classList.remove('show'); return; }
        if (tip && tip._for !== target) { fill(target); tip._for = target; } else if (!tip) { fill(target); tip._for = target; }
        el().classList.add('show'); place(e.clientX, e.clientY);
    });
    document.addEventListener('focusin', function (e) {
        var target = e.target.closest && e.target.closest('[data-tip]'); if (!target) return;
        if (fill(target)) { tip._for = target; var r = target.getBoundingClientRect(); el().classList.add('show'); place(r.left + r.width / 2, r.top); }
    });
    document.addEventListener('focusout', function () { if (tip) tip.classList.remove('show'); });
    document.addEventListener('scroll', function () { if (tip) tip.classList.remove('show'); }, true);
})();
