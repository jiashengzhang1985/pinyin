import { useRef, useState, useEffect, useCallback } from 'react';
import './HandwritingCanvas.less';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
}

interface HandwritingCanvasProps {
  targetCharacter: string;
  onCharacterMatch: (character: string) => void;
  width?: number;
  height?: number;
  showOutline?: boolean;
}

// 常见汉字的简单笔画数映射（宽松匹配用）
const STROKE_COUNTS: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '人': 2, '大': 3, '小': 3,
  '中': 4, '国': 8, '我': 7, '是': 9, '爱': 10, '中': 4,
  '华': 6, '人': 2, '民': 5, '共': 6, '和': 8, '国': 8
};

export default function HandwritingCanvas({
  targetCharacter,
  onCharacterMatch,
  width = 300,
  height = 300,
  showOutline = true
}: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // 绘制参考轮廓
  useEffect(() => {
    if (!outlineRef.current || !showOutline || !targetCharacter) return;

    const canvas = outlineRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制半透明参考轮廓
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 120px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(targetCharacter, canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 1;
  }, [targetCharacter, showOutline]);

  // 清除画布并重置状态
  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    redrawCanvas();
  }, []);

  // 回退一步
  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes(prev => prev.slice(0, -1));
    redrawCanvas();
  }, [strokes]);

  // 重绘画布
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布（但保留参考轮廓）
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制已完成的所有笔画
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });

    // 绘制当前正在书写的笔画
    if (currentStroke.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }

      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  // 开始绘制
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  }, []);

  // 绘制中
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentStroke(prev => [...prev, { x, y }]);
  }, [isDrawing]);

  // 结束绘制
  const stopDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);
    }
  }, [isDrawing, currentStroke]);

  // 简单的汉字匹配逻辑
  const matchCharacterSimple = (targetChar: string, userStrokes: Stroke[]): boolean => {
    if (!targetChar || userStrokes.length === 0) return false;

    // 获取目标字符的期望笔画数（宽松匹配）
    const expectedStrokes = STROKE_COUNTS[targetChar] || Math.ceil(targetChar.length * 2);
    const userStrokeCount = userStrokes.length;

    // 允许±2的误差范围
    const minStrokes = Math.max(1, expectedStrokes - 2);
    const maxStrokes = expectedStrokes + 2;

    // 检查笔画数是否在合理范围内
    if (userStrokeCount < minStrokes || userStrokeCount > maxStrokes) {
      return false;
    }

    // 检查每个笔画的基本特征（长度和方向变化）
    let validStrokes = 0;
    for (const stroke of userStrokes) {
      if (validateStrokeBasic(stroke)) {
        validStrokes++;
      }
    }

    // 至少70%的笔画要通过基本验证
    return validStrokes >= userStrokeCount * 0.7;
  };

  // 基本的笔画验证
  const validateStrokeBasic = (stroke: Stroke): boolean => {
    if (stroke.points.length < 3) return false;

    // 计算笔画长度
    let length = 0;
    for (let i = 1; i < stroke.points.length; i++) {
      const dx = stroke.points[i].x - stroke.points[i - 1].x;
      const dy = stroke.points[i].y - stroke.points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    // 笔画不能太短
    return length >= 15;
  };

  // 确认识别
  const confirmRecognition = useCallback(() => {
    if (strokes.length === 0 || !targetCharacter) return;

    try {
      // 使用简化的匹配逻辑
      const isMatch = matchCharacterSimple(targetCharacter, strokes);

      if (isMatch) {
        // 匹配成功，清空画布并触发回调
        clearCanvas();
        onCharacterMatch(targetCharacter);

        // 播放成功音效
        playSuccessSound();
      }
      // 匹配失败不做任何提示，允许用户继续书写或回退
    } catch (error) {
      console.error('识别失败:', error);
    }
  }, [strokes, targetCharacter, onCharacterMatch, clearCanvas]);

  // 播放成功音效
  const playSuccessSound = useCallback(() => {
    try {
      const audio = new Audio('/mp3/success.mp3');
      audio.play().catch(() => {
        // 如果音频文件不存在，使用Web Audio API生成简单音效
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      });
    } catch (error) {
      console.error('播放音效失败:', error);
    }
  }, []);

  // 重绘画布当笔画改变时
  useEffect(() => {
    redrawCanvas();
  }, [strokes, currentStroke, redrawCanvas]);

  return (
    <div className="handwriting-canvas">
      <div className="canvas-container">
        {showOutline && (
          <canvas
            ref={outlineRef}
            width={width}
            height={height}
            className="outline-canvas"
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="handwriting-canvas-element"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none', position: 'relative', zIndex: 1 }}
        />
      </div>

      <div className="handwriting-controls">
        <button onClick={undoLastStroke} className="control-btn undo-btn">
          回退一步
        </button>
        <button onClick={clearCanvas} className="control-btn clear-btn">
          清除全部
        </button>
        <button onClick={confirmRecognition} className="control-btn confirm-btn">
          确认识别
        </button>
      </div>

      <div className="target-character">
        目标汉字：<span className="character">{targetCharacter}</span>
      </div>
    </div>
  );
}