// carousel.js — carrossel infinito (arrastar, setas, teclado, roda do mouse)
// Uso no HTML:
//   <div class="carousel" data-captions aria-label="Nome da série">
//       <img class="imgli" src="img/historia/roda1.png" alt="Rodas 1">
//       ...
//   </div>
// • data-captions  → mostra o nome do quadro embaixo (vem de data-title no <img>;
//                    se não existir, usa o nome do arquivo: "roda1.png" → "Roda 1")
// • data-autoplay="4000" → (opcional) avança sozinho a cada 4 s
(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    // "festa 2.png" → "Festa 2" | "roda1.png" → "Roda 1"
    function titleFromFile(src) {
        var name = src.split('?')[0].split('/').pop();
        try { name = decodeURIComponent(name); } catch (e) { /* mantém */ }
        name = name.replace(/\.[a-z0-9]+$/i, '')
                   .replace(/[_-]+/g, ' ')
                   .replace(/([A-Za-zÀ-ÿ])(\d)/g, '$1 $2')
                   .replace(/\s+/g, ' ')
                   .trim();
        return name.replace(/(^|\s)(\S)/g, function (m, sp, ch) { return sp + ch.toUpperCase(); });
    }

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function el(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    function button(cls, label, icon) {
        var b = el('button', 'car-btn ' + cls);
        b.type = 'button';
        b.setAttribute('aria-label', label);
        b.innerHTML = icon;
        return b;
    }

    function imageDone(img) {
        return new Promise(function (resolve) {
            if (img.complete) return resolve();
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }

    function Carousel(root) {
        var originals = Array.prototype.slice.call(root.querySelectorAll('img'));
        var n = originals.length;
        if (!n) return;

        var withCaptions = root.hasAttribute('data-captions');
        var autoMs = parseInt(root.getAttribute('data-autoplay'), 10) || 0;

        // ── Estrutura ──
        function makeSlide(img, cloneIndex) {
            var fig = el('figure', 'car-slide');
            var im = img;
            if (cloneIndex !== null) {
                im = img.cloneNode(true);
                im.setAttribute('data-clone', cloneIndex);
                im.setAttribute('alt', '');
                im.setAttribute('tabindex', '-1');
                im.removeAttribute('role');
                fig.className += ' is-clone';
                fig.setAttribute('aria-hidden', 'true');
            }
            im.draggable = false;
            fig.appendChild(im);
            if (withCaptions && img.dataset.title) {
                var cap = el('figcaption');
                cap.textContent = img.dataset.title;
                fig.appendChild(cap);
            }
            return fig;
        }

        if (withCaptions) {
            originals.forEach(function (img) {
                if (!img.dataset.title) img.dataset.title = titleFromFile(img.getAttribute('src') || '');
            });
        }

        var viewport = el('div', 'car-viewport');
        var track = el('div', 'car-track');
        viewport.tabIndex = 0;
        viewport.setAttribute('aria-label', 'Use as setas do teclado para navegar. Enter amplia a imagem.');
        var originalSlides = originals.map(function (img) { return makeSlide(img, null); });
        originalSlides.forEach(function (s) { track.appendChild(s); });

        var prevBtn = button('car-prev', 'Imagem anterior', ICON_PREV);
        var nextBtn = button('car-next', 'Próxima imagem', ICON_NEXT);

        root.textContent = '';
        root.setAttribute('role', 'region');
        root.setAttribute('aria-roledescription', 'carrossel');
        if (!root.getAttribute('aria-label')) root.setAttribute('aria-label', 'Galeria de quadros');
        viewport.appendChild(track);
        root.appendChild(viewport);
        root.appendChild(prevBtn);
        root.appendChild(nextBtn);

        // ── Estado ──
        var setW = 0;         // largura de UM conjunto completo de slides (inclui o espaçamento)
        var viewW = 0;
        var snaps = [];       // posição (px) do início de cada slide, em todas as cópias
        var x = 0;            // deslocamento atual
        var startX = 0, target = 0, startT = 0, dur = 0, raf = 0;
        var ready = false;
        var drag = null, suppressClick = false, wheelTimer = 0;
        var hovering = false, autoTimer = 0;

        // O trilho tem várias cópias idênticas dos slides; x sempre fica na "cópia do meio"
        // e é reposto lá quando sai dela — o salto é invisível porque as cópias são iguais.
        function shift(d) {
            x += d; startX += d; target += d;
            if (drag) drag.x0 += d;
        }
        function wrap() {
            if (setW <= 0) return;
            while (x >= 2 * setW) shift(-setW);
            while (x < setW) shift(setW);
        }
        function render() {
            track.style.transform = 'translate3d(' + (-Math.round(x)) + 'px,0,0)';
        }
        function cancelAnim() {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            startX = target = x;
        }
        function tick(now) {
            raf = 0;
            var p = dur ? Math.min(1, (now - startT) / dur) : 1;
            x = startX + (target - startX) * easeOut(p);
            wrap();
            render();
            if (p < 1) raf = requestAnimationFrame(tick);
        }
        function animateTo(t, d) {
            target = t;
            startX = x;
            startT = performance.now();
            dur = reduceMotion ? 0 : (d || 520);
            if (!raf) raf = requestAnimationFrame(tick);
        }

        function nearestSnapIndex(pos) {
            var best = 0, bd = Infinity;
            for (var i = 0; i < snaps.length; i++) {
                var d = Math.abs(snaps[i] - pos);
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        }
        function currentIndex() { return nearestSnapIndex(x) % n; }

        function step(dir) {
            if (!ready) return;
            if (Math.abs(target - x) > viewW) return;       // não acumula cliques demais
            var i;
            if (dir > 0) {
                for (i = 0; i < snaps.length; i++) {
                    if (snaps[i] > target + 1) { animateTo(snaps[i]); return; }
                }
            } else {
                for (i = snaps.length - 1; i >= 0; i--) {
                    if (snaps[i] < target - 1) { animateTo(snaps[i]); return; }
                }
            }
        }

        function goToIndex(idx) {
            if (!ready) return;
            var best = -1, bd = Infinity;
            for (var i = 0; i < snaps.length; i++) {
                if (i % n !== idx) continue;
                var d = Math.abs(snaps[i] - x);
                if (d < bd) { bd = d; best = i; }
            }
            if (best >= 0 && bd > 1) animateTo(snaps[best], 700);
        }

        // ── Medição / montagem das cópias ──
        function layout() {
            var keep = ready ? currentIndex() : 0;

            // remove clones antigos
            Array.prototype.slice.call(track.querySelectorAll('.is-clone')).forEach(function (c) {
                c.parentNode.removeChild(c);
            });

            viewW = viewport.clientWidth;
            var first = originalSlides[0];
            var last = originalSlides[n - 1];
            var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            setW = last.offsetLeft + last.offsetWidth + gap - first.offsetLeft;
            if (setW < 20 || viewW < 20) return;            // imagens ainda sem tamanho: tenta de novo depois

            var copies = 3 + Math.ceil(viewW / setW);
            for (var c = 1; c < copies; c++) {
                for (var i = 0; i < n; i++) track.appendChild(makeSlide(originals[i], i));
            }

            snaps = Array.prototype.map.call(track.children, function (s) { return s.offsetLeft; });

            cancelAnim();
            x = setW + snaps[keep];
            startX = target = x;
            wrap();
            render();

            if (!ready) {
                ready = true;
                root.classList.add('is-ready');
            }
        }

        var layoutQueued = false;
        function queueLayout() {
            if (layoutQueued) return;
            layoutQueued = true;
            requestAnimationFrame(function () { layoutQueued = false; layout(); });
        }

        // Só monta o carrossel depois que TODAS as imagens carregaram
        // (com limite de 20 s para uma imagem quebrada não travar tudo).
        Promise.race([
            Promise.all(originals.map(imageDone)),
            new Promise(function (r) { setTimeout(r, 20000); })
        ]).then(function () {
            layout();
            originals.forEach(function (img) { img.addEventListener('load', queueLayout); });
            if ('ResizeObserver' in window) {
                new ResizeObserver(function () {
                    if (viewport.clientWidth !== viewW) queueLayout();
                }).observe(viewport);
            } else {
                window.addEventListener('resize', queueLayout);
            }
            startAuto();
        });

        // ── Botões e teclado ──
        prevBtn.addEventListener('click', function () { step(-1); });
        nextBtn.addEventListener('click', function () { step(1); });

        root.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            else if (e.key === 'Enter' && e.target === viewport && ready) {
                e.preventDefault();
                originals[currentIndex()].click();           // abre o zoom na imagem atual
            }
        });

        // Se o navegador tentar rolar o viewport (ex.: foco), desfaz — quem manda é o transform
        viewport.addEventListener('scroll', function () { viewport.scrollLeft = 0; });

        // ── Arrastar (mouse, toque e caneta) ──
        viewport.addEventListener('pointerdown', function (e) {
            if (!ready) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            drag = { id: e.pointerId, sx: e.clientX, x0: x, active: false, v: 0, lastX: x, lastT: e.timeStamp };
        });
        viewport.addEventListener('pointermove', function (e) {
            if (!drag || e.pointerId !== drag.id) return;
            var dx = e.clientX - drag.sx;
            if (!drag.active) {
                if (Math.abs(dx) < 6) return;
                drag.active = true;
                cancelAnim();
                viewport.classList.add('dragging');
                try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
            }
            x = drag.x0 - dx;
            startX = target = x;
            wrap();
            render();
            var dt = e.timeStamp - drag.lastT;
            if (dt > 0) drag.v = (x - drag.lastX) / dt;
            drag.lastX = x;
            drag.lastT = e.timeStamp;
        });
        function endDrag(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var wasActive = drag.active, v = drag.v;
            drag = null;
            viewport.classList.remove('dragging');
            if (!wasActive) return;
            suppressClick = true;                            // não abrir o zoom ao soltar o arrasto
            setTimeout(function () { suppressClick = false; }, 60);
            var projected = x + Math.max(-viewW, Math.min(viewW, v * 250));
            animateTo(snaps[nearestSnapIndex(projected)], 600);
        }
        viewport.addEventListener('pointerup', endDrag);
        viewport.addEventListener('pointercancel', endDrag);
        viewport.addEventListener('click', function (e) {
            if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
        }, true);

        // ── Gesto horizontal do trackpad ──
        viewport.addEventListener('wheel', function (e) {
            if (!ready || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            e.preventDefault();
            cancelAnim();
            x += e.deltaX;
            startX = target = x;
            wrap();
            render();
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(function () { animateTo(snaps[nearestSnapIndex(x)], 350); }, 140);
        }, { passive: false });

        // ── Zoom fechou: acompanha a última imagem vista ──
        root.addEventListener('lightbox:close', function (e) { goToIndex(e.detail.index); });

        // ── Autoplay opcional ──
        function startAuto() {
            if (!autoMs || reduceMotion) return;
            clearInterval(autoTimer);
            autoTimer = setInterval(function () {
                if (hovering || drag || document.hidden || document.body.classList.contains('lb-open')) return;
                step(1);
            }, autoMs);
        }
        root.addEventListener('mouseenter', function () { hovering = true; });
        root.addEventListener('mouseleave', function () { hovering = false; });
        root.addEventListener('focusin', function () { hovering = true; });
        root.addEventListener('focusout', function () { hovering = false; });
    }

    Array.prototype.forEach.call(document.querySelectorAll('.carousel'), Carousel);
})();
