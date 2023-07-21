const getAllTabs = () => {
  try {
    return chrome.tabs.query({});
  } catch (e) {
    console.error(e);
  }
};

const getCurrentTab = async () => {
  try {
    let [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    return tab;
  } catch (e) {
    console.error(e);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.startsWith("chrome://")) return undefined;

  if (changeInfo.status === "complete") {
    chrome.scripting.executeScript({
      files: ["contentScript.js"],
      target: { tabId: tab.id, allFrames: true },
    });
  }
});

chrome.tabs.onRemoved.addListener(async () => {
  const tabs = await getAllTabs();
  const currentTab = await getCurrentTab();

  chrome.tabs.sendMessage(currentTab.id, {
    action: "refreshTabs",
    tabs,
  });

  return true;
});

chrome.tabs.onActivated.addListener(async () => {
  const tabs = await getAllTabs();
  const currentTab = await getCurrentTab();

  chrome.tabs.sendMessage(currentTab.id, {
    action: "refreshTabs",
    tabs,
  });

  return true;
});

chrome.tabs.onCreated.addListener(async () => {
  const tabs = await getAllTabs();
  const currentTab = await getCurrentTab();

  chrome.tabs.sendMessage(currentTab.id, {
    action: "refreshTabs",
    tabs,
  });

  return true;
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "switchTab") {
    var updateProperties = { active: true };
    chrome.tabs.update(message.options.tabId, updateProperties);
    return true;
  }

  if (message.action === "closeTab") {
    chrome.tabs.remove(message.options.tabId);
  }

  if (message.action === "createNewTab") {
    chrome.tabs.create({ url: message.options.url });
  }

  if (message.action === "getHistory") {
    const history =
      message.options.input.length < 2
        ? []
        : await chrome.history.search({
            text: message.options.input,
            startTime: new Date().setDate(new Date().getDate() - 7),
          });

    const currentTab = await getCurrentTab();

    chrome.tabs.sendMessage(currentTab.id, {
      action: "showHistory",
      history: history.sort((a, b) => b.visitCount - a.visitCount).slice(0, 5),
    });
  }
});

chrome.commands.onCommand.addListener(async (c) => {
  switch (c) {
    case "open":
      try {
        const currentTab = await getCurrentTab();
        const tabs = await getAllTabs();

        chrome.tabs.sendMessage(currentTab.id, {
          action: "open",
          tabs: tabs,
          currentTabId: currentTab.id,
        });
      } catch (e) {
        console.error(e);
      }
      break;
  }
});
