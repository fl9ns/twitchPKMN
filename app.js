// ==UserScript==
// @name         TWITCH PKMN
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  PKMN
// @author       FL9NS
// @match        https://www.twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const combos = {
        pichu: { color: "#DAA520", badge: "pichu" },
        charmander: { color: "#D2691E", badge: "charmander" },
        bulbasaur: { color: "#2E8B57", badge: "bulbasaur" },
        squirtle: { color: "#1E90FF", badge: "squirtle" },
        gastly: { color: "#8A2BE2", badge: "gastly" },
    };

    let currentComboId = null;
    let savedAuth = null;
    let savedClientId = null;
    let savedIntegrity = null;

    let lastComboChangeTime = 0;
    const COOLDOWN_MS = 3000;

    async function updateTwitchProfile(comboId) {
        if (!savedAuth || !savedClientId || !savedIntegrity) {
            console.warn("[PKMN] Impossible de changer de combo : jetons manquants. (Envoie un message ou actualise)");
            return;
        }

        const combo = combos[comboId];
        const url = 'https://gql.twitch.tv/gql';

        const payload = [
            {
                "operationName": "Chat_UpdateChatColorV2",
                "variables": { "input": { "color": combo.color } },
                "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "286a64b6873a76e112978cfb3eaa6b4e33a55b7d0cd0a1593c790f56db2b2740" } }
            },
            {
                "operationName": "ChatSettings_SelectGlobalBadge",
                "variables": { "input": { "badgeSetID": combo.badge, "badgeSetVersion": "1" } },
                "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "5e1b7f0ba771ca8eb81c0fcd5b8f4ff559ec2dc71cc9256e04ec2665049fc4e5" } }
            }
        ];

        const headers = {
            'Authorization': savedAuth,
            'Client-Id': savedClientId,
            'Client-Integrity': savedIntegrity,
            'Content-Type': 'text/plain;charset=UTF-8'
        };

        try {
            await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
            console.log(`[PKMN] Combo changé pour : ${comboId.toUpperCase()}`);
        } catch (err) {
            console.error("[PKMN] Erreur lors de la mise à jour :", err);
        }
    }

    function triggerRandomCombo() {
        const now = Date.now();
        if (now - lastComboChangeTime < COOLDOWN_MS) {
            console.log(`[PKMN] Cooldown actif (${Math.ceil((COOLDOWN_MS - (now - lastComboChangeTime)) / 1000)}s restantes)`);
            return;
        }

        const allCombos = Object.keys(combos);
        const availableCombos = allCombos.filter(id => id !== currentComboId);

        const randomIndex = Math.floor(Math.random() * availableCombos.length);
        const nextComboId = availableCombos[randomIndex];

        lastComboChangeTime = now;
        currentComboId = nextComboId;
        updateTwitchProfile(nextComboId);
    }

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options] = args;

        if (typeof url === 'string' && url.includes('gql.twitch.tv') && options && options.headers) {
            const headers = new Headers(options.headers);
            const auth = headers.get('Authorization');
            const clientId = headers.get('Client-Id');
            const integrity = headers.get('Client-Integrity');

            if (auth && clientId && integrity) {
                savedAuth = auth;
                savedClientId = clientId;
                savedIntegrity = integrity;
            }
        }

        return originalFetch.apply(this, args);
    };

    function getCurrentUsername() {
        const match = document.cookie.match(/(?:^|; )login=([^;]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    function handleNewNode(node, myUsername) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const authorElement = node.querySelector('[data-a-target="chat-message-username"]');
        if (authorElement) {
            const authorText = authorElement.textContent.trim().toLowerCase();
            const dataUser = authorElement.getAttribute('data-a-user');

            if (authorText === myUsername || (dataUser && dataUser.toLowerCase() === myUsername)) {
                triggerRandomCombo();
            }
        }
    }

    function setupChatObserver() {
        const myUsername = getCurrentUsername();
        if (!myUsername) {
            setTimeout(setupChatObserver, 2000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        handleNewNode(node, myUsername);
                    }
                }
            }
        });

        const findChatInterval = setInterval(() => {
            const chatContainer = document.querySelector('.chat-scrollable-area__message-container');
            if (chatContainer) {
                clearInterval(findChatInterval);
                observer.observe(chatContainer, { childList: true });
                console.log(`[PKMN] Observateur de tchat activé pour le joueur : ${myUsername}`);
            }
        }, 1000);
    }

    window.addEventListener('load', setupChatObserver);

})();
