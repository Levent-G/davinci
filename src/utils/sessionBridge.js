let _completed = false;
export const markCompleted = () => {
  _completed = true;
};
export const wasCompleted = () => {
  const v = _completed;
  _completed = false;
  return v;
};
// Eski uyumlu
export const signal = markCompleted;
export const consume = wasCompleted;
export const setWordCompleted = markCompleted;
export const consumeWordCompleted = wasCompleted;
