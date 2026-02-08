import { history } from 'umi';
import './index.less';

export default function HomePage() {
  const levels = [
    {
      id: 1,
      title: '第一关：字母数字',
      description: '击落掉落的字母和数字',
      path: '/level1',
      color: '#4CAF50',
    },
    {
      id: 2,
      title: '第二关：拼音射击',
      description: '输入拼音击落目标',
      path: '/level2',
      color: '#2196F3',
    },
    {
      id: 3,
      title: '第三关：汉字挑战',
      description: '输入拼音击落汉字',
      path: '/level3',
      color: '#FF9800',
    },
  ];

  return (
    <div className="home-page">
      <div className="game-title">
        <h1>打字射击游戏</h1>
        <p className="subtitle">Type & Shoot - 中文版</p>
      </div>

      <div className="level-cards">
        {levels.map((level) => (
          <div
            key={level.id}
            className="level-card"
            style={{ borderColor: level.color }}
            onClick={() => history.push(level.path)}
          >
            <div className="level-number" style={{ backgroundColor: level.color }}>
              {level.id}
            </div>
            <h2>{level.title}</h2>
            <p>{level.description}</p>
            <button
              className="start-btn"
              style={{ backgroundColor: level.color }}
            >
              开始游戏
            </button>
          </div>
        ))}
      </div>

      <div className="game-instructions">
        <h3>游戏说明</h3>
        <ul>
          <li>🎯 通过键盘输入正确的字符来击落目标</li>
          <li>⚡ 可以在右侧调整掉落速度和数量</li>
          <li>🔄 掉落到底部未击中会重新从顶部掉落</li>
          <li>🎮 多个目标时，自动匹配最接近的目标</li>
        </ul>
      </div>
    </div>
  );
}
