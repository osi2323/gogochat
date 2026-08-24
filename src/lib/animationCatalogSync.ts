const animationCatalogUpdatedEvent = "animationCatalogUpdated";
const animationCatalogUpdatedStorageKey = "animationCatalogUpdatedAt";

export const notifyAnimationCatalogUpdated = () => {
  if (typeof window === "undefined") return;

  const timestamp = String(Date.now());

  try {
    window.localStorage.setItem(animationCatalogUpdatedStorageKey, timestamp);
  } catch {
    // Ignore storage errors and still notify same-tab listeners.
  }

  window.dispatchEvent(
    new CustomEvent(animationCatalogUpdatedEvent, {
      detail: { updatedAt: timestamp },
    }),
  );
};

export const subscribeToAnimationCatalogUpdates = (
  callback: () => void,
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = () => {
    callback();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === animationCatalogUpdatedStorageKey) {
      callback();
    }
  };

  window.addEventListener(animationCatalogUpdatedEvent, handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(animationCatalogUpdatedEvent, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
};
