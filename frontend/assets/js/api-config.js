// assets/js/api-config.js
// DEMO:
//  - localhost:3100 (npm start) → salva em data/farms.json e frontend/data/farms.json
//  - publicado (GitHub Pages / Netlify) → salva só no navegador (localStorage)
(function () {
    var isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    var useServer = isLocalHost && location.port === "3100";

    window.IC_DEMO = true;
    window.IC_DEMO_SERVER = useServer;
    window.IC_API_CONFIG = {
        baseUrl: useServer ? location.origin : "",
        isLocal: isLocalHost || location.protocol === "file:",
        isGithubPages: /github\.io$/i.test(location.hostname),
        usesStaticData: !useServer
    };
})();