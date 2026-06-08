// Sadece "aşamalar tamamlandı" sinyali
let _wordCompleted = false;
export const setWordCompleted = () => {
  _wordCompleted = true;
};
export const consumeWordCompleted = () => {
  const v = _wordCompleted;
  _wordCompleted = false;
  return v;
};
