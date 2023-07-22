const constants = {
  shadowRootId: "shadow-root",
  rootElementId: "root",
  inputFormId: "inputForm",
  inputId: "input",
  githubLinkId: "githubLink",
  tabsNavId: "tabs-nav",
  tabItemId: "result-item",
  tabIconId: "tab-icon",
  tabTitleId: "tab-title",
  tabUrlId: "tab-url",
  highlightId: "highlight",

  goToTabType: "goToTab",
  newTabType: "newTab",
  historyTabType: "historyTabType",

  openKeybind: "a",
  closeKeybind: "Escape",
  moveUpKeybind: "ArrowUp",
  moveDownKeybind: "ArrowDown",
  goToKeybind: "Enter",
  closeTabKeybind: "w",

  switchTabId: "switchTab",
  getTabs: "getTabs",
  closeTab: "closeTab",
  createNewTabAction: "createNewTab",

  webEngineUrl: "https://www.google.com/search?q=",
};

const globals = {
  tabs: [],
  historyTabs: [],
  selectedTabId: null,
  currentTabId: null,
};

const nukeShadowRoot = () => {
  const rootElement = document.getElementById(constants.shadowRootId);

  if (!rootElement) {
    return;
  }

  rootElement.remove();
  document.body.style.overflow = "auto";
};

const nukeTabs = () => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);

  if (!tabsNav) {
    return;
  }

  tabsNav.replaceChildren();
};

const getShadowRoot = () => {
  const shadowRoot = document.getElementById(constants.shadowRootId);

  if (!shadowRoot) {
    return;
  }

  return shadowRoot.shadowRoot;
};

const createShadowRoot = () => {
  const shadowRoot = document.createElement("div");
  shadowRoot.id = constants.shadowRootId;
  shadowRoot.className = constants.shadowRootId;
  shadowRoot.attachShadow({ mode: "open" });
  shadowRoot.shadowRoot.innerHTML = `<style>${css}</style>`;
  document.body.appendChild(shadowRoot);

  return shadowRoot;
};

const createRoot = () => {
  const rootElement = document.createElement("div");
  rootElement.id = constants.rootElementId;
  rootElement.className = constants.rootElementId;
  rootElement.ariaExpanded = "true";
  rootElement.addEventListener("click", function (e) {
    if (this === e.target) {
      nukeShadowRoot();
    }
  });

  return rootElement;
};

const createInputForm = () => {
  const form = document.createElement("form");
  form.id = constants.inputFormId;
  form.className = constants.inputFormId;

  return form;
};

const createInput = () => {
  const input = document.createElement("input");
  input.tabIndex = 0;
  input.placeholder = "Enter a tab...";
  input.autocomplete = "off";
  input.id = constants.inputId;
  input.className = constants.inputId;

  input.addEventListener("focusout", (e) => {
    e.target.focus();
  });

  return input;
};

const createGithubLink = () => {
  const githubLink = document.createElement("a");
  githubLink.id = constants.githubLinkId;
  githubLink.className = constants.githubLinkId;
  githubLink.href = "https://github.com/augustinsorel/tab-picker";
  githubLink.dataset.tooltip = "github";
  githubLink.target = "_blank";
  githubLink.innerHTML = `
    <svg 
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.93 4.93 4.24 4.24"/>
        <path d="m14.83 9.17 4.24-4.24"/>
        <path d="m14.83 14.83 4.24 4.24"/>
        <path d="m9.17 14.83-4.24 4.24"/>
        <circle cx="12" cy="12" r="4"/>
    </svg>    
  `;

  return githubLink;
};

const createTabsNav = () => {
  const tabsNav = document.createElement("nav");
  tabsNav.id = constants.tabsNavId;
  tabsNav.className = constants.tabsNavId;

  return tabsNav;
};

const createTabItem = (tab) => {
  const tabItem = document.createElement("a");
  tabItem.href = tab.url;
  tabItem.id = `${constants.tabItemId}-${tab.id}`;
  tabItem.className = constants.tabItemId;
  tabItem.dataset.type = tab.type;

  tabItem.addEventListener("click", (e) => {
    e.preventDefault();
  });

  if (tab.id === globals.currentTabId) {
    tabItem.ariaCurrent = true;
  }

  if (tab.id === globals.selectedTabId) {
    tabItem.ariaSelected = true;
  }

  return tabItem;
};

const createTabIcon = (tab) => {
  const tabIcon = document.createElement("img");
  tabIcon.id = `${constants.tabIconId}-${tab.id}`;
  tabIcon.className = constants.tabIconId;
  tabIcon.src = tab.favIconUrl;

  return tabIcon;
};

const createTabTitle = (tab) => {
  const tabTitle = document.createElement("span");
  tabTitle.id = `${constants.tabTitleId}-${tab.id}`;
  tabTitle.className = constants.tabTitleId;
  tabTitle.innerHTML = tab.title;

  return tabTitle;
};

const createTabUrl = (tab) => {
  const tabUrl = document.createElement("span");
  tabUrl.id = `${constants.tabUrlId}-${tab.id}`;
  tabUrl.className = constants.tabUrlId;
  tabUrl.innerHTML = tab.url;

  return tabUrl;
};

const populateTabsNav = async () => {
  const goToTabs = globals.tabs.map((tab) => ({
    ...tab,
    type: constants.goToTabType,
  }));

  const historyTabs = globals.historyTabs.map((tab) => ({
    ...tab,
    type: constants.historyTabType,
  }));

  const highlightedTabs = await highlightTabsTitle([
    ...goToTabs,
    ...historyTabs,
  ]);

  const filteredTabs = filterTabs(highlightedTabs);
  const sortedTabs = sortTabs(filteredTabs);

  const newTab = getNewTab();
  const tabs = [...sortedTabs, newTab];

  nukeTabs();

  for (const tab of tabs) {
    if (!tab.title) {
      continue;
    }

    const tabItem = createTabItem(tab);

    if (tab.favIconUrl) {
      const tabIcon = createTabIcon(tab);
      tabItem.appendChild(tabIcon);
    }

    const tabTitle = createTabTitle(tab);
    tabItem.appendChild(tabTitle);

    const tabUrl = createTabUrl(tab);
    tabItem.appendChild(tabUrl);

    const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
    tabsNav.appendChild(tabItem);
  }

  scrollToSelectedTab();
};

const selectTabItemBelow = () => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
  const selectedTab = tabsNav.querySelector("[aria-selected='true']");

  selectedTab.ariaSelected = false;

  if (!selectedTab.nextSibling) {
    tabsNav.firstChild.ariaSelected = true;
    globals.selectedTabId = getTabIdFromTabItem(tabsNav.firstChild);
  } else {
    selectedTab.nextSibling.ariaSelected = true;
    globals.selectedTabId = getTabIdFromTabItem(selectedTab.nextSibling);
  }

  scrollToSelectedTab();
};

const selectTabItemAbove = () => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
  const selectedTab = tabsNav.querySelector("[aria-selected='true']");

  selectedTab.ariaSelected = false;

  if (!selectedTab.previousSibling) {
    tabsNav.lastChild.ariaSelected = true;
    globals.selectedTabId = getTabIdFromTabItem(tabsNav.lastChild);
  } else {
    selectedTab.previousSibling.ariaSelected = true;
    globals.selectedTabId = getTabIdFromTabItem(selectedTab.previousSibling);
  }

  scrollToSelectedTab();
};

const inputKeyDownHandler = (e) => {
  e.stopPropagation();

  const moveUpTriggered =
    e.code === constants.moveUpKeybind || (e.code === "Tab" && e.shiftKey);
  const moveDownTriggered =
    e.code === constants.moveDownKeybind || (e.code === "Tab" && !e.shiftKey);
  const goToTriggered = e.code === constants.goToKeybind;
  const closeTabTriggered = e.altKey && e.key === constants.closeTabKeybind;
  const closeTriggered = e.code === constants.closeKeybind;

  if (closeTriggered) {
    nukeShadowRoot();
    return;
  }

  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
  const selectedTab = tabsNav.querySelector("[aria-selected='true']");

  if (goToTriggered && selectedTab.dataset.type === constants.newTabType) {
    createNewTab(selectedTab.href);
  }

  if (goToTriggered && selectedTab.dataset.type === constants.historyTabType) {
    createNewTab(selectedTab.href);
  }

  if (goToTriggered && selectedTab.dataset.type === constants.goToTabType) {
    switchTab(globals.selectedTabId);
  }

  if (closeTabTriggered && selectedTab.dataset.type === constants.goToTabType) {
    closeTab(globals.selectedTabId);
  }

  if (moveUpTriggered) {
    e.preventDefault();
    selectTabItemAbove();
  }

  if (moveDownTriggered) {
    e.preventDefault();
    selectTabItemBelow();
  }
};

const scrollToSelectedTab = () => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
  const selectedTab = tabsNav.querySelector("[aria-selected='true']");

  if (!selectedTab) {
    tabsNav.firstChild.ariaSelected = true;
    tabsNav.firstChild.scrollIntoView({ block: "center" });
    return;
  }

  selectedTab.scrollIntoView({ block: "center" });
};

const getTabIdFromTabItem = (tab) => {
  return +tab.id.split("-")[2];
};

const inputInputHandler = async (e) => {
  e.stopPropagation();

  readHistory();
};

const highlightTabsTitle = async (tabs) => {
  const src = chrome.runtime.getURL("fuzzy.js");
  const { fuzzysort } = await import(src);

  const input = getShadowRoot().getElementById(constants.inputId);
  const inputValue = input.value.trim();

  if (!inputValue) {
    return tabs;
  }

  return tabs.map((tab) => {
    const res = fuzzysort().single(inputValue, tab.title.trim());
    const fuzzyOutput = fuzzysort().highlight(
      res,
      `<span class=${constants.highlightId}>`,
      "</span>"
    );

    if (!res) {
      return null;
    }

    return {
      ...tab,
      title: fuzzyOutput,
      fuzzyScore: res.score,
    };
  });
};

const filterTabs = (tabs) => {
  const input = getShadowRoot().getElementById(constants.inputId);
  const inputValue = input.value.trim();

  if (!inputValue) {
    return tabs;
  }

  return tabs.filter(Boolean).filter((tab) => tab.fuzzyScore > -2_000);
};

const sortTabs = (tabs) => {
  return tabs.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === constants.goToTabType ? -1 : 1;
    }

    return b.fuzzyScore - a.fuzzyScore;
  });
};

const switchTab = (tabId) => {
  nukeShadowRoot();
  chrome.runtime.sendMessage({
    action: constants.switchTabId,
    options: { tabId },
  });
};

const closeTab = (tabId) => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);
  const selectedTab = tabsNav.querySelector("[aria-selected='true']");

  if (!selectedTab.nextSibling) {
    globals.selectedTabId = getTabIdFromTabItem(selectedTab.previousSibling);
  } else {
    globals.selectedTabId = getTabIdFromTabItem(selectedTab.nextSibling);
  }

  chrome.runtime.sendMessage({
    action: constants.closeTab,
    options: { tabId },
  });
};

const createNewTab = (url) => {
  nukeShadowRoot();

  chrome.runtime.sendMessage({
    action: constants.createNewTabAction,
    options: { url },
  });
};

const readHistory = () => {
  const input = getShadowRoot().getElementById(constants.inputId);

  chrome.runtime.sendMessage({
    action: "getHistory",
    options: { input: input.value },
  });
};

const removeScroll = () => {
  document.body.style.overflow = "hidden";
};

const getNewTab = () => {
  const input = getShadowRoot().getElementById(constants.inputId);

  let url = `${constants.webEngineUrl}${input.value}`;

  if (input.value.startsWith("http")) {
    url = `${input.value}`;
  }

  if (input.value.split("").includes(".")) {
    url = `https://${input.value}`;
  }

  if (input.value.split("").includes(":")) {
    url = `https://${input.value}`;
  }

  const newTab = {
    title: input.value,
    type: constants.newTabType,
    url,
  };

  return newTab;
};

chrome.runtime.onMessage.addListener(async (request) => {
  const refreshTabsTriggered = request.action === "refreshTabs";
  const isOpen = document.getElementById(constants.shadowRootId);
  const wantToOpen = request.action === "open";

  if (refreshTabsTriggered && isOpen) {
    globals.tabs = request.tabs;

    if (request.currentTabId) {
      globals.currentTabId = request.currentTabId;
    }

    populateTabsNav();
  }

  if (wantToOpen && isOpen) {
    nukeShadowRoot();
  }

  if (wantToOpen && !isOpen) {
    globals.tabs = request.tabs;
    globals.currentTabId = request.currentTabId;

    openRoot();
  }

  if (request.action === "showHistory") {
    globals.historyTabs = request.history;

    populateTabsNav();
  }
});

const openRoot = () => {
  removeScroll();

  const shadowRoot = createShadowRoot();
  const rootElement = createRoot();

  const input = createInput();
  input.addEventListener("keydown", inputKeyDownHandler);
  input.addEventListener("input", inputInputHandler);

  const githubLink = createGithubLink();

  const inputForm = createInputForm();
  inputForm.appendChild(input);
  inputForm.appendChild(githubLink);

  const tabsNav = createTabsNav();

  rootElement.appendChild(inputForm);
  rootElement.appendChild(tabsNav);
  shadowRoot.shadowRoot.appendChild(rootElement);

  populateTabsNav();
  input.focus();
};

const css = `
*{
  box-sizing: border-box;
}

.${constants.rootElementId} {
  --text-muted: 0, 0%, 50%;
  --color: 0, 0%, 0%;
  --background: 0, 0%, 100%;
  --accent: 344, 95%, 77%;
  --new-tab: 90, 71%, 35%;

  --width: min(90%, 800px);
  --radius: 8px;
  --border-size: 2px;

  --font-size-small: 8px;
  --font-size: 16px;
  --font-size-lg: 24px;
  --font-xl: 32px;

  --gap-xs: 8px;
  --gap: 16px;
  --gap-lg: 32px;
  --gap-xl: 48px;
}

@media (prefers-color-scheme: dark) {
  .${constants.rootElementId} {
    --text-muted: 0, 0%, 50%;
    --color: 0, 0%, 100%;
    --background: 0, 0%, 0%;
    --accent: 344, 95%, 77%;
    --new-tab: 90, 71%, 35%;
  }    
}

.${constants.rootElementId} {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background-color: #000000aa;
  backdrop-filter: blur(5px);
  color: hsl(var(--color));
  padding-top: var(--gap-xl);
  font: var(--font-size) "Fira Sans", sans-serif;
}

.${constants.rootElementId}[aria-expanded="false"] {
  display: none;
}

.${constants.rootElementId}[aria-expanded="true"] {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.${constants.inputFormId} {
  background-color: hsl(var(--background));
  border-radius: var(--radius);
  width: var(--width);
  min-height: 75px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--gap-lg);
}


.${constants.inputFormId}:focus-within {
  outline: var(--border-size) solid hsl(var(--accent));
 }


.${constants.inputId} {
  font-size: var(--font-xl);
  color: hsl(var(--color));
  background-color:transparent;

  border: none;
  outline: none;
}

.${constants.inputId}::placeholder {
  color: hsl(var(--text-muted));
}

.${constants.githubLinkId} {
  padding:1rem;
  border-radius: inherit;
  color: hsl(var(--text-muted));
  outline: var(--border-size) solid transparent;
  transition-property: color, background-color, outline-color;
  transition-duration: 200ms;
  transition-timing-function: ease;
  position: relative;
  isolation: isolate;
}

.${constants.githubLinkId} svg {
  stroke: currentColor;
  stroke-width: var(--border-size);
  height: 24px;
  width: 24px;
  display:flex;
  justify-content: center;
  align-items: center;
}

.${constants.githubLinkId}:hover {
  color: hsl(var(--accent), 0.8);
  background-color: hsl(var(--color), 0.1);
  outline: var(--border-size) solid;
  outline-color:currentColor;
}

.${constants.githubLinkId}::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: -50px;
  left: 50%;
  translate: -50%;
  padding: var(--gap-xs) var(--gap);
  z-index: 200;
  background-color: hsl(var(--background));
  white-space:nowrap;
  border-radius: inherit;
  border: var(--border-size) solid currentColor;
  opacity: 0;
  transition: opacity 200ms ease;
  font-weight: 500;
  text-transform: capitalize;
}

.${constants.githubLinkId}:hover::after {
  opacity: 1;
  transition-delay: 1000ms;
}

.${constants.tabsNavId} {
  margin: var(--gap-xl) var(--gap);
  background-color: white;
  color: black;
  list-style: none;
  display: flex;
  overflow: auto;
  flex-direction: column;
  border-radius: var(--radius);
  width: var(--width);
  background-color: hsl(var(--background));
}

.${constants.tabsNavId}::-webkit-scrollbar {
  display: none;
}

.${constants.tabItemId} {
  font-size: var(--font-size-lg);
  text-decoration: none;
  display: grid;
  grid-template-columns: var(--gap) 1fr;
  align-items: center;
  padding: var(--gap) var(--gap-lg);
  gap: 0 var(--gap);
  position: relative;

  border: none;
  outline: none;
  color: hsl(var(--color), 0.75);
}

.${constants.tabItemId}[aria-selected="true"],
.${constants.tabItemId}:focus {
  background-color: hsl(var(--color), 0.1);
  color: hsl(var(--accent), 0.8);
  outline: var(--border-size) solid hsl(var(--accent), 0.8);
  outline-offset: calc(var(--border-size) * -1);
}

.${constants.tabItemId}:first-child {
  padding-top: var(--gap-lg);
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.${constants.tabItemId}:last-child {
  padding-bottom: var(--gap-lg);
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

.${constants.tabIconId}{
  width: var(--font-size);
  height: var(--font-size);
  border-radius: 50%;
  grid-column: 1 / 1;
}

.${constants.tabTitleId} {
  grid-column: 2 / 2;

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
  padding-bottom: var(--gap);

  font-size: var(--font-size-lg);
}

.${constants.tabItemId}[aria-current="true"] > .${constants.tabTitleId}::before {
  content: "👉 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.tabItemId}[data-type=${constants.newTabType}] > .${constants.tabTitleId}::before {
  content: "🔍 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.tabItemId}[data-type=${constants.historyTabType}] > .${constants.tabTitleId}::before {
  content: "🕛 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.tabUrlId} {
  color: hsl(var(--text-muted));
  grid-column: 2 / 2;
  font-size: var(--font-size);

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
}

.${constants.highlightId} {
  text-decoration: hsl(var(--accent)) wavy underline;
}
`;
