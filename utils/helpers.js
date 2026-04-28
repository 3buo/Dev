export function validateInput(text) {
  return text && text.trim().length > 0;
}

export function formatDate(date) {
  return new Date(date).toLocaleString();
}
