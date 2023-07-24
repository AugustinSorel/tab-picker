import type { ContentScriptRequest, ResultItem } from "./contentScript";

const getAllTabs = () => {
  return chrome.tabs.query({}) ?? [];
};

const getCurrentTab = async () => {
  let [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  return tab;
};

const getHistory = (text: string) => {
  const lastWeeekTime = new Date().setDate(new Date().getDate() - 7);

  return chrome.history.search({ text, startTime: lastWeeekTime });
};

const transformTabsToGoToResultItems = (tabs: chrome.tabs.Tab[]) => {
  return tabs.map((tab) => ({
    fuzzyScore: -1,
    type: "goTo" as const,
    id: (tab.id ?? "").toString(),
    title: tab.title ?? "Not Specified",
    url: tab.url ?? "",
    favIconUrl: tab.favIconUrl ?? "",
  }));
};

const transformTabsToHistoryResultItems = (
  tabs: chrome.history.HistoryItem[]
) => {
  return tabs.map((tab) => ({
    fuzzyScore: -1,
    type: "history" as const,
    id: tab.id,
    title: tab.title ?? "Not Specified",
    url: tab.url ?? "",
    favIconUrl: "",
  }));
};

type GoTo = {
  action: "goTo";
  options: {
    tabId: NonNullable<chrome.tabs.Tab["id"]>;
  };
};

type Close = {
  action: "close";
  options: {
    tabId: NonNullable<chrome.tabs.Tab["id"]>;
    input: string;
  };
};

type NewTab = {
  action: "newTab";
  options: {
    url: string;
  };
};

type GetFreshTabs = {
  action: "getFreshTabs";
  options: {
    input: string;
  };
};

export type BackgroundListener = GoTo | Close | NewTab | GetFreshTabs;

chrome.tabs.onRemoved.addListener(async () => {
  const tabs = await getAllTabs();
  const currentTab = await getCurrentTab();

  if (
    !currentTab.id ||
    !currentTab.url ||
    currentTab.url?.startsWith("chrome://")
  ) {
    return;
  }

  await chrome.tabs.sendMessage<ContentScriptRequest>(currentTab.id, {
    action: "refresh",
    resultItems: transformTabsToGoToResultItems(tabs),
  });
});

chrome.tabs.onActivated.addListener(async () => {
  const tabs = await getAllTabs();

  const currentTab = await getCurrentTab();

  if (
    !currentTab.url ||
    currentTab.url?.startsWith("chrome://") ||
    !currentTab.id ||
    !tabs.find((tab) => tab.id === currentTab.id)
  ) {
    return;
  }

  await chrome.tabs.sendMessage<ContentScriptRequest>(currentTab.id, {
    action: "refresh",
    resultItems: transformTabsToGoToResultItems(tabs),
  });
});

chrome.runtime.onMessage.addListener(
  async (message: BackgroundListener, sender) => {
    if (message.action === "goTo") {
      await chrome.tabs.update(message.options.tabId, { active: true });
    }

    if (message.action === "close") {
      const tabs = await getAllTabs();

      if (!tabs.find((tab) => tab.id === message.options.tabId)) {
        return;
      }

      await chrome.tabs.remove(message.options.tabId);
    }

    if (message.action === "getFreshTabs") {
      if (!sender.tab || !sender.tab.id) {
        return;
      }

      const tabs = await getAllTabs();

      let resultItems: ResultItem[] = transformTabsToGoToResultItems(tabs);

      if (message.options.input.length > 2) {
        const history = await getHistory(message.options.input);

        resultItems = resultItems.concat(
          transformTabsToHistoryResultItems(history).slice(0, 5)
        );
      }

      await chrome.tabs.sendMessage<ContentScriptRequest>(sender.tab.id, {
        action: "getFreshTabs",
        resultItems,
      });
    }

    if (message.action === "newTab") {
      await chrome.tabs.create({ url: message.options.url });
    }
  }
);

chrome.commands.onCommand.addListener(async (c, currentTab) => {
  switch (c) {
    case "open":
      if (!currentTab.id) {
        throw new Error("no current tab id");
      }

      const tabs = await getAllTabs();

      chrome.tabs.sendMessage<ContentScriptRequest>(currentTab.id, {
        action: "open",
        currentTabId: currentTab.id,
        resultItems: transformTabsToGoToResultItems(tabs),
      });
      break;
  }
});
