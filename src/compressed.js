async function observeQueue(t) {
  try {
    let e = initializeWebSocket();
    (e.onopen = () => subscribeToGameFlow(e)),
      (e.onmessage = t),
      (e.onerror = (t) => {
        console.error("WebSocket Error:", t);
      });
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

async function updateLobbyState(t) {
  try {
    let e = JSON.parse(t.data);
    if (e[1] && e[1] === "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase") {
      let phase = e[2].data;
      console.log("Gameflow phase:", phase);
      
      if (phase === "ChampSelect") {
        await handleChampionSelect();
      } else {
        removeSidebar();
      }
    }
  } catch (a) {
    console.error("Error updating lobby state:", a);
  }
}

async function handleChampionSelect() {
  try {
    let config = await fetchConfig();
    if (config.popup) createPopup();
    await delay(1000);

    let regionData = await create("GET", "/riotclient/region-locale");
    let region = regionData.webRegion;

    let chatInfo = await getChampionSelectChatInfo();
    if (!chatInfo) return;

    let participantsData = await create("GET", "/lol-chat/v5/participants");
    let participants = participantsData.participants.filter(p => p.cid.includes("champ-select"));
    let puuids = participants.map(p => p.puuid);

    let matchData = await getMatchDataForPuuids(puuids);
    let rankedStats = await getRankedStatsForPuuids(puuids);

    let formattedPlayerData = participants.map((p, index) => formatPlayerData(p, rankedStats[index], matchData[index]));
    let sidebarContent = participants.map((p, index) => formatPlayerDataForSidebar(p, rankedStats[index], matchData[index]));
    
    let chatFrame = document.getElementById("embedded-messages-frame").contentDocument;

    if (config.textchat) {
      for (let message of formattedPlayerData) {
        await postMessageToChat(chatInfo.id, message);
      }
    }

    let opggLink = generateMultiSearchLink(region, participants, "op.gg");
    let deeplolLink = generateMultiSearchLink(region, participants, "deeplol.gg");

    if (config.popup) {
      populateContent(sidebarContent, generateSidebarLinks(opggLink, deeplolLink), chatFrame);
    }

  } catch (error) {
    console.error("Error in Champion Select phase:", error);
  }
}

async function fetchConfig() {
  try {
    let scriptPath = getScriptPath();
    let pluginName = scriptPath.match(/\/([^/]+)\/index\.js$/)?.[1];
    let configResponse = await fetch(`https://plugins/${decodeURI(pluginName)}/config.json`);
    return await configResponse.json();
  } catch {
    return { textchat: true, popup: true };
  }
}

function generateMultiSearchLink(region, participants, site) {
  let summoners = participants.map(p => encodeURIComponent(`${p.game_name}#${p.game_tag}`)).join("%2C");
  return site === "op.gg"
    ? `https://www.op.gg/multisearch/${region}?summoners=${summoners}`
    : `https://www.deeplol.gg/multi/${region}/${summoners}`;
}

async function postMessageToChat(chatId, message) {
  try {
    await create("POST", `/lol-chat/v1/conversations/${chatId}/messages`, {
      body: message,
      type: "celebration",
    });
  } catch (error) {
    console.error(`Error posting message to chat ${chatId}:`, error);
  }
}

function formatPlayerData(participant, rankedStats, matchData) {
  let winRate = calculateWinRate(matchData.winList);
  let commonRole = mostCommonRole(matchData.laneList);
  let kda = calculateKDA(matchData.killList, matchData.assistsList, matchData.deathsList);
  return `${participant.game_name} - ${rankedStats} - ${winRate} - ${commonRole} - ${kda}`;
}

function formatPlayerDataForSidebar(participant, rankedStats, matchData) {
  return `${participant.game_name}#${participant.game_tag} - ${rankedStats} - ${calculateWinRate(matchData.winList)} - ${mostCommonRole(matchData.laneList)} - ${calculateKDA(matchData.killList, matchData.assistsList, matchData.deathsList)}`;
}

function createPopup() {
  let popupHtml = `<div id="infoSidebar" style="z-index: 9999; ...">...</div>`;
  document.body.insertAdjacentHTML("beforeend", popupHtml);
  document.getElementById("toggleButton").addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
  let sidebar = document.getElementById("infoSidebar");
  sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
}

function removeSidebar() {
  let sidebar = document.getElementById("infoSidebar");
  if (sidebar) {
    sidebar.remove();
  }
}

async function getChampionSelectChatInfo() {
  try {
    let chatInfo = await create("GET", "/lol-chat/v1/conversations");
    return chatInfo.find(c => c.type === "champ-select");
  } catch (error) {
    console.error("Error fetching champion select chat info:", error);
    return null;
  }
}

async function getMatchDataForPuuids(puuids) {
  try {
    let matchData = await Promise.all(puuids.map(puuid => create("GET", `/lol-match-history/v1/matches/${puuid}`)));
    return matchData;
  } catch (error) {
    console.error("Error fetching match data:", error);
    return [];
  }
}

async function getRankedStatsForPuuids(puuids) {
  try {
    let rankedStats = await Promise.all(puuids.map(puuid => create("GET", `/lol-ranked/v1/ranked-stats/${puuid}`)));
    return rankedStats;
  } catch (error) {
    console.error("Error fetching ranked stats:", error);
    return [];
  }
}

function calculateWinRate(winList) {
  let wins = winList.filter(result => result === "WIN").length;
  return (wins / winList.length) * 100;
}

function mostCommonRole(laneList) {
  let roleCount = {};
  for (let lane of laneList) {
    roleCount[lane] = (roleCount[lane] || 0) + 1;
  }
  return Object.keys(roleCount).reduce((a, b) => (roleCount[a] > roleCount[b] ? a : b), "");
}

function calculateKDA(kills, assists, deaths) {
  return ((kills + assists) / Math.max(1, deaths)).toFixed(2);
}

function getScriptPath() {
  let scriptElements = document.getElementsByTagName("script");
  let script = Array.from(scriptElements).find((s) => s.src.includes("/index.js"));
  return script ? script.src : "";
}

function populateContent(sidebarContent, links, chatFrame) {
  let contentHtml = `
    <div>
      <h4>Player Info</h4>
      ${sidebarContent.join("<br>")}
      <h4>Links</h4>
      ${links}
    </div>
  `;
  chatFrame.body.innerHTML = contentHtml;
}

function generateSidebarLinks(opggLink, deeplolLink) {
  return `
    <a href="${opggLink}" target="_blank">OP.GG Multisearch</a><br>
    <a href="${deeplolLink}" target="_blank">DeepLoL Multisearch</a>
  `;
}

async function initializeApp() {
  try {
    await observeQueue(updateLobbyState);
  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

window.addEventListener("load", initializeApp);
