export function getFilteredItems(items, query, selectedCategory, sortMode) {
  const cleanedQuery = query.trim().toLowerCase();

  let filtered = items.filter(item => {
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const searchable = [
      item.name,
      item.location,
      item.category,
      item.room,
      item.notes
    ].join(" ").toLowerCase();

    const matchesSearch = !cleanedQuery || searchable.includes(cleanedQuery);
    return matchesCategory && matchesSearch;
  });

  if (sortMode === "name") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sortMode === "category") {
    filtered.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
  } else {
    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  return filtered;
}
