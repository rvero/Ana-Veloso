// autoplay.js — inicia os vídeos (video.js) mudos, em loop, e pausa quando saem da tela
(function () {
    'use strict';
    if (typeof videojs === 'undefined') return;

    function safePlay(player) {
        var p = player.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* o navegador bloqueou: tudo bem */ });
    }

    document.querySelectorAll('video.video-js').forEach(function (el) {
        if (!el.id) return;

        // Antes o código usava getPlayer(), que devolvia "undefined" porque o video.js
        // ainda não tinha iniciado o player — então nada acontecia. Agora iniciamos aqui.
        var player = videojs.getPlayer(el.id) || videojs(el.id);
        player.muted(true);
        player.ready(function () { safePlay(player); });

        // Economiza dados/bateria: só toca enquanto o vídeo está visível
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) safePlay(player);
                    else player.pause();
                });
            }, { threshold: 0.25 }).observe(player.el());
        }
    });
})();
