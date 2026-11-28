import { history } from 'umi';
import { isNativeApp } from '@/utils/tts';
import './index.less';
export default function HomePage() {
  const levels = [
    {
      id: 1,
      title: '字母数字',
      icon: '🔤',
      description: '击落掉落的字母和数字',
      path: '/level1',
      color: '#4CAF50',
    },
    {
      id: 2,
      title: '拼音射击',
      icon: '🎯',
      description: '输入拼音击落目标',
      path: '/level2',
      color: '#2196F3',
    },
    {
      id: 3,
      title: '汉字挑战',
      icon: '📝',
      description: '输入拼音击落汉字',
      path: '/level3',
      color: '#FF9800',
    },
    {
      id: 4,
      title: '英语单词',
      icon: '📖',
      description: '打英文单词击落目标，听美音看中文',
      path: '/level5',
      color: '#E91E63',
    },
    {
      id: 5,
      title: '加减乘除',
      icon: '🧮',
      description: '算对一题打怪兽一下，竖式进位、乘法口诀边玩边学',
      path: '/level6',
      color: '#7C3AED',
    },
  ];

  // 安卓 App 里放：汉字挑战、英语单词、加减乘除
  const shown = isNativeApp ? levels.filter(l => l.id === 3 || l.id === 4 || l.id === 5) : levels;

  return (
    <div className="home-page">
      <div className="game-title">
        <h1>元宝玩学</h1>
        <p className="subtitle">Daniel Play &amp; Study</p>
      </div>

      <div className="level-cards">
        {shown.map((level) => (
          <div
            key={level.id}
            className="level-card"
            style={{ borderColor: level.color }}
            onClick={() => history.push(level.path)}
          >
            <div className="level-number" style={{ backgroundColor: level.color }}>
              {level.icon}
            </div>
            <div className="level-text">
              <h2>{level.title}</h2>
              <p>{level.description}</p>
            </div>
            <button
              className="start-btn"
              style={{ backgroundColor: level.color }}
            >
              开始游戏
            </button>
          </div>
        ))}
      </div>

      {!isNativeApp && (
        <div className="game-instructions">
          <h3>游戏说明</h3>
          <ul>
            <li>🎯 通过键盘输入正确的字符来击落目标</li>
            <li>⚡ 可以在右侧调整掉落速度和数量</li>
            <li>🔄 掉落到底部未击中会重新从顶部掉落</li>
            <li>🎮 多个目标时，自动匹配最接近的目标</li>
          </ul>
        </div>
      )}
    </div>
  );
}
