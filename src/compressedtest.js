async function observeQueue(t) {
    try {
      let e = initializeWebSocket();
      e.onopen = () => subscribeToGameFlow(e);
      e.onmessage = t;
      e.onerror = (t) => {
        console.error("WebSocket Error:", t);
      };
    } catch (a) {
      console.error("Error observing game queue:", a);
    }
  }
  
  function initializeWebSocket() {
    let t = getWebSocketURI();
    return new WebSocket(t, "wamp");
  }
  
  function getWebSocketURI() {
    let t = document.querySelector('link[rel="riot:plugins:websocket"]');
    if (!t) throw Error("WebSocket link element not found");
    return t.href;
  }
  
  function subscribeToGameFlow(t) {
    let e = "/lol-gameflow/v1/gameflow-phase".replaceAll("/", "_");
    t.send(JSON.stringify([5, "OnJsonApiEvent" + e]));
  }
  
  const delay = (t) => new Promise((e) => setTimeout(e, t));
  
  function romanToNumber(t) {
    let e = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1e3 },
      a = 0,
      n = 0;
    for (let i = t.length - 1; i >= 0; i--) {
      let r = e[t[i]];
      a += r < n ? -r : r;
      n = r;
    }
    return a;
  }
  
  function sumArrayElements(t) {
    return Array.isArray(t)
      ? t.reduce((t, e) => t + e, 0)
      : (console.error("Expected an array, received:", t), 0);
  }
  
  function createPopup() {
    let t = `<div id="infoSidebar" style="z-index: 9999; position: fixed; inset-block-start: 0; inset-inline-start: 0; inline-size: 282px; block-size: 100%; background-color: #1e2328; padding: 20px; border-inline-end: 1px solid #C8A660; box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2); color: white; display: none; overflow-y: auto; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"><div id="sidebarContent">Loading... <br> This may take a few seconds.</div></div><button id="toggleButton" style="position: fixed; inset-block-start: 625px; inset-inline-start: 325px; color: #cdbe91; font-size: var(--font-size, 14px); font-family: var(--font-family, var(--font-display)); font-weight: bold; letter-spacing: 1px; align-items: center;box-sizing: border-box;justify-content: center;white-space: nowrap;padding: 5px 1.3em;block-size: var(--flat-button-height);inline-size: var(--flat-button-width);min-block-size: var(--flat-button-min-height);cursor: pointer;-webkit-user-select: none;box-shadow: 0 0 1px 1px #010a13, inset 0 0 1px 1px #010a13;background: #1e2328;background-image: initial;background-position-x: initial;background-position-y: initial;background-size: initial;background-repeat-x: initial;background-repeat-y: initial; background-attachment: initial;background-origin: initial;background-clip: initial;background-color: rgb(30, 35, 40);border: 1px solid #C8A660;">SNR</button>`;
    document.body.insertAdjacentHTML("beforeend", t),
      document
        .getElementById("toggleButton")
        .addEventListener("click", toggleSidebar);
  }
  
  function populateContent(t, e, a) {
    let n = `<p style="font-size: 12px">${t.join("<br>")}</p>`;
    document.getElementById("sidebarContent").innerHTML =
      n +
      e +
      '<p style="font-size: 10px">This is a beta overlay, if you would like to configure certain options, this is now possible. Please visit <a href="https://github.com/dakota1337x/Summoner-Name-Reveal-V2" target="_blank" style="color: gold;">here</a> to find out more information.</p>';
  }
  
  function removeSidebar() {
    let t = document.getElementById("infoSidebar"),
      e = document.getElementById("toggleButton");
    t && t.remove();
    e && e.remove();
  }
  
  async function queryMatch(t, e = 0, a = 19) {
    try {
      let n = `/lol-match-history/v1/products/lol/${t}/matches?begIndex=${e}&endIndex=${a}`,
        i = await create("GET", n),
        r = i.games.games;
      return console.log(r), !!Array.isArray(r) && extractMatchData(r);
    } catch (o) {
      return console.error("Error querying match for puuid:", t, o), !1;
    }
  }
  
  function extractMatchData(t) {
    let e = {
      gameMode: [],
      championId: [],
      killList: [],
      deathsList: [],
      assistsList: [],
      Minions: [],
      gold: [],
      winList: [],
      causedEarlySurrenderList: [],
      laneList: [],
      spell1Id: [],
      spell2Id: [],
      items: [],
      types: [],
    };
    return (
      t.forEach((t) => {
        let a = t.participants[0];
        e.gameMode.push(t.queueId);
        e.championId.push(a.championId);
        e.killList.push(a.stats.kills);
        e.deathsList.push(a.stats.deaths);
        e.assistsList.push(a.stats.assists);
        e.Minions.push(a.stats.neutralMinionsKilled + a.stats.totalMinionsKilled);
        e.gold.push(a.stats.goldEarned);
        e.winList.push(a.stats.win ? "true" : "false");
        e.causedEarlySurrenderList.push(a.stats.causedEarlySurrender);
        e.laneList.push(a.timeline.lane);
        e.spell1Id.push(a.spell1Id);
        e.spell2Id.push(a.spell2Id);
        let n = [];
        for (let i = 0; i < 7; i++) {
          let r = "item" + i,
            o = a.stats[r];
          n.push(o);
        }
        e.items.push(n);
        e.types.push(t.gameType);
      }),
      e
    );
  }
  
  async function getMatchDataForPuuids(t) {
    try {
      let e = t.map((t) => queryMatch(t, 0, 21));
      return await Promise.all(e);
    } catch (a) {
      return console.error("Error fetching match data for multiple PUUIDs:", a), [];
    }
  }
  
  async function fetchRankedStats(t) {
    let e = `/lol-ranked/v1/ranked-stats/${t}`;
    try {
      return await create("GET", e);
    } catch (a) {
      return console.error("Error fetching ranked stats for puuid:", t, a), null;
    }
  }
  
  async function getRankedStatsForPuuids(t) {
    try {
      let e = await Promise.all(t.map(fetchRankedStats));
      return e.map(extractSimplifiedStats);
    } catch (a) {
      return console.error("Error fetching ranked stats for multiple PUUIDs:", a), [];
    }
  }
  
  function extractSimplifiedStats(t) {
    if (!t || !t.queueMap) return "Unranked";
    let e = t.queueMap.RANKED_SOLO_5x5,
      a = t.queueMap.RANKED_FLEX_SR;
    return determineRank(e, a);
  }
  
  function determineRank(t, e) {
    return isValidRank(t) ? formatRank(t) : isValidRank(e) ? formatRank(e) : "Unranked";
  }
  
  function isValidRank(t) {
    return t && t.tier && t.division && "NA" !== t.tier && !t.isProvisional;
  }
  
  function formatRank(t) {
    return ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"].includes(t.tier)
      ? `${t.tier[0]}${romanToNumber(t.division)}`
      : t.tier;
  }
  
  async function getChampionSelectChatInfo() {
    try {
      let t = await create("GET
  