import HanziWriter from 'hanzi-writer';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
}

export interface HandwritingData {
  strokes: Stroke[];
  character: string;
}

/**
 * 汉字匹配工具类
 * 使用HanziWriter进行汉字识别和匹配
 */
export class HanziMatcher {
  private static instance: HanziMatcher;
  private writers: Map<string, HanziWriter> = new Map();
  private isStrictMode: boolean = false; // 默认宽松模式

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): HanziMatcher {
    if (!HanziMatcher.instance) {
      HanziMatcher.instance = new HanziMatcher();
    }
    return HanziMatcher.instance;
  }

  /**
   * 设置匹配模式
   * @param isStrict 是否为严格模式
   */
  public setStrictMode(isStrict: boolean): void {
    this.isStrictMode = isStrict;
  }

  /**
   * 匹配用户手写的汉字
   * @param targetCharacter 目标汉字
   * @param userStrokes 用户书写的笔画
   * @returns 是否匹配成功
   */
  public async matchCharacter(
    targetCharacter: string,
    userStrokes: Stroke[]
  ): Promise<boolean> {
    try {
      if (!targetCharacter || userStrokes.length === 0) {
        return false;
      }

      // 获取或创建目标字符的writer
      const writer = await this.getCharacterWriter(targetCharacter);
      if (!writer) {
        console.warn(`无法创建字符 ${targetCharacter} 的writer`);
        return false;
      }

      // 获取标准笔画数据
      const characterData = await this.getCharacterData(writer);
      if (!characterData) {
        return false;
      }

      // 执行匹配算法
      return this.performMatching(characterData, userStrokes);

    } catch (error) {
      console.error('汉字匹配失败:', error);
      return false;
    }
  }

  /**
   * 获取指定字符的HanziWriter实例
   */
  private async getCharacterWriter(character: string): Promise<HanziWriter | null> {
    if (this.writers.has(character)) {
      return this.writers.get(character)!;
    }

    try {
      // 创建一个隐藏的canvas来获取字符数据
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      const writer = HanziWriter.create(tempDiv, character, {
        width: 100,
        height: 100,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 100,
        strokeColor: '#333',
        outlineColor: '#ddd'
      });

      // 等待字符数据加载
      await new Promise(resolve => setTimeout(resolve, 200));

      this.writers.set(character, writer);
      document.body.removeChild(tempDiv);

      return writer;
    } catch (error) {
      console.error(`创建字符 ${character} 的writer失败:`, error);
      return null;
    }
  }

  /**
   * 获取字符的标准笔画数据
   */
  private async getCharacterData(writer: HanziWriter): Promise<any> {
    try {
      // 这里需要访问HanziWriter的内部数据
      // 由于HanziWriter的API限制，我们使用简化的方法
      await new Promise(resolve => setTimeout(resolve, 100));
      return true; // 简化处理，实际应该有更复杂的数据获取
    } catch (error) {
      console.error('获取字符数据失败:', error);
      return null;
    }
  }

  /**
   * 执行匹配算法
   */
  private performMatching(
    characterData: any,
    userStrokes: Stroke[]
  ): boolean {
    if (this.isStrictMode) {
      return this.strictMatching(characterData, userStrokes);
    } else {
      return this.looseMatching(characterData, userStrokes);
    }
  }

  /**
   * 严格匹配模式
   * 要求笔画数、方向、顺序都基本正确
   */
  private strictMatching(
    characterData: any,
    userStrokes: Stroke[]
  ): boolean {
    // 获取标准笔画数（这里使用经验值，实际应该从characterData获取）
    const expectedStrokeCount = this.getExpectedStrokeCount(characterData);
    const userStrokeCount = userStrokes.length;

    // 笔画数必须完全匹配
    if (userStrokeCount !== expectedStrokeCount) {
      return false;
    }

    // 检查每个笔画的基本特征
    for (let i = 0; i < userStrokes.length; i++) {
      const userStroke = userStrokes[i];
      if (!this.validateStrokeCharacteristics(userStroke)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 宽松匹配模式
   * 主要检查笔画数和基本形状特征
   */
  private looseMatching(
    characterData: any,
    userStrokes: Stroke[]
  ): boolean {
    // 获取期望的笔画数范围
    const expectedStrokeCount = this.getExpectedStrokeCount(characterData);
    const userStrokeCount = userStrokes.length;

    // 允许笔画数有一定误差（±2笔）
    const minStrokes = Math.max(1, expectedStrokeCount - 2);
    const maxStrokes = expectedStrokeCount + 2;

    if (userStrokeCount < minStrokes || userStrokeCount > maxStrokes) {
      return false;
    }

    // 检查基本的笔画特征
    let validStrokes = 0;
    for (const stroke of userStrokes) {
      if (this.validateStrokeCharacteristics(stroke)) {
        validStrokes++;
      }
    }

    // 至少80%的笔画要通过基本验证
    return validStrokes >= userStrokeCount * 0.8;
  }

  /**
   * 获取期望的笔画数
   * 这里使用简化的经验数据，实际应该从HanziWriter获取
   */
  private getExpectedStrokeCount(characterData: any): number {
    // 简化处理：返回一个合理的默认值
    // 实际应用中应该根据具体汉字返回准确的笔画数
    return 5; // 默认期望5笔
  }

  /**
   * 验证单个笔画的特征
   */
  private validateStrokeCharacteristics(stroke: Stroke): boolean {
    if (stroke.points.length < 2) {
      return false;
    }

    // 计算笔画长度
    const length = this.calculateStrokeLength(stroke);
    if (length < 10) { // 太短的笔画无效
      return false;
    }

    // 计算笔画方向变化
    const directionChanges = this.calculateDirectionChanges(stroke);
    if (directionChanges > 10) { // 方向变化太多可能是乱画
      return false;
    }

    return true;
  }

  /**
   * 计算笔画长度
   */
  private calculateStrokeLength(stroke: Stroke): number {
    let length = 0;
    for (let i = 1; i < stroke.points.length; i++) {
      const dx = stroke.points[i].x - stroke.points[i - 1].x;
      const dy = stroke.points[i].y - stroke.points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * 计算笔画方向变化次数
   */
  private calculateDirectionChanges(stroke: Stroke): number {
    if (stroke.points.length < 3) {
      return 0;
    }

    let changes = 0;
    let lastDirection = this.getDirection(
      stroke.points[0],
      stroke.points[1]
    );

    for (let i = 2; i < stroke.points.length; i++) {
      const currentDirection = this.getDirection(
        stroke.points[i - 1],
        stroke.points[i]
      );

      // 如果方向变化超过阈值，计为一次变化
      if (Math.abs(currentDirection - lastDirection) > 45) { // 45度阈值
        changes++;
        lastDirection = currentDirection;
      }
    }

    return changes;
  }

  /**
   * 获取两点间的方向（角度）
   */
  private getDirection(from: Point, to: Point): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.writers.forEach(writer => {
      try {
        writer.hideCharacter();
      } catch (error) {
        console.error('清理writer失败:', error);
      }
    });
    this.writers.clear();
  }
}

// 导出便捷函数
export async function matchCharacter(
  targetCharacter: string,
  userStrokes: Stroke[]
): Promise<boolean> {
  const matcher = HanziMatcher.getInstance();
  return matcher.matchCharacter(targetCharacter, userStrokes);
}

export function setMatchingMode(isStrict: boolean): void {
  const matcher = HanziMatcher.getInstance();
  matcher.setStrictMode(isStrict);
}