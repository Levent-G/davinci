// Ekranlar arası sinyal
let _signal = false;
export const signal = () => {
  _signal = true;
};
export const consume = () => {
  const v = _signal;
  _signal = false;
  return v;
};
