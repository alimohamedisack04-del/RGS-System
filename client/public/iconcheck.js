/* Hide icon boxes if the Bootstrap Icons font cannot be downloaded (blocked network / preview). */
(function () {
    'use strict';
    var root = document.documentElement;
    function fail() { root.classList.add('no-icons'); }
    if (!document.fonts || !document.fonts.ready) return;
    document.fonts.ready.then(function () {
        var faces = [];
        document.fonts.forEach(function (f) { if (/bootstrap-icons/i.test(f.family)) faces.push(f); });
        if (!faces.length) { fail(); return; }
        Promise.all(faces.map(function (f) { return f.load().then(function () { return f.status === 'loaded'; }, function () { return false; }); }))
            .then(function (res) { if (res.indexOf(true) === -1) fail(); });
    });
})();
