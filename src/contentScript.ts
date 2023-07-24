import fuzzysort from "fuzzysort";
import type { BackgroundListener } from "./background";

const constants = {
  shadowRootId: "shadow-root",
  rootElementId: "root",
  inputFormId: "inputForm",
  inputId: "input",
  githubLinkId: "githubLink",
  resultItemsContainer: "result-items-container",
  resultItemId: "result-item",
  resultItemIconId: "result-item-icon",
  resultItemTitleId: "result-item-title",
  resultItemUrl: "result-item-url",
  highlightId: "highlight",

  openKeybind: "a",
  closeKeybind: "Escape",
  moveUpKeybind: "ArrowUp",
  moveDownKeybind: "ArrowDown",
  goToKeybind: "Enter",
  closeTabKeybind: "w",
} as const;

export type ResultItem = {
  type: "goTo" | "new" | "history";
  id: string;
  title: string;
  url: string;
  fuzzyScore: number;
  favIconUrl: string | null;
};

type ResultItemElement = HTMLAnchorElement & {
  dataset: Pick<ResultItem, "type">;
};

type Globals = {
  selectedResultItemId: ResultItem["id"] | null;
  currentResultItemId: ResultItem["id"] | null;
  historyResultItems: ResultItem[] | null;
};

const globals: Globals = {
  selectedResultItemId: null,
  currentResultItemId: null,
  historyResultItems: null,
};

const nukeShadowRoot = () => {
  const shadowRoot = document.getElementById(constants.shadowRootId);

  if (!shadowRoot) {
    throw new Error("shadow root not in document");
  }

  shadowRoot.remove();
};

const nukeResultItems = () => {
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  if (!resultItemsContainer) {
    return;
  }

  resultItemsContainer.replaceChildren();
};

const getShadowRoot = () => {
  const shadowRoot = document.getElementById(constants.shadowRootId);

  if (!shadowRoot) {
    throw new Error("shadow root not in document");
  }

  return shadowRoot.shadowRoot;
};

const getShadowRootChild = <T>(id: keyof typeof constants) => {
  const child = getShadowRoot()?.getElementById(constants[id]);

  if (!child) {
    throw new Error(`${id} no in shadow root`);
  }

  return child as T;
};

const getSelectedResultItem = () => {
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  const selectedResultItem =
    resultItemsContainer.querySelector<ResultItemElement>(
      "[aria-selected='true']"
    );

  if (!selectedResultItem) {
    throw new Error("cannot find selectedTab");
  }

  return selectedResultItem;
};

const createShadowRoot = () => {
  const shadowRoot = document.createElement("div");
  shadowRoot.id = constants.shadowRootId;
  shadowRoot.className = constants.shadowRootId;
  shadowRoot.attachShadow({ mode: "open" });

  if (!shadowRoot.shadowRoot) {
    throw new Error("shadow root not open");
  }

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
  form.addEventListener("submit", (e) => e.preventDefault());

  return form;
};

const convertResultItemIdToTabId = (resultItemId: ResultItem["id"]) => {
  return +resultItemId.split("-")[2];
};

const createInput = () => {
  const input = document.createElement("input");
  input.tabIndex = 0;
  input.placeholder = "Enter a tab...";
  input.autocomplete = "off";
  input.id = constants.inputId;
  input.className = constants.inputId;
  input.addEventListener("keydown", inputKeyDownHandler);
  input.addEventListener("input", inputInputHandler);

  input.addEventListener("focusout", (e) => {
    if (e.target instanceof HTMLElement) {
      e.target.focus();
    }
  });

  return input;
};

const inputInputHandler = async (e: Event) => {
  e.stopPropagation();
  globals.selectedResultItemId = null;

  await getFreshTabs();
};

const inputKeyDownHandler = async (e: KeyboardEvent) => {
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

  const selectedResultItem = getSelectedResultItem();

  if (goToTriggered && selectedResultItem.dataset.type === "new") {
    await createNewTab(selectedResultItem.href);
    nukeShadowRoot();
  }

  if (goToTriggered && selectedResultItem.dataset.type === "history") {
    await createNewTab(selectedResultItem.href);
    nukeShadowRoot();
  }

  if (goToTriggered && selectedResultItem.dataset.type === "goTo") {
    const tabId = convertResultItemIdToTabId(selectedResultItem.id);
    await goToTab(tabId);
    nukeShadowRoot();
  }

  if (closeTabTriggered && selectedResultItem.dataset.type === "goTo") {
    const tabId = convertResultItemIdToTabId(selectedResultItem.id);
    const input = getShadowRootChild<HTMLInputElement>("inputId");

    if (selectedResultItem.nextElementSibling) {
      globals.selectedResultItemId = selectedResultItem.nextElementSibling.id;
    } else {
      if (selectedResultItem.previousElementSibling)
        globals.selectedResultItemId =
          selectedResultItem.previousElementSibling.id;
    }

    await closeTab(tabId, input.value);
  }

  if (moveUpTriggered) {
    e.preventDefault();
    selectResultItemAbove();
    scrollToSelectedResultItem();
  }

  if (moveDownTriggered) {
    e.preventDefault();
    selectResultItemBelow();
    scrollToSelectedResultItem();
  }
};

const selectResultItemBelow = () => {
  const selectedResultItem = getSelectedResultItem();
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  if (!resultItemsContainer.firstElementChild) {
    return;
  }

  const isAtEnd = !selectedResultItem.nextElementSibling;

  if (isAtEnd) {
    selectedResultItem.ariaSelected = "false";
    resultItemsContainer.firstElementChild.ariaSelected = "true";
    globals.selectedResultItemId = resultItemsContainer.firstElementChild.id;
  }

  if (!isAtEnd) {
    selectedResultItem.ariaSelected = "false";
    selectedResultItem.nextElementSibling.ariaSelected = "true";
    globals.selectedResultItemId = selectedResultItem.nextElementSibling.id;
  }
};

const selectResultItemAbove = () => {
  const selectedResultItem = getSelectedResultItem();
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  if (!resultItemsContainer.lastElementChild) {
    return;
  }

  const isAtStart = !selectedResultItem.previousElementSibling;

  if (isAtStart) {
    selectedResultItem.ariaSelected = "false";
    resultItemsContainer.lastElementChild.ariaSelected = "true";
    globals.selectedResultItemId = resultItemsContainer.lastElementChild.id;
  }

  if (!isAtStart) {
    selectedResultItem.ariaSelected = "false";
    selectedResultItem.previousElementSibling.ariaSelected = "true";
    globals.selectedResultItemId = selectedResultItem.previousElementSibling.id;
  }
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

const createResultItemsContainer = () => {
  const resultItemsContainer = document.createElement("nav");
  resultItemsContainer.id = constants.resultItemsContainer;
  resultItemsContainer.className = constants.resultItemsContainer;

  return resultItemsContainer;
};

const createResultItem = (resultItem: ResultItem) => {
  const resultItemElement = document.createElement("a");

  resultItemElement.href = resultItem.url;
  resultItemElement.id = `${constants.resultItemId}-${resultItem.id}`;
  resultItemElement.className = constants.resultItemId;
  resultItemElement.dataset.type = resultItem.type;
  resultItemElement.addEventListener("click", (e) => e.preventDefault());
  resultItemElement.addEventListener("keydown", (e) => e.preventDefault());

  if (globals.currentResultItemId === resultItemElement.id) {
    resultItemElement.ariaCurrent = "true";
  }

  if (globals.selectedResultItemId === resultItemElement.id) {
    resultItemElement.ariaSelected = "true";
  }

  return resultItemElement;
};

const createResultItemIcon = (resultItem: ResultItem) => {
  const resultItemIcon = document.createElement("img");
  resultItemIcon.id = `${constants.resultItemIconId}-${resultItem.id}`;
  resultItemIcon.className = constants.resultItemIconId;
  resultItemIcon.src = resultItem.favIconUrl ?? "";

  return resultItemIcon;
};

const createResultItemTitle = (resultItem: ResultItem) => {
  const resultItemTitle = document.createElement("span");
  resultItemTitle.id = `${constants.resultItemTitleId}-${resultItem.id}`;
  resultItemTitle.className = constants.resultItemTitleId;
  resultItemTitle.innerHTML = resultItem.title;

  return resultItemTitle;
};

const createResultItemUrl = (resultItem: ResultItem) => {
  const resultItemUrl = document.createElement("span");
  resultItemUrl.id = `${constants.resultItemUrl}-${resultItem.id}`;
  resultItemUrl.className = constants.resultItemUrl;
  resultItemUrl.innerHTML = resultItem.url;

  return resultItemUrl;
};

const removeScroll = () => {
  document.body.style.overflow = "hidden";
};

const restoreScroll = () => {
  document.body.style.overflow = "auto";
};

const getNewTab = () => {
  const input = getShadowRootChild<HTMLInputElement>("inputId");
  const webEngineUrl = "https://www.google.com/search?q=";

  let url = `${webEngineUrl}${input.value}`;

  if (input.value.startsWith("http")) {
    url = `${input.value}`;
  }

  if (input.value.indexOf(".") !== -1) {
    url = `https://${input.value}`;
  }

  if (input.value.indexOf(":") !== -1) {
    url = `${input.value}`;
  }

  return {
    id: "new-tab",
    title: input.value,
    type: "new" as const,
    url,
    fuzzyScore: -1,
    favIconUrl: "",
  };
};

type OpenRequest = {
  action: "open";
  currentTabId: NonNullable<chrome.tabs.Tab["id"]>;
  resultItems: ResultItem[];
};

type RefreshRequest = {
  action: "refresh";
  resultItems: ResultItem[];
};

type GetFreshTabsRequest = {
  action: "getFreshTabs";
  resultItems: ResultItem[];
};

export type ContentScriptRequest =
  | OpenRequest
  | RefreshRequest
  | GetFreshTabsRequest;

chrome.runtime.onMessage.addListener(async (request: ContentScriptRequest) => {
  const refreshTabs = request.action === "refresh";
  const wantToOpen = request.action === "open";
  const getFreshTabs = request.action === "getFreshTabs";
  const isOpen = document.getElementById(constants.shadowRootId);

  if (wantToOpen && !isOpen) {
    globals.selectedResultItemId = null;
    globals.historyResultItems = null;
    globals.currentResultItemId = `${constants.resultItemId}-${request.currentTabId}`;

    removeScroll();
    openRoot();

    const filteredItems = filterResultItems(request.resultItems);

    populateResultItemsContainer(filteredItems);

    selectFirstResultItem();
    scrollToSelectedResultItem();
  }

  if (getFreshTabs && isOpen) {
    globals.selectedResultItemId = null;
    globals.historyResultItems = request.resultItems.filter(
      (item) => item.type === "history"
    );

    const filteredItems = filterResultItems(request.resultItems);
    const sortedAndFilteredItems = sortResultItems(filteredItems);

    const input = getShadowRootChild<HTMLInputElement>("inputId");
    if (input.value.trim().length > 0) {
      populateResultItemsContainer([...sortedAndFilteredItems, getNewTab()]);
    } else {
      populateResultItemsContainer(sortedAndFilteredItems);
    }

    selectFirstResultItem();
    scrollToSelectedResultItem();
  }

  if (refreshTabs && isOpen) {
    const filteredItems = filterResultItems([
      ...request.resultItems,
      ...(globals.historyResultItems ?? []),
    ]);
    const sortedAndFilteredItems = sortResultItems(filteredItems);

    const input = getShadowRootChild<HTMLInputElement>("inputId");
    if (input.value.trim().length > 0) {
      populateResultItemsContainer([...sortedAndFilteredItems, getNewTab()]);
    } else {
      populateResultItemsContainer(sortedAndFilteredItems);
    }

    scrollToSelectedResultItem();
  }

  if (wantToOpen && isOpen) {
    nukeShadowRoot();
    restoreScroll();
  }
});

const selectFirstResultItem = () => {
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );
  const firstChild = resultItemsContainer.firstElementChild;

  if (firstChild) {
    firstChild.ariaSelected = "true";
    globals.selectedResultItemId = firstChild.id;
  }
};

const scrollToSelectedResultItem = () => {
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  const selectedTab = resultItemsContainer.querySelector(
    "[aria-selected='true']"
  );

  if (selectedTab) {
    selectedTab.scrollIntoView({ block: "center" });
  }
};

const filterResultItems = (resultItems: ResultItem[]): ResultItem[] => {
  const input = getShadowRootChild<HTMLInputElement>("inputId");
  const inputValue = input.value.trim();

  if (!inputValue) {
    return resultItems;
  }

  return resultItems
    .map((tab) => {
      const res = fuzzysort.single(inputValue, tab.title.trim());

      if (!res) {
        return null;
      }

      const fuzzyOutput = fuzzysort.highlight(
        res,
        `<span class=${constants.highlightId}>`,
        "</span>"
      );

      if (res.score < -2_000 || !fuzzyOutput) {
        return null;
      }

      return {
        ...tab,
        title: fuzzyOutput,
      };
    })
    .filter(Boolean) as ResultItem[];
};

const sortResultItems = (resultItem: ResultItem[]) => {
  return resultItem.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "goTo" ? -1 : 1;
    }

    return b.fuzzyScore - a.fuzzyScore;
  });
};

const populateResultItemsContainer = (resultItems: ResultItem[]) => {
  nukeResultItems();

  for (const resultItem of resultItems) {
    const resultItemElement = createResultItem(resultItem);

    if (resultItem.favIconUrl) {
      const resultItemIcon = createResultItemIcon(resultItem);
      resultItemElement.appendChild(resultItemIcon);
    }

    const resultItemTitle = createResultItemTitle(resultItem);
    resultItemElement.appendChild(resultItemTitle);

    const resultItemUrl = createResultItemUrl(resultItem);
    resultItemElement.appendChild(resultItemUrl);

    const resultItemsContainer = getShadowRootChild<HTMLElement>(
      "resultItemsContainer"
    );
    resultItemsContainer.appendChild(resultItemElement);
  }
};

const openRoot = () => {
  const shadowRoot = createShadowRoot();
  const rootElement = createRoot();

  const input = createInput();

  const githubLink = createGithubLink();

  const inputForm = createInputForm();
  inputForm.appendChild(input);
  inputForm.appendChild(githubLink);

  const resultItemsContainer = createResultItemsContainer();

  rootElement.appendChild(inputForm);
  rootElement.appendChild(resultItemsContainer);

  if (!shadowRoot.shadowRoot) {
    throw new Error("no shadow in shadow root element");
  }

  shadowRoot.shadowRoot.appendChild(rootElement);

  input.focus();
};

const createNewTab = async (url: string) => {
  await chrome.runtime.sendMessage<BackgroundListener>({
    action: "newTab",
    options: { url },
  });
};

const goToTab = async (tabId: NonNullable<chrome.tabs.Tab["id"]>) => {
  await chrome.runtime.sendMessage<BackgroundListener>({
    action: "goTo",
    options: { tabId },
  });
};

const getFreshTabs = async () => {
  const input = getShadowRootChild<HTMLInputElement>("inputId");

  await chrome.runtime.sendMessage<BackgroundListener>({
    action: "getFreshTabs",
    options: { input: input.value },
  });
};

const closeTab = async (
  tabId: NonNullable<chrome.tabs.Tab["id"]>,
  input: string
) => {
  await chrome.runtime.sendMessage<BackgroundListener>({
    action: "close",
    options: { tabId, input },
  });
};

//FIXME: encapsulate
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
  pointer-events: none;
}

.${constants.githubLinkId}:hover::after {
  opacity: 1;
  transition-delay: 1000ms;
  pointer-events: auto;
}

.${constants.resultItemsContainer} {
  margin: var(--gap-xl) 0;
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

.${constants.resultItemsContainer}::-webkit-scrollbar {
  display: none;
}

.${constants.resultItemId} {
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

.${constants.resultItemId}[aria-selected="true"],
.${constants.resultItemId}:focus {
  background-color: hsl(var(--color), 0.1);
  color: hsl(var(--accent), 0.8);
  outline: var(--border-size) solid hsl(var(--accent), 0.8);
  outline-offset: calc(var(--border-size) * -1);
}

.${constants.resultItemId}:first-child {
  padding-top: var(--gap-lg);
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.${constants.resultItemId}:last-child {
  padding-bottom: var(--gap-lg);
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

.${constants.resultItemIconId}{
  width: var(--font-size);
  height: var(--font-size);
  border-radius: 50%;
  grid-column: 1 / 1;
}

.${constants.resultItemTitleId} {
  grid-column: 2 / 2;

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
  padding-bottom: var(--gap);

  font-size: var(--font-size-lg);
}

.${constants.resultItemId}[aria-current="true"] > .${constants.resultItemTitleId}::before {
  content: "👉 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.resultItemId}[data-type=new] > .${constants.resultItemTitleId}::before {
  content: "🔍 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.resultItemId}[data-type=history] > .${constants.resultItemTitleId}::before {
  content: "🕛 ";
  color: hsl(var(--accent));
  font-size: var(--font-size);
}

.${constants.resultItemUrl} {
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
