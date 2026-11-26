// 词表的解析和默认值（游戏、配置面板、后台预下载共用）

// 第三关词组列表：用逗号、顿号、空格或换行分隔，只保留含汉字的
export const splitPhrases = (list: string) =>
  list.split(/[,，、;；\s]+/).map(s => s.trim()).filter(s => /[一-鿿]/.test(s));

// 英文单词：不支持用“-”拆音节，录入的“-”一律去掉
export const cleanWord = (raw: string) => raw.replace(/-/g, '');
export const parseWord = (raw: string) => cleanWord(raw).trim();

export const DEFAULT_PHRASES = '苹果，中国，老师，朋友，学校';

export const DEFAULT_WORDS = [
  { en: 'lettuce', zh: '生菜' },
  { en: 'cereal', zh: '麦片' },
  { en: 'circle', zh: '圆圈' },
  { en: 'city', zh: '城市' },
  { en: 'face', zh: '脸' },
  { en: 'rice', zh: '米饭' },
  { en: 'pencil', zh: '铅笔' },
];
