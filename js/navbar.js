// navbar.js — barra grande no topo, menor ao rolar + menu hambúrguer em tela cheia
(function () {
    'use strict';

    var navbar  = document.getElementById('navbar');
    var toggle  = document.getElementById('nav-toggle');
    var navList = document.querySelector('.nav-list');
    if (!navbar) return;

    // Rolagem: .scrolled encolhe logo e padding
    function handleScroll() {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    if (!toggle || !navList) return;

    function setOpen(open) {
        navList.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(!navList.classList.contains('open'));
    });

    // Fecha ao clicar num link
    navList.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false);
    });

    // Fecha ao clicar fora
    document.addEventListener('click', function (e) {
        if (!navbar.contains(e.target) && navList.classList.contains('open')) setOpen(false);
    });

    // Fecha com ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && navList.classList.contains('open')) {
            setOpen(false);
            toggle.focus();
        }
    });

    // Se a janela voltar a ser larga, garante que o menu não fique "preso" aberto
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768 && navList.classList.contains('open')) setOpen(false);
    });
})();
