import React, { useState, useEffect, useRef } from 'react';
import { pinyin } from 'pinyin-pro';

const PinyinGame = () => {
  const [gameState, setGameState] = useState('setup'); // 'setup' | 'playing' | 'completed'
  const [inputText, setInputText] = useState('');
  const [characters, setCharacters] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showExplosion, setShowExplosion] = useState(false);
  const [shake, setShake] = useState(false);
  const [inputDelay, setInputDelay] = useState(500); // 输入延迟（毫秒）
  const [canInput, setCanInput] = useState(true); // 是否可以输入
  const [showError, setShowError] = useState(false); // 显示错误提示
  
  const successAudioRef = useRef(null);
  const errorAudioRef = useRef(null);
  const lastInputTimeRef = useRef(0);

  // 开始游戏
  const startGame = () => {
    if (inputText.trim().length === 0) {
      alert('请输入要练习的汉字！');
      return;
    }
    
    const chars = inputText.trim().split('').filter(char => char.trim() !== '');
    const charsWithPinyin = chars.map(char => ({
      character: char,
      pinyin: pinyin(char, { toneType: 'none', type: 'array' })[0] || ''
    }));
    
    setCharacters(charsWithPinyin);
    setCurrentIndex(0);
    setUserInput('');
    setGameState('playing');
  };

  // 重新开始
  const reset = () => {
    setGameState('setup');
    setInputText('');
    setCharacters([]);
    setCurrentIndex(0);
    setUserInput('');
    setShowExplosion(false);
  };

  // 处理键盘输入
  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyPress = (e) => {
      const key = e.key.toLowerCase();
      
      // 只接受字母
      if (!/^[a-z]$/.test(key)) return;

      // 检查输入延迟
      const now = Date.now();
      if (now - lastInputTimeRef.current < inputDelay) {
        return; // 还在延迟期间，忽略输入
      }

      if (!canInput) return;

      const newInput = userInput + key;
      setUserInput(newInput);
      lastInputTimeRef.current = now;

      const currentChar = characters[currentIndex];
      const targetPinyin = currentChar.pinyin.toLowerCase();

      // 检查是否匹配
      if (targetPinyin.startsWith(newInput)) {
        // 部分正确，继续
        if (newInput === targetPinyin) {
          // 完全正确！
          playSuccess();
          setShowExplosion(true);
          setCanInput(false);
          
          setTimeout(() => {
            setShowExplosion(false);
            setUserInput('');
            setCanInput(true);
            lastInputTimeRef.current = 0;
            
            if (currentIndex < characters.length - 1) {
              setCurrentIndex(currentIndex + 1);
            } else {
              setGameState('completed');
            }
          }, 800);
        }
      } else {
        // 输入错误 - 显示错误提示并重置输入，但不换字
        playError();
        setShake(true);
        setShowError(true);
        setCanInput(false);
        
        setTimeout(() => {
          setShake(false);
          setShowError(false);
          setUserInput('');
          setCanInput(true);
          lastInputTimeRef.current = 0;
          // 注意：不改变 currentIndex，让孩子重新练习这个字
        }, 1000);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [gameState, userInput, currentIndex, characters, canInput, inputDelay]);

  // 播放成功音效（使用Web Audio API生成音效）
  const playSuccess = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  // 播放错误音效
  const playError = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        
        {/* 设置页面 */}
        {gameState === 'setup' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <h1 className="text-4xl font-bold text-purple-600 mb-6">🎮 拼音炸弹游戏</h1>
            <p className="text-gray-600 mb-8">输入你想练习的汉字，开始学习拼音吧！</p>
            
            <div className="mb-6">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如：天地人你我他山水火电"
                className="w-full p-4 text-2xl border-4 border-purple-300 rounded-xl focus:outline-none focus:border-purple-500 text-center"
                rows="3"
              />
            </div>

            {/* 输入延迟设置 */}
            <div className="mb-8 bg-purple-50 rounded-xl p-4">
              <label className="block text-gray-700 font-semibold mb-3">
                字母输入间隔时间（给孩子反应时间）
              </label>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="100"
                  value={inputDelay}
                  onChange={(e) => setInputDelay(Number(e.target.value))}
                  className="w-64"
                />
                <span className="text-lg font-bold text-purple-600 w-24">
                  {inputDelay}ms
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                {inputDelay === 0 ? '无延迟' : 
                 inputDelay < 500 ? '较快' : 
                 inputDelay < 1000 ? '适中（推荐）' : '较慢'}
              </div>
            </div>
            
            <button
              onClick={startGame}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-4 rounded-full text-xl font-bold hover:scale-105 transform transition shadow-lg"
            >
              开始游戏 🚀
            </button>
          </div>
        )}

        {/* 游戏页面 */}
        {gameState === 'playing' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* 进度条 */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-gray-700">
                  进度: {currentIndex + 1} / {characters.length}
                </span>
                <span className="text-sm text-gray-500">
                  输入延迟: {inputDelay}ms
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / characters.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 主游戏区域 */}
            <div className="flex gap-8">
              {/* 左侧：汉字显示区 */}
              <div className="flex-1">
                <div className="relative h-80 flex items-center justify-center">
                  {!showExplosion && (
                    <div
                      className={`text-9xl font-bold text-purple-600 transition-all duration-200 ${
                        shake ? 'animate-shake' : ''
                      }`}
                    >
                      {characters[currentIndex]?.character}
                    </div>
                  )}

                  {/* 炸弹爆炸动画 */}
                  {showExplosion && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                        <div className="text-8xl animate-explosion">💥</div>
                        <div className="absolute top-0 left-0 text-8xl animate-explosion-delayed opacity-70">✨</div>
                        <div className="absolute top-0 left-0 text-8xl animate-explosion-delayed-2 opacity-50">⭐</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：拼音提示区 */}
              <div className="w-48 flex flex-col justify-center">
                <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl p-6 border-4 border-yellow-300 shadow-lg">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">正确拼音</div>
                    <div className="text-5xl font-bold text-orange-600 mb-4">
                      {characters[currentIndex]?.pinyin}
                    </div>
                    
                    {/* 错误提示 */}
                    {showError && (
                      <div className="animate-bounce bg-red-100 border-2 border-red-400 rounded-lg p-3 mt-4">
                        <div className="text-3xl mb-1">❌</div>
                        <div className="text-sm text-red-600 font-semibold">
                          再试一次！
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 用户输入显示 */}
            <div className="mt-8 text-center">
              <div className="text-gray-500 mb-2">你的输入:</div>
              <div className="text-4xl font-mono font-bold text-purple-600 h-12">
                {userInput || '_'}
              </div>
              <div className="text-sm text-gray-400 mt-4">
                使用键盘输入拼音字母 {!canInput && '(请稍候...)'}
              </div>
            </div>
          </div>
        )}

        {/* 完成页面 */}
        {gameState === 'completed' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-4xl font-bold text-purple-600 mb-4">太棒了！</h2>
            <p className="text-xl text-gray-600 mb-8">
              你已经完成了 {characters.length} 个汉字的练习！
            </p>
            
            <div className="bg-purple-50 rounded-xl p-6 mb-8">
              <div className="text-lg text-gray-700 mb-2">练习的汉字：</div>
              <div className="text-3xl font-bold text-purple-600">
                {characters.map(c => c.character).join(' ')}
              </div>
            </div>

            <button
              onClick={reset}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-4 rounded-full text-xl font-bold hover:scale-105 transform transition shadow-lg"
            >
              再来一次 🔄
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        
        @keyframes explosion {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        
        @keyframes explosion-delayed {
          0% { transform: scale(0.3) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
          100% { transform: scale(1.8) rotate(360deg); opacity: 0; }
        }
        
        @keyframes explosion-delayed-2 {
          0% { transform: scale(0.2) rotate(0deg); opacity: 0; }
          50% { transform: scale(1) rotate(-180deg); opacity: 1; }
          100% { transform: scale(1.5) rotate(-360deg); opacity: 0; }
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        .animate-explosion {
          animation: explosion 0.8s ease-out;
        }
        
        .animate-explosion-delayed {
          animation: explosion-delayed 0.8s ease-out 0.1s;
        }
        
        .animate-explosion-delayed-2 {
          animation: explosion-delayed-2 0.8s ease-out 0.2s;
        }
      `}</style>
    </div>
  );
};

export default PinyinGame;
