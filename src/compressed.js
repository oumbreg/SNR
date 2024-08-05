async function observeQueue(callback) {
  try {
    const socket = initializeWebSocket();
    socket.onopen = () => subscribeToGameFlow(socket);
    socket.onmessage = callback;
    socket.onerror = (error) => console.error("WebSocket Error:", error);
  } catch (error) {
    console.error("Error observing game queue:", error);
  }
}

function initializeWebSocket() {
  const uri = getWebSocketURI();
  return new WebSocket(uri, "wamp");
}

function getWebSocketURI() {
  const linkElement = document.querySelector('link[rel="riot:plugins:websocket"]');
  if (!linkElement) throw new Error("WebSocket link element not found");
  return linkElement.href;
}

function subscribeToGameFlow(socket) {
  const event = "/lol-gameflow/v1/gameflow-phase".replaceAll("/", "_");
  socket.send(JSON.stringify([5, `OnJsonApiEvent${event}`]));
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function romanToNumber(roman) {
  const romanNumerals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return roman.split('').reduceRight((total, char, index, arr) => {
    const value = romanNumerals[char];
    return value < romanNumerals[arr[index + 1]] ? total - value : total + value;
  }, 0);
}

function sumArrayElements(arr) {
  if (!Array.isArray(arr)) {
    console.error("Expected an array, received:", arr);
    return 0;
  }
  return arr.reduce((sum, value) => sum + value, 0);
}

function createPopup() {
  const popupHTML = `
    <div id="infoSidebar" style="z-index: 9999; position: fixed; top: 0; left: 0; width: 282px; height: 100%; background-color: #1e2328; padding: 20px; border-right: 1px solid #C8A660; box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2); color: white; display: none; overflow-y: auto; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <div id="sidebarContent">Loading... <br> This may take a few seconds.</div>
    </div>
    <button id="toggleButton" style="position: fixed; top: 625px; left: 325px; color: #cdbe91; font-size: 14px; font-weight: bold; letter-spacing: 1px; padding: 5px 1.3em; cursor: pointer; box-shadow: 0 0 1px 1px #010a13, inset 0 0 1px 1px #010a13; background: #1e2328; border: 1px solid #C8A660;">
      SNR
    </button>
  `;
  document.body.insertAdjacentHTML("beforeend", popupHTML);
  document.getElementById("toggleButton").addEventListener("click", toggleSidebar);
}

function populateContent(lines, additionalContent, document) {
  const contentHTML = `
    <p style="font-size: 12px">${lines.join("<br>")}</p>
    ${additionalContent}
    <p style="font-size: 10px">
      This is a beta overlay. For configuration options, visit 
      <a href="https://github.com/dakota1337x/Summoner-Name-Reveal-V2" target="_blank" style="color: gold;">here</a> for more information.
    </p>
  `;
  document.getElementById("sidebarContent").innerHTML = contentHTML;
}

function removeSidebar() {
  const sidebar = document.getElementById("infoSidebar");
  const toggleButton = document.getElementById("toggleButton");
  sidebar?.remove();
  toggleButton?.remove();
}

async function queryMatch(puuid, startIndex = 0, endIndex = 19) {
  try {
    const endpoint = `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=${startIndex}&endIndex=${endIndex}`;
    const response = await create("GET", endpoint);
    return Array.isArray(response.games.games) ? extractMatchData(response.games.games) : null;
  } catch (error) {
    console.error("Error querying match for puuid:", puuid, error);
    return null;
  }
}

function extractMatchData(matches) {
  const data = {
    gameMode: [], championId: [], killList: [], deathsList: [], assistsList: [],
    Minions: [], gold: [], winList: [], causedEarlySurrenderList: [],
    laneList: [], spell1Id: [], spell2Id: [], items: [], types: []
  };
  matches.forEach(match => {
    const participant = match.participants[0];
    data.gameMode.push(match.queueId);
    data.championId.push(participant.championId);
    data.killList.push(participant.stats.kills);
    data.deathsList.push(participant.stats.deaths);
    data.assistsList.push(participant.stats.assists);
    data.Minions.push(participant.stats.neutralMinionsKilled + participant.stats.totalMinionsKilled);
    data.gold.push(participant.stats.goldEarned);
    data.winList.push(participant.stats.win ? "true" : "false");
    data.causedEarlySurrenderList.push(participant.stats.causedEarlySurrender);
    data.laneList.push(participant.timeline.lane);
    data.spell1Id.push(participant.spell1Id);
    data.spell2Id.push(participant.spell2Id);
    data.items.push(Array.from({ length: 7 }, (_, i) => participant.stats[`item${i}`]));
    data.types.push(match.gameType);
  });
  return data;
}

async function getMatchDataForPuuids(puuids) {
  try {
    const queries = puuids.map(puuid => queryMatch(puuid, 0, 21));
    return await Promise.all(queries);
  } catch (error) {
    console.error("Error fetching match data for multiple PUUIDs:", error);
    return [];
  }
}

async function fetchRankedStats(puuid) {
  try {
    const endpoint = `/lol-ranked/v1/ranked-stats/${puuid}`;
    return await create("GET", endpoint);
  } catch (error) {
    console.error("Error fetching ranked stats for puuid:", puuid, error);
    return null;
  }
}

async function getRankedStatsForPuuids(puuids) {
  try {
    const stats = await Promise.all(puuids.map(fetchRankedStats));
    return stats.map(extractSimplifiedStats);
  } catch (error) {
    console.error("Error fetching ranked stats for multiple PUUIDs:", error);
    return [];
  }
}

function extractSimplifiedStats(stats) {
  if (!stats || !stats.queueMap) return "Unranked";
  const solo = stats.queueMap.RANKED_SOLO_5x5;
  const flex = stats.queueMap.RANKED_FLEX_SR;
  return determineRank(solo, flex);
}

function determineRank(solo, flex) {
  return isValidRank(solo) ? formatRank(solo) :
         isValidRank(flex) ? formatRank(flex) : "Unranked";
}

function isValidRank(rank) {
  return rank && rank.tier && rank.division && rank.tier !== "NA" && !rank.isProvisional;
}

function formatRank(rank) {
  const tiers = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];
  return tiers.includes(rank.tier) ? `${rank.tier[0]}${romanToNumber(rank.division)}` : rank.tier;
}

async function getChampionSelectChatInfo() {
  try {
    const conversations = await create("GET", "/lol-chat/v1/conversations");
    return conversations ? conversations.find(conv => conv.type === "championSelect") : null;
  } catch (error) {
    console.error("Error fetching champion select chat info:", error);
    return null;
  }
}

async function postMessageToChat(conversationId, message) {
  try {
    await create("POST", `/lol-chat/v1/conversations/${conversationId}/messages`, { body: message, type: "celebration" });
  } catch (error) {
    console.error(`Error posting message to chat ${conversationId}:`, error);
  }
}

async function getMessageFromChat(conversationId) {
  try {
    await create("GET", `/lol-chat/v1/conversations/${conversationId}/messages`);
  } catch (error) {
    console.error(`Error getting messages from chat ${conversationId}:`, error);
  }
}

async function handleChampionSelect() {
  try {
    const config = await getConfig();
    if (config.popup) createPopup();
    await delay(15000);
    const regionLocale = await create("GET", "/riotclient/region-locale");
    const webRegion = regionLocale.webRegion;
    const chatInfo = await getChampionSelectChatInfo();
    if (!chatInfo) return;

    const participants = (await create("GET", "//riotclient/chat/v5/participants")).participants;
    const championSelectParticipants = participants.filter(participant => participant.cid.includes("champ-select"));
    const puuids = championSelectParticipants.map(participant => participant.puuid);
    const matchData = await getMatchDataForPuuids(puuids);
    const rankedStats = await getRankedStatsForPuuids(puuids);

    const playerData = championSelectParticipants.map((participant, index) => formatPlayerData(participant, rankedStats[index], matchData[index]));
    const playerData2 = championSelectParticipants.map((participant, index) => formatPlayerData2(participant, rankedStats[index], matchData[index]));

    const frame = document.getElementById("embedded-messages-frame");
    const document = frame.contentDocument || frame.contentWindow.document;

    if (config.textchat) {
      for (const message of playerData) {
        await postMessageToChat(chatInfo.id, message);
      }
    }

    const opGGLink = `https://www.op.gg/multisearch/${webRegion}?summoners=${championSelectParticipants.map(p => encodeURIComponent(`${p.game_name}#${p.game_tag}`)).join("%2C")}`;
    const deeplolLink = `https://www.deeplol.gg/multi/${webRegion}/${championSelectParticipants.map(p => encodeURIComponent(`${p.game_name}#${p.game_tag}`)).join(",")}`;
    const linksHTML = `
      <p style="font-size: 12px">
        <a href="${opGGLink}" target="_blank" style="color: gold;">View on OP.GG</a><br>
        <a href="${deeplolLink}" target="_blank" style="color: gold;">View on deeplol.gg</a>
      </p>
    `;

    if (config.popup) populateContent(playerData2, linksHTML, document);
  } catch (error) {
    console.error("Error in Champion Select phase:", error);
  }
}

function formatPlayerData(player, stats, matchData) {
  const winRate = calculateWinRate(matchData.winList);
  const role = mostCommonRole(matchData.laneList);
  const kda = calculateKDA(matchData.killList, matchData.assistsList, matchData.deathsList);
  return `${player.game_name} - ${stats} - ${winRate} - ${role} - ${kda}`;
}

function formatPlayerData2(player, stats, matchData) {
  const winRate = calculateWinRate(matchData.winList);
  const role = mostCommonRole(matchData.laneList);
  const kda = calculateKDA(matchData.killList, matchData.assistsList, matchData.deathsList);
  return `${player.game_name} #${player.game_tag} - ${stats} - ${winRate} - ${role} - ${kda}`;
}

async function updateLobbyState(event) {
  try {
    const data = JSON.parse(event.data);
    if (data[2].data === "ChampSelect") {
      await handleChampionSelect();
    } else {
      removeSidebar();
    }
  } catch (error) {
    console.error("Error updating lobby state:", error);
  }
}

function calculateWinRate(winList) {
  if (!winList || winList.length === 0) return "N/A";
  const wins = winList.filter(win => win === "true").length;
  const total = winList.length;
  return `${Math.round((wins / total) * 100)}%`;
}

function mostCommonRole(roles) {
  if (!roles) return "N/A";
  const roleCounts = roles.reduce((counts, role) => {
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
  const maxCount = Math.max(...Object.values(roleCounts));
  const mostCommonRoles = Object.keys(roleCounts).filter(role => roleCounts[role] === maxCount);
  return mostCommonRoles.includes("NA") || mostCommonRoles.includes("NONE") ? "N/A" : mostCommonRoles.join("/");
}

function calculateKDA(killsList, assistsList, deathsList) {
  const kills = sumArrayElements(killsList.map(k => (typeof k === 'string' ? k.split(",").map(Number) : [k])).flat());
  const assists = sumArrayElements(assistsList.map(a => (typeof a === 'string' ? a.split(",").map(Number) : [a])).flat());
  const deaths = sumArrayElements(deathsList.map(d => (typeof d === 'string' ? d.split(",").map(Number) : [d])).flat());
  return deaths === 0 ? "PERFECT" : ((kills + assists) / deaths).toFixed(2) + " KDA";
}

function toggleSidebar() {
  const sidebar = document.getElementById("infoSidebar");
  sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
}

const API_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
};

async function create(method, url, body) {
  try {
    const response = await fetch(url, {
      method,
      headers: API_HEADERS,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error in create function for ${method} ${url}:`, error);
    return null;
  }
}

async function getConfig() {
  try {
    const scriptPathMatch = getScriptPath()?.match(/\/([^/]+)\/index\.js$/);
    const configUrl = `https://plugins/${decodeURI(scriptPathMatch ? scriptPathMatch[1] : '')}/config.json`;
    const response = await fetch(configUrl);
    return await response.json();
  } catch {
    return { textchat: true, popup: true };
  }
}

function getScriptPath() {
  const scripts = document.getElementsByTagName('script');
  return scripts.length > 0 ? scripts[scripts.length - 1].src : '';
}

async function initializeApp() {
  try {
    await observeQueue(updateLobbyState);
  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

window.addEventListener("load", initializeApp);
