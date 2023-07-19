const constants = {
  shadowRootId: "shadow-root",
  rootElementId: "root",
  inputId: "input",
  tabsNavId: "tabs-nav",
  tabItemId: "result-item",
  tabIconId: "tab-icon",
  tabTitleId: "tab-title",
  tabUrlId: "tab-url",
  highlightId: "highlight",

  goToTabType: "goToTab",
  newTabType: "newTab",

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
  selectedTabIndex: 0,
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
  shadowRoot.attachShadow({ mode: "open" });
  shadowRoot.shadowRoot.innerHTML = `<style>${css}</style>`;
  document.body.appendChild(shadowRoot);

  return shadowRoot;
};

const createRoot = () => {
  const rootElement = document.createElement("div");
  rootElement.id = constants.rootElementId;
  rootElement.ariaExpanded = "true";
  rootElement.addEventListener("click", function (e) {
    if (this === e.target) {
      nukeShadowRoot();
    }
  });

  return rootElement;
};

const createInput = () => {
  const input = document.createElement("input");
  input.tabIndex = 0;
  input.placeholder = "Enter a tab...";
  input.autocomplete = "off";
  input.id = constants.inputId;

  input.addEventListener("focusout", (e) => {
    e.target.focus();
  });

  return input;
};

const createTabsNav = () => {
  const tabsNav = document.createElement("nav");
  tabsNav.id = constants.tabsNavId;

  return tabsNav;
};

const createTabItem = (tab) => {
  const tabItem = document.createElement("a");
  tabItem.href = tab.url;
  tabItem.id = constants.tabItemId;
  tabItem.dataset.tabId = tab.id;
  tabItem.dataset.type = tab.type;

  tabItem.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(tab.id);
  });

  if (tab.id === globals.currentTabId) {
    tabItem.ariaCurrent = true;
  }

  return tabItem;
};

const createTabIcon = (iconSrc) => {
  const tabIcon = document.createElement("img");
  tabIcon.id = constants.tabIconId;
  tabIcon.src = iconSrc;

  return tabIcon;
};

const createTabTitle = (title) => {
  const tabTitle = document.createElement("span");
  tabTitle.id = constants.tabTitleId;
  tabTitle.innerHTML = title;

  return tabTitle;
};

const createTabUrl = (url) => {
  const tabUrl = document.createElement("span");
  tabUrl.id = constants.tabUrlId;
  tabUrl.innerHTML = url;

  return tabUrl;
};

const populateTabsNav = (tabs) => {
  nukeTabs();

  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);

  for (let i = 0; i < tabs.length; ++i) {
    const tab = tabs[i];

    const tabItem = createTabItem(tab);

    if (tab.favIconUrl) {
      const tabIcon = createTabIcon(tab.favIconUrl);
      tabItem.appendChild(tabIcon);
    }

    const tabTitle = createTabTitle(tab.title);
    tabItem.appendChild(tabTitle);

    const tabUrl = createTabUrl(tab.url);
    tabItem.appendChild(tabUrl);

    tabsNav.appendChild(tabItem);
  }

  showSelectedTabIndex(globals.selectedTabIndex);
};

const showSelectedTabIndex = (newIndex) => {
  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);

  if (tabsNav.childNodes.length < 1) {
    return;
  }

  const isAtStart = newIndex < 0;
  const isAtEnd = newIndex > tabsNav.childNodes.length - 1;

  const oldSelectedTabIndex = globals.selectedTabIndex;

  if (isAtStart) {
    globals.selectedTabIndex = tabsNav.childNodes.length - 1;
  }

  if (isAtEnd) {
    globals.selectedTabIndex = 0;
  }

  if (!isAtEnd && !isAtStart) {
    globals.selectedTabIndex = newIndex;
  }

  tabsNav.childNodes.item(oldSelectedTabIndex).ariaSelected = false;
  tabsNav.childNodes.item(globals.selectedTabIndex).ariaSelected = true;
  tabsNav.childNodes
    .item(globals.selectedTabIndex)
    .scrollIntoView({ block: "center" });
};

const inputKeyDownHandler = (e) => {
  const moveUpTriggered =
    e.code === constants.moveUpKeybind || (e.code === "Tab" && e.shiftKey);
  const moveDownTriggered =
    e.code === constants.moveDownKeybind || (e.code === "Tab" && !e.shiftKey);
  const goToTriggered = e.code === constants.goToKeybind;
  const closeTabTriggered = e.altKey && e.key === constants.closeTabKeybind;
  const closeTriggered = e.code === constants.closeKeybind;

  if (
    !moveUpTriggered &&
    !moveDownTriggered &&
    !goToTriggered &&
    !closeTabTriggered &&
    !closeTriggered
  ) {
    return;
  }

  if (closeTriggered) {
    nukeShadowRoot();
    return;
  }

  const tabsNav = getShadowRoot().getElementById(constants.tabsNavId);

  if (goToTriggered) {
    const tab = tabsNav.childNodes.item(globals.selectedTabIndex);

    if (tab.dataset.type === constants.newTabType) {
      createNewTab(tab.href);
    }

    if (tab.dataset.type === constants.goToTabType) {
      switchTab(+tab.dataset.tabId);
    }
  }

  if (closeTabTriggered) {
    closeTab(+tabsNav.childNodes.item(globals.selectedTabIndex).dataset.tabId);
  }

  if (moveUpTriggered) {
    e.preventDefault();

    showSelectedTabIndex(globals.selectedTabIndex - 1);
  }

  if (moveDownTriggered) {
    e.preventDefault();

    showSelectedTabIndex(globals.selectedTabIndex + 1);
  }
};

const inputInputHandler = (e, fuzzysort) => {
  globals.selectedTabIndex = 0;

  const tabs = globals.tabs
    .map((tab) => {
      const res = fuzzysort().single(e.target.value.trim(), tab.title.trim());
      const fuzzyOutput = fuzzysort().highlight(
        res,
        `<span id=${constants.highlightId}>`,
        "</span>"
      );

      if (!res && e.target.value) {
        return null;
      }

      return {
        ...tab,
        title: fuzzyOutput ?? tab.title,
        fuzzyScore: res?.score ?? 0,
        type: constants.goToTabType,
      };
    })
    .filter(Boolean)
    .filter((tab) => tab.fuzzyScore > -2_000)
    .sort((a, b) => b.fuzzyScore - a.fuzzyScore);

  if (tabs.length < 1) {
    populateTabsNav([
      {
        id: constants.newTabType,
        title: e.target.value,
        url: `${constants.webEngineUrl}${e.target.value}`,
        type: constants.newTabType,
      },
    ]);
  } else {
    populateTabsNav(tabs);
  }
};

const switchTab = (tabId) => {
  nukeShadowRoot();
  chrome.runtime.sendMessage({
    action: constants.switchTabId,
    options: { tabId },
  });
};

const closeTab = (tabId) => {
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

const removeScroll = () => {
  document.body.style.overflow = "hidden";
};

chrome.runtime.onMessage.addListener(async (request) => {
  const refreshTabsTriggered = request.action === "refreshTabs";
  const isOpen = document.getElementById(constants.shadowRootId);

  if (refreshTabsTriggered && isOpen) {
    globals.tabs = request.tabs;

    if (globals.selectedTabIndex > globals.tabs.length - 1) {
      globals.selectedTabIndex = globals.tabs.length - 1;
    }

    if (request.currentTabId) {
      globals.currentTabId = request.currentTabId;
    }

    populateTabsNav(
      request.tabs.map((tab) => ({ ...tab, type: constants.goToTabType }))
    );
  }

  const wantToOpen = request.action === "open";

  if (wantToOpen && isOpen) {
    nukeShadowRoot();
  }

  if (wantToOpen && !isOpen) {
    globals.tabs = request.tabs;
    globals.selectedTabIndex = 0;
    globals.currentTabId = request.currentTabId;

    await openRoot();
  }
});

const openRoot = async () => {
  const src = chrome.runtime.getURL("fuzzy.js");
  const { fuzzysort } = await import(src);

  removeScroll();

  const shadowRoot = createShadowRoot();
  const rootElement = createRoot();

  const input = createInput();
  input.addEventListener("keydown", inputKeyDownHandler);
  input.addEventListener("input", (e) => inputInputHandler(e, fuzzysort));

  const tabsNav = createTabsNav();

  rootElement.appendChild(input);
  rootElement.appendChild(tabsNav);
  shadowRoot.shadowRoot.appendChild(rootElement);

  populateTabsNav(
    globals.tabs.map((tab) => ({ ...tab, type: constants.goToTabType }))
  );
  input.focus();
};

const css = `
#${constants.rootElementId} {
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

  --gapp-xs: 8px;
  --gap: 16px;
  --gap-lg: 32px;
  --gap-xl: 48px;
}

@media (prefers-color-scheme: dark) {
  #${constants.rootElementId} {
    --text-muted: 0, 0%, 50%;
    --color: 0, 0%, 100%;
    --background: 0, 0%, 0%;
    --accent: 344, 95%, 77%;
    --new-tab: 90, 71%, 35%;
  }    
}

#${constants.rootElementId} {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background-color: #000000aa;
  backdrop-filter: blur(5px);
  color: hsl(var(--color));
  padding-top: var(--gap-xl);
  font: var(--font-size) "Fira Sans", sans-serif;
}

#${constants.rootElementId}[aria-expanded="false"] {
  display: none;
}

#${constants.rootElementId}[aria-expanded="true"] {
  display: flex;
  flex-direction: column;
  align-items: center;
}

#${constants.inputId} {
  font-size: var(--font-xl);
  border-radius: var(--radius);
  width: var(--width);
  padding: var(--gap) var(--gap-lg);
  color: hsl(var(--color));
  background-color: hsl(var(--background));
  box-sizing: border-box;

  border: none;
  outline: none;
}

#${constants.inputId}:focus {
  outline: var(--border-size) solid hsl(var(--accent));
}

#${constants.inputId}::placeholder {
  color: hsl(var(--text-muted));
}

#${constants.tabsNavId} {
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

#${constants.tabsNavId}::-webkit-scrollbar {
  display: none;
}

#${constants.tabItemId} {
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

#${constants.tabItemId}[aria-selected="true"],
#${constants.tabItemId}:focus {
  background-color: hsl(var(--color), 0.1);
  color: hsl(var(--accent), 0.8);
  outline: var(--border-size) solid hsl(var(--accent), 0.8);
  outline-offset: calc(var(--border-size) * -1);
}

#${constants.tabItemId}:first-child {
  padding-top: var(--gap-lg);
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

#${constants.tabItemId}:last-child {
  padding-bottom: var(--gap-lg);
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

#${constants.tabIconId}{
  width: var(--font-size);
  height: var(--font-size);
  border-radius: 50%;
  grid-column: 1 / 1;
}

#${constants.tabTitleId} {
  grid-column: 2 / 2;

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
  padding-bottom: var(--gap);

  font-size: var(--font-size-lg);
}

#${constants.tabItemId}[aria-current="true"] > #${constants.tabTitleId}::before {
  content: "* ";
  color: hsl(var(--accent));
}

#${constants.tabItemId}[data-type=${constants.newTabType}] > #${constants.tabTitleId}::before {
  content: "+ ";
  color: hsl(var(--accent));
}

#${constants.tabUrlId} {
  color: hsl(var(--text-muted));
  grid-column: 2 / 2;
  font-size: var(--font-size);

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
}

#${constants.highlightId} {
  text-decoration: hsl(var(--accent)) wavy underline;
}
`;
