// lightbox.js — zoom com navegação infinita (setas, teclado, swipe) e legenda
// Uso: qualquer <img class="imgli|imgpro|imghist"> abre o zoom ao clicar.
// As imagens do mesmo grupo (.carousel, .gallery ou .home-thumbs) formam a sequência.
// A legenda vem de data-title (o carrossel preenche com o nome do arquivo).
(function () {
    'use strict';

    var SELECTOR = '.imgli, .imgpro, .imghist';
    var GROUPS   = '.carousel, .gallery, .home-thumbs';
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    // ── Monta o lightbox uma única vez (não precisa mais estar no HTML) ──
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Imagem ampliada');
    box.innerHTML =
        '<button type="button" class="lb-btn lb-close" aria-label="Fechar">&times;</button>' +
        '<button type="button" class="lb-btn lb-prev" aria-label="Imagem anterior">' + ICON_PREV + '</button>' +
        '<figure class="lb-figure"><img class="lb-img" alt=""><figcaption class="lb-caption"></figcaption></figure>' +
        '<button type="button" class="lb-btn lb-next" aria-label="Próxima imagem">' + ICON_NEXT + '</button>';
    document.body.appendChild(box);

    var figure  = box.querySelector('.lb-figure');
    var zoomImg = box.querySelector('.lb-img');
    var caption = box.querySelector('.lb-caption');
    var btnClose = box.querySelector('.lb-close');

    var items = [];        // imagens originais do grupo
    var index = 0;
    var container = null;
    var busy = false;      // transição em andamento
    var pendingDir = 1;

    function isOpen() { return box.classList.contains('open'); }

    function groupFor(img) {
        var group = img.closest(GROUPS);
        var list = group
            ? Array.prototype.filter.call(group.querySelectorAll(SELECTOR), function (i) {
                  return !i.hasAttribute('data-clone');
              })
            : [img];
        var idx = img.hasAttribute('data-clone')
            ? parseInt(img.getAttribute('data-clone'), 10)
            : list.indexOf(img);
        return { group: group, list: list, index: Math.max(0, idx) };
    }

    function srcOf(img) { return img.currentSrc || img.src; }

    function fill(img) {
        var title = img.dataset.title || '';
        zoomImg.src = srcOf(img);
        zoomImg.alt = title || img.alt || '';
        caption.textContent = title;
    }

    function preloadNeighbours() {
        if (items.length < 2) return;
        [index - 1, index + 1].forEach(function (i) {
            var n = items.length;
            var im = new Image();
            im.src = srcOf(items[((i % n) + n) % n]);
        });
    }

    // Troca de imagem com transição suave (desliza + esmaece)
    function show(newIndex, dir) {
        var n = items.length;
        index = ((newIndex % n) + n) % n;
        pendingDir = dir || 1;

        if (busy) return;                       // o último pedido vence quando a transição terminar
        if (reduceMotion || !figure.animate) {
            fill(items[index]);
            preloadNeighbours();
            return;
        }

        busy = true;
        var d = pendingDir;
        var out = figure.animate(
            [{ opacity: 1, transform: 'translateX(0)' },
             { opacity: 0, transform: 'translateX(' + (-d * 48) + 'px)' }],
            { duration: 150, easing: 'ease-in', fill: 'forwards' }
        );

        var loader = new Image();
        loader.src = srcOf(items[index]);
        var decoded = loader.decode ? loader.decode().catch(function () {}) : Promise.resolve();
        var outDone = new Promise(function (r) { setTimeout(r, 150); });

        Promise.all([decoded, outDone]).then(function () {
            out.cancel();
            if (!isOpen() || !items.length) { busy = false; return; }   // fechou durante a transição
            fill(items[index]);                 // usa o índice mais recente
            var inn = figure.animate(
                [{ opacity: 0, transform: 'translateX(' + (pendingDir * 48) + 'px)' },
                 { opacity: 1, transform: 'translateX(0)' }],
                { duration: 220, easing: 'ease-out' }
            );
            inn.onfinish = inn.oncancel = function () {
                busy = false;
                preloadNeighbours();
            };
        });
    }

    function next() { if (items.length > 1) show(index + 1, 1); }
    function prev() { if (items.length > 1) show(index - 1, -1); }

    function open(img) {
        var g = groupFor(img);
        items = g.list;
        index = g.index;
        container = g.group;
        busy = false;
        fill(items[index]);
        box.classList.toggle('single', items.length < 2);
        box.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('lb-open');
        preloadNeighbours();
        btnClose.focus({ preventScroll: true });
    }

    function close() {
        if (!isOpen()) return;
        box.classList.remove('open');
        document.body.classList.remove('lb-open');
        // não destrava a rolagem se o menu mobile estiver aberto
        var menu = document.querySelector('.nav-list.open');
        document.body.style.overflow = menu ? 'hidden' : '';
        zoomImg.removeAttribute('src');
        caption.textContent = '';
        if (container) {
            // o carrossel acompanha a última imagem vista no zoom
            container.dispatchEvent(new CustomEvent('lightbox:close', { detail: { index: index } }));
        }
        items = [];
        container = null;
    }

    // ── Abrir ao clicar numa imagem ──
    document.addEventListener('click', function (e) {
        if (isOpen()) return;
        var img = e.target.closest && e.target.closest(SELECTOR);
        if (!img || img.tagName !== 'IMG') return;
        e.preventDefault();
        open(img);
    });

    // Imagens soltas (fora de carrossel) também abrem com Enter/Espaço
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (img) {
        if (img.closest('.carousel')) return;
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
        });
    });

    // ── Controles ──
    btnClose.addEventListener('click', close);
    box.querySelector('.lb-prev').addEventListener('click', prev);
    box.querySelector('.lb-next').addEventListener('click', next);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    document.addEventListener('keydown', function (e) {
        if (!isOpen()) return;
        if (e.key === 'Escape')          { close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
        else if (e.key === 'Tab') {
            // mantém o foco dentro do zoom
            var f = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) {
                return b.getClientRects().length > 0;
            });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });

    // ── Gestos no celular: deslizar p/ os lados troca, p/ baixo fecha ──
    var tx = 0, ty = 0, tracking = false;
    box.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1 || e.target.closest('button')) { tracking = false; return; }
        tracking = true;
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.changedTouches[0].clientX - tx;
        var dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next(); else prev();
        } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
            close();
        }
    }, { passive: true });
})();
