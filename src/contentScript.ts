import fuzzysort from "fuzzysort";
import type { BackgroundListener } from "./background";
import css from "./contentScript.css";

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

const getCurrentResultItem = () => {
  const resultItemsContainer = getShadowRootChild<HTMLElement>(
    "resultItemsContainer"
  );

  const currentResultItemm =
    resultItemsContainer.querySelector<ResultItemElement>(
      "[aria-current='true']"
    );

  if (!currentResultItemm) {
    throw new Error("cannot find current result item");
  }

  return currentResultItemm;
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
    e.code === "ArrowUp" ||
    (e.code === "Tab" && e.shiftKey) ||
    (e.altKey && e.key === "K");

  const moveDownTriggered =
    e.code === "ArrowDown" ||
    (e.code === "Tab" && !e.shiftKey) ||
    (e.altKey && e.key === "J");
  const goToTriggered = e.code === "Enter";
  const closeTabTriggered = e.altKey && e.key === "W";
  const closeTriggered = e.code === "Escape";

  if (closeTriggered) {
    nukeShadowRoot();
    restoreScroll();
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

    const currentResultItem = getCurrentResultItem();
    currentResultItem.ariaSelected = "true";
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
  const selectedResultItem = getSelectedResultItem();
  selectedResultItem.scrollIntoView({ block: "center" });
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
